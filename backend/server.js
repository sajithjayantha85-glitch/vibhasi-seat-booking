import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db, initDatabase, AUDITORIUM_CONFIG } from './database.js';
import { generateTicketToken, verifyTicketToken } from './cryptoUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Helper to query all seats with check-in status
async function getAllSeatsWithCheckIn() {
  const rows = await db.all(`
    SELECT 
      s.id, 
      s.row_label, 
      s.row_index, 
      s.block, 
      s.seat_num, 
      s.status, 
      s.booking_id,
      CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS is_checked_in,
      c.checked_in_at,
      c.guest_name,
      c.institution_ref
    FROM seats s
    LEFT JOIN check_ins c ON s.id = c.seat_id
    ORDER BY s.row_index ASC, s.seat_num ASC
  `);
  return rows;
}

// Helper to broadcast seat updates to all connected clients
async function broadcastSeatUpdates() {
  try {
    const seats = await getAllSeatsWithCheckIn();
    const stats = await getAuditoriumStats();
    io.emit('seats:updated', { seats, stats });
  } catch (err) {
    console.error('Error broadcasting seat updates:', err);
  }
}

async function getAuditoriumStats() {
  const totalRow = await db.get('SELECT count(*) as count FROM seats');
  const total = totalRow ? Number(totalRow.count) : 504;

  const availRow = await db.get("SELECT count(*) as count FROM seats WHERE status = 'AVAILABLE'");
  const available = availRow ? Number(availRow.count) : 0;

  const bookedRow = await db.get("SELECT count(*) as count FROM seats WHERE status = 'BOOKED'");
  const booked = bookedRow ? Number(bookedRow.count) : 0;

  const blockedRow = await db.get("SELECT count(*) as count FROM seats WHERE status = 'BLOCKED'");
  const blocked = blockedRow ? Number(blockedRow.count) : 0;

  const checkedRow = await db.get(`
    SELECT count(DISTINCT s.id) as count 
    FROM seats s 
    JOIN check_ins c ON s.id = c.seat_id
  `);
  const checkedInSeats = checkedRow ? Number(checkedRow.count) : 0;

  const leftRow = await db.get(`
    SELECT count(DISTINCT s.id) as count 
    FROM seats s 
    JOIN check_ins c ON s.id = c.seat_id 
    WHERE s.block = 'LEFT'
  `);
  const leftOccupied = leftRow ? Number(leftRow.count) : 0;

  const rightRow = await db.get(`
    SELECT count(DISTINCT s.id) as count 
    FROM seats s 
    JOIN check_ins c ON s.id = c.seat_id 
    WHERE s.block = 'RIGHT'
  `);
  const rightOccupied = rightRow ? Number(rightRow.count) : 0;

  const bookedAwaiting = Math.max(0, booked - checkedInSeats);
  const occupancyRate = total > 0 ? Number(((checkedInSeats / total) * 100).toFixed(1)) : 0;

  return {
    total,
    available,
    booked,
    blocked,
    checkedIn: checkedInSeats,
    checkedInSeats,
    bookedAwaiting,
    leftOccupied,
    rightOccupied,
    occupancyRate
  };
}

// -------------------------------------------------------------
// 0. Health & Database Connection Diagnostic Check
app.get('/api/health', async (req, res) => {
  const isTurso = Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_DATABASE_URL.startsWith('libsql://'));
  try {
    const totalRow = await db.get('SELECT count(*) as count FROM seats');
    res.json({
      success: true,
      status: 'OK',
      databaseType: isTurso ? 'Turso Cloud Database (libSQL)' : 'Local SQLite Fallback',
      isTurso,
      tursoHost: isTurso ? process.env.TURSO_DATABASE_URL.split('@').pop()?.split('/')[0] : null,
      seatsCount: totalRow ? Number(totalRow.count) : 0,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      status: 'ERROR',
      databaseType: isTurso ? 'Turso Cloud' : 'Local SQLite',
      isTurso,
      error: err.message
    });
  }
});

// 1. Get all seats and current layout
app.get('/api/seats', async (req, res) => {
  try {
    const seats = await getAllSeatsWithCheckIn();
    const stats = await getAuditoriumStats();
    res.json({
      success: true,
      seats,
      stats,
      auditoriumConfig: AUDITORIUM_CONFIG
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 2. Book Seats (Free of charge, Maximum 3 seats per user)
app.post('/api/bookings', async (req, res) => {
  const { fullName, nic, phone, institutionRef, seatIds } = req.body;

  // Basic validation
  if (!fullName || !nic || !phone || !institutionRef || !Array.isArray(seatIds)) {
    return res.status(400).json({
      success: false,
      error: 'All fields are required: Full Name, NIC, Mobile Phone, Institution Ref No, and Selected Seats.'
    });
  }

  // Strict Rule 1: Max 3 seats limit per checkout
  if (seatIds.length === 0) {
    return res.status(400).json({ success: false, error: 'Please select at least 1 seat.' });
  }
  if (seatIds.length > 3) {
    return res.status(400).json({
      success: false,
      error: 'Maximum Seat Limit Exceeded: You cannot reserve more than 3 seats per booking.'
    });
  }

  // Extract client IP address for anti-fraud detection
  const rawIp = (
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    req.ip ||
    ''
  ).trim();
  const clientIp = rawIp.replace(/^.*:/, '');

  const cleanNic = nic.trim().toUpperCase();
  const cleanPhone = phone.trim().replace(/[\s\-\+\(\)]/g, '');
  const cleanInstRef = institutionRef.trim().toUpperCase();

  try {
    // Strict Rule 2: Multi-attempt cumulative limit check (Max 3 seats total per person)
    // Block attempts if the same National ID, Attendance Ref, Phone number, or IP has already booked seats
    const existingBookings = await db.all(`
      SELECT id, booking_ref, full_name, nic, phone, institution_ref, seat_count, ip_address
      FROM bookings
      WHERE (status IS NULL OR status != 'CANCELLED')
        AND (
          UPPER(TRIM(nic)) = ?
          OR UPPER(TRIM(institution_ref)) = ?
          OR replace(replace(replace(replace(phone, ' ', ''), '-', ''), '+', ''), '(', '') = ?
          OR (
            ip_address IS NOT NULL 
            AND ip_address NOT IN ('', 'unknown', '127.0.0.1', '::1', 'localhost') 
            AND ip_address = ?
          )
        )
    `, [cleanNic, cleanInstRef, cleanPhone, clientIp]);

    if (existingBookings && existingBookings.length > 0) {
      let totalAlreadyBooked = 0;
      const triggers = [];

      for (const b of existingBookings) {
        totalAlreadyBooked += Number(b.seat_count || 0);
        if (b.nic && b.nic.trim().toUpperCase() === cleanNic) triggers.push(`NIC: ${cleanNic}`);
        if (b.institution_ref && b.institution_ref.trim().toUpperCase() === cleanInstRef) triggers.push(`Attendance Ref: ${cleanInstRef}`);
        const bPhone = (b.phone || '').replace(/[\s\-\+\(\)]/g, '');
        if (bPhone && bPhone === cleanPhone) triggers.push(`Phone: ${phone.trim()}`);
        if (clientIp && !['', 'unknown', '127.0.0.1', '::1', 'localhost'].includes(clientIp) && b.ip_address === clientIp) {
          triggers.push(`Device IP: ${clientIp}`);
        }
      }

      const uniqueTriggers = [...new Set(triggers)];

      if (totalAlreadyBooked + seatIds.length > 3) {
        const remainingAllowed = Math.max(0, 3 - totalAlreadyBooked);
        const triggerDesc = uniqueTriggers.length > 0 ? ` (${uniqueTriggers.join(', ')})` : '';
        return res.status(403).json({
          success: false,
          error: totalAlreadyBooked >= 3
            ? `උපරිම ආසන සීමාව ඉක්මවා ඇත: ඔබගේ ${triggerDesc} මගින් දැනටමත් ආසන 3 ක් වෙන්කරවා ගෙන ඇත. එක් අයෙකුට වෙන්කරවා ගත හැකි උපරිම ආසන සංඛ්‍යාව 3 ක් පමණි.`
            : `ආසන සීමාව ඉක්මවා ඇත: ඔබ දැනටමත් ආසන ${totalAlreadyBooked} ක් වෙන්කරවා ගෙන ඇත${triggerDesc}. ඔබට තවදුරටත් වෙන්කරවා ගත හැක්කේ ආසන ${remainingAllowed} ක් පමණි.`
        });
      }
    }

    // Verify all requested seats exist and are AVAILABLE
    const placeholders = seatIds.map(() => '?').join(',');
    const existingSeats = await db.all(`SELECT id, status FROM seats WHERE id IN (${placeholders})`, seatIds);

    if (existingSeats.length !== seatIds.length) {
      return res.status(400).json({ success: false, error: 'One or more selected seats do not exist.' });
    }

    const unavailable = existingSeats.filter(s => s.status !== 'AVAILABLE');
    if (unavailable.length > 0) {
      const unavailableIds = unavailable.map(s => s.id).join(', ');
      return res.status(409).json({
        success: false,
        error: `Seats already reserved or blocked: ${unavailableIds}. Please pick different seats.`
      });
    }

    // Generate unique Booking Reference
    const bookingId = crypto.randomUUID();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingRef = `VBH-2026-${randomSuffix}`;

    // Generate individual seat passes
    const seatTickets = seatIds.map((seatId, idx) => {
      const seatPayload = {
        bookingId,
        bookingRef,
        seatId,
        seatIndex: idx + 1,
        totalSeats: seatIds.length,
        fullName: fullName.trim(),
        nic: nic.trim(),
        institutionRef: institutionRef.trim(),
        createdAt: new Date().toISOString()
      };
      return {
        seatId,
        seatIndex: idx + 1,
        totalSeats: seatIds.length,
        seatRef: `${bookingRef}-${seatId}`,
        fullName: fullName.trim(),
        nic: nic.trim().toUpperCase(),
        institutionRef: institutionRef.trim(),
        ticketToken: generateTicketToken(seatPayload)
      };
    });

    // Master token also generated for overall booking
    const tokenPayload = {
      bookingId,
      bookingRef,
      fullName: fullName.trim(),
      nic: nic.trim(),
      phone: phone.trim(),
      institutionRef: institutionRef.trim(),
      seatIds,
      createdAt: new Date().toISOString()
    };
    const ticketToken = generateTicketToken(tokenPayload);

    // Atomic Batch Transaction
    const batchStatements = [
      {
        sql: `INSERT INTO bookings (id, booking_ref, full_name, nic, phone, institution_ref, seat_ids, seat_count, ticket_token, seat_tickets, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          bookingId,
          bookingRef,
          fullName.trim(),
          nic.trim().toUpperCase(),
          phone.trim(),
          institutionRef.trim(),
          JSON.stringify(seatIds),
          seatIds.length,
          ticketToken,
          JSON.stringify(seatTickets),
          clientIp
        ]
      },
      ...seatIds.map(seatId => ({
        sql: `UPDATE seats SET status = 'BOOKED', booking_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [bookingId, seatId]
      }))
    ];

    await db.batch(batchStatements, 'write');

    // Broadcast seat status update to all connected web/mobile clients
    await broadcastSeatUpdates();

    return res.status(201).json({
      success: true,
      booking: {
        bookingId,
        bookingRef,
        fullName: fullName.trim(),
        nic: nic.trim().toUpperCase(),
        phone: phone.trim(),
        institutionRef: institutionRef.trim(),
        seats: seatIds,
        seatCount: seatIds.length,
        seatTickets,
        ticketToken,
        venue: 'බත්තරමුල්ල සුහුරුපාය 19 වන මහලේ ශ්‍රවණාගාරය (Suhurupaya Auditorium, 19th Floor, Battaramulla)',
        date: '2026-10-05',
        time: '05:00 PM',
        eventName: '"විභාසි" (Vibhasi) ප්‍රසංගය 2026 - සුහුරුපාය ශ්‍රවණාගාරය'
      }
    });
  } catch (err) {
    console.error('Booking transaction error:', err);
    return res.status(500).json({ success: false, error: 'Database transaction error: ' + err.message });
  }
});

// 3. View Public Ticket by Reference
app.get('/api/ticket/:ref', async (req, res) => {
  try {
    const ref = req.params.ref;
    const booking = await db.get(`SELECT * FROM bookings WHERE booking_ref = ? OR ticket_token = ?`, [ref, ref]);

    if (!booking) {
      return res.status(404).json({ success: false, error: 'Ticket not found.' });
    }

    const parsedSeats = JSON.parse(booking.seat_ids);
    let seatTickets = [];
    try {
      seatTickets = booking.seat_tickets ? JSON.parse(booking.seat_tickets) : [];
    } catch (e) {}

    if (seatTickets.length === 0) {
      seatTickets = parsedSeats.map((sid, idx) => ({
        seatId: sid,
        seatIndex: idx + 1,
        totalSeats: parsedSeats.length,
        seatRef: `${booking.booking_ref}-${sid}`,
        fullName: booking.full_name,
        nic: booking.nic,
        institutionRef: booking.institution_ref,
        ticketToken: generateTicketToken({
          bookingId: booking.id,
          bookingRef: booking.booking_ref,
          seatId: sid,
          fullName: booking.full_name,
          nic: booking.nic,
          institutionRef: booking.institution_ref
        })
      }));
    } else {
      seatTickets = seatTickets.map(st => ({
        ...st,
        fullName: st.fullName || booking.full_name,
        nic: st.nic || booking.nic,
        institutionRef: st.institutionRef || booking.institution_ref
      }));
    }

    // Attach check-in status per seat
    const checkedRows = await db.all('SELECT seat_id, checked_in_at FROM check_ins WHERE booking_id = ?', [booking.id]);
    const checkedMap = new Map(checkedRows.map(r => [r.seat_id, r.checked_in_at]));
    seatTickets = seatTickets.map(st => ({
      ...st,
      isCheckedIn: checkedMap.has(st.seatId),
      checkedInAt: checkedMap.get(st.seatId) || null
    }));

    const isFullyCheckedIn = checkedRows.length === parsedSeats.length;

    res.json({
      success: true,
      ticket: {
        bookingRef: booking.booking_ref,
        fullName: booking.full_name,
        nic: booking.nic,
        phone: booking.phone,
        institutionRef: booking.institution_ref,
        seats: parsedSeats,
        seatCount: booking.seat_count,
        seatTickets,
        ticketToken: booking.ticket_token,
        isCheckedIn: isFullyCheckedIn,
        checkedInSeatsCount: checkedRows.length,
        checkedInAt: checkedRows.length > 0 ? checkedRows[0].checked_in_at : null,
        venue: 'බත්තරමුල්ල සුහුරුපාය 19 වන මහලේ ශ්‍රවණාගාරය (Suhurupaya Auditorium, 19th Floor, Battaramulla)',
        date: '2026-10-05',
        time: '05:00 PM',
        eventName: '"විභාසි" (Vibhasi) ප්‍රසංගය 2026 - සුහුරුපාය ශ්‍රවණාගාරය'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Gate Scanner Verification Module (Single-Use Anti-Fraud)
// -------------------------------------------------------------
app.post('/api/gate/verify', async (req, res) => {
  const { qrPayload, gateOfficer = 'Gate 1', targetSeatId } = req.body;

  if (!qrPayload) {
    return res.status(400).json({ success: false, error: 'No QR payload provided' });
  }

  try {
    let token = null;

    if (qrPayload.startsWith('http://') || qrPayload.startsWith('https://')) {
      const url = new URL(qrPayload);
      token = url.searchParams.get('token') || url.pathname.split('/').pop();
    } else {
      token = qrPayload.trim();
    }

    let booking = null;
    let scannedSeatId = null;

    // 1. Verify HMAC cryptographic signature
    const verification = verifyTicketToken(token);
    if (verification.valid && verification.payload) {
      scannedSeatId = verification.payload.seatId || null;
      if (verification.payload.bookingId && verification.payload.bookingRef) {
        booking = await db.get('SELECT * FROM bookings WHERE id = ? OR booking_ref = ?', [
          verification.payload.bookingId,
          verification.payload.bookingRef
        ]);
      } else if (verification.payload.bookingRef) {
        booking = await db.get('SELECT * FROM bookings WHERE booking_ref = ?', [
          verification.payload.bookingRef
        ]);
      }
    }

    // 2. Fallback: direct token match or booking_ref search
    if (!booking) {
      booking = await db.get('SELECT * FROM bookings WHERE booking_ref = ? OR ticket_token = ?', [token, token]);
    }

    // 3. Fallback: manual seatRef format (e.g. VBH-2026-7836-A-L1)
    if (!booking && token.includes('-')) {
      const lastDash = token.lastIndexOf('-');
      const possibleBookingRef = token.substring(0, lastDash);
      const possibleSeatId = token.substring(lastDash + 1);
      const candidateBooking = await db.get('SELECT * FROM bookings WHERE booking_ref = ?', [possibleBookingRef]);
      if (candidateBooking) {
        const seats = JSON.parse(candidateBooking.seat_ids);
        if (seats.includes(possibleSeatId)) {
          booking = candidateBooking;
          scannedSeatId = possibleSeatId;
        }
      }
    }

    if (!booking) {
      return res.status(404).json({
        success: false,
        valid: false,
        isDuplicate: false,
        error: 'INVALID TICKET: Ticket not found or counterfeit cryptographic signature.'
      });
    }

    const allSeats = JSON.parse(booking.seat_ids);
    const checkedRows = await db.all('SELECT seat_id, checked_in_at, gate_officer FROM check_ins WHERE booking_id = ?', [booking.id]);
    const checkedMap = new Map(checkedRows.map(r => [r.seat_id, r]));
    const alreadyCheckedSeatIds = checkedRows.map(r => r.seat_id);

    // CASE 1: Individual Seat Pass Scanned (scannedSeatId is present in QR)
    if (scannedSeatId) {
      if (checkedMap.has(scannedSeatId)) {
        const prev = checkedMap.get(scannedSeatId);
        return res.status(200).json({
          success: true,
          valid: false,
          isDuplicate: true,
          message: `DUPLICATE ENTRY DETECTED! Seat ${scannedSeatId} was already checked in.`,
          seatId: scannedSeatId,
          guest: {
            bookingRef: booking.booking_ref,
            fullName: booking.full_name,
            nic: booking.nic,
            institutionRef: booking.institution_ref,
            phone: booking.phone,
            checkedSeat: scannedSeatId,
            allSeats,
            checkedInAt: prev.checked_in_at,
            gateOfficer: prev.gate_officer
          }
        });
      }

      // Check-in this single seat
      const checkInId = crypto.randomUUID();
      const now = new Date().toISOString();
      await db.run(`
        INSERT INTO check_ins (id, booking_id, booking_ref, seat_id, guest_name, nic, institution_ref, seat_ids, seat_count, checked_in_at, gate_officer)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        checkInId,
        booking.id,
        booking.booking_ref,
        scannedSeatId,
        booking.full_name,
        booking.nic,
        booking.institution_ref,
        JSON.stringify([scannedSeatId]),
        1,
        now,
        gateOfficer
      ]);

      const currentStats = await getAuditoriumStats();
      io.emit('gate:checked_in', {
        bookingRef: booking.booking_ref,
        guestName: booking.full_name,
        nic: booking.nic,
        institutionRef: booking.institution_ref,
        seatIds: [scannedSeatId],
        seatCount: 1,
        checkedInAt: now,
        stats: currentStats
      });
      await broadcastSeatUpdates();

      const remainingPending = allSeats.filter(s => s !== scannedSeatId && !checkedMap.has(s));

      return res.status(200).json({
        success: true,
        valid: true,
        isDuplicate: false,
        message: `VALID SEAT PASS: Seat ${scannedSeatId} Checked In!`,
        checkedSeat: scannedSeatId,
        allSeats,
        checkedSeats: [...alreadyCheckedSeatIds, scannedSeatId],
        pendingSeats: remainingPending,
        guest: {
          bookingRef: booking.booking_ref,
          fullName: booking.full_name,
          nic: booking.nic,
          institutionRef: booking.institution_ref,
          phone: booking.phone,
          checkedSeat: scannedSeatId,
          allSeats,
          checkedInAt: now,
          gateOfficer
        }
      });
    }

    // CASE 2: Master Booking Pass Scanned
    const pendingSeats = allSeats.filter(s => !checkedMap.has(s));

    if (pendingSeats.length === 0) {
      return res.status(200).json({
        success: true,
        valid: false,
        isDuplicate: true,
        message: `DUPLICATE ENTRY DETECTED! All seats (${allSeats.join(', ')}) for this booking are already checked in.`,
        guest: {
          bookingRef: booking.booking_ref,
          fullName: booking.full_name,
          nic: booking.nic,
          institutionRef: booking.institution_ref,
          phone: booking.phone,
          seats: allSeats,
          seatCount: allSeats.length,
          checkedInAt: checkedRows[0]?.checked_in_at,
          gateOfficer: checkedRows[0]?.gate_officer
        }
      });
    }

    const seatsToAdmit = (targetSeatId && pendingSeats.includes(targetSeatId)) ? [targetSeatId] : pendingSeats;
    const now = new Date().toISOString();

    const insertStatements = seatsToAdmit.map(sid => ({
      sql: `INSERT INTO check_ins (id, booking_id, booking_ref, seat_id, guest_name, nic, institution_ref, seat_ids, seat_count, checked_in_at, gate_officer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        crypto.randomUUID(),
        booking.id,
        booking.booking_ref,
        sid,
        booking.full_name,
        booking.nic,
        booking.institution_ref,
        JSON.stringify([sid]),
        1,
        now,
        gateOfficer
      ]
    }));
    await db.batch(insertStatements, 'write');

    const currentStats = await getAuditoriumStats();
    io.emit('gate:checked_in', {
      bookingRef: booking.booking_ref,
      guestName: booking.full_name,
      nic: booking.nic,
      institutionRef: booking.institution_ref,
      seatIds: seatsToAdmit,
      seatCount: seatsToAdmit.length,
      checkedInAt: now,
      stats: currentStats
    });
    await broadcastSeatUpdates();

    return res.status(200).json({
      success: true,
      valid: true,
      isDuplicate: false,
      message: `VALID TICKET - ADMISSION APPROVED (${seatsToAdmit.join(', ')})`,
      admittedSeats: seatsToAdmit,
      allSeats,
      checkedSeats: [...alreadyCheckedSeatIds, ...seatsToAdmit],
      guest: {
        bookingRef: booking.booking_ref,
        fullName: booking.full_name,
        nic: booking.nic,
        institutionRef: booking.institution_ref,
        phone: booking.phone,
        seats: seatsToAdmit,
        allSeats,
        seatCount: seatsToAdmit.length,
        checkedInAt: now,
        gateOfficer
      }
    });
  } catch (err) {
    console.error('Gate verification error:', err);
    res.status(500).json({ success: false, error: 'Gate scanner error: ' + err.message });
  }
});

// Get recent gate check-ins with detailed guest and seat data
app.get('/api/gate/recent', async (req, res) => {
  try {
    const list = await db.all(`SELECT * FROM check_ins ORDER BY checked_in_at DESC LIMIT 50`);
    const formatted = list.map(item => ({
      ...item,
      seat_ids: JSON.parse(item.seat_ids || '[]')
    }));
    res.json({ success: true, checkIns: formatted });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Simulate a Gate Check-In for live testing and demonstration (one seat at a time!)
app.post('/api/gate/simulate-checkin', async (req, res) => {
  try {
    // 1. Check if there are booked tickets with unchecked seats
    const allBookings = await db.all(`SELECT * FROM bookings ORDER BY created_at ASC`);
    for (const b of allBookings) {
      const seatsInBooking = JSON.parse(b.seat_ids);
      const checkedRows = await db.all('SELECT seat_id FROM check_ins WHERE booking_id = ?', [b.id]);
      const checkedSet = new Set(checkedRows.map(r => r.seat_id));
      const unchecked = seatsInBooking.filter(sid => !checkedSet.has(sid));

      if (unchecked.length > 0) {
        const nextSeat = unchecked[0];
        const now = new Date().toISOString();
        await db.run(`
          INSERT INTO check_ins (id, booking_id, booking_ref, seat_id, guest_name, nic, institution_ref, seat_ids, seat_count, checked_in_at, gate_officer)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          crypto.randomUUID(),
          b.id,
          b.booking_ref,
          nextSeat,
          b.full_name,
          b.nic,
          b.institution_ref,
          JSON.stringify([nextSeat]),
          1,
          now,
          'Simulation Gate'
        ]);

        const stats = await getAuditoriumStats();
        io.emit('gate:checked_in', {
          bookingRef: b.booking_ref,
          guestName: b.full_name,
          nic: b.nic,
          institutionRef: b.institution_ref,
          seatIds: [nextSeat],
          seatCount: 1,
          checkedInAt: now,
          stats
        });
        await broadcastSeatUpdates();

        return res.json({
          success: true,
          simulated: true,
          message: `Simulated check-in for seat ${nextSeat} (${b.full_name}) - ${unchecked.length - 1} remaining`,
          seat: nextSeat,
          remaining: unchecked.length - 1
        });
      }
    }

    // 2. If no bookings with unchecked seats exist, create a demo 3-seat booking and check in seat 1!
    const availableSeats = await db.all(`SELECT id FROM seats WHERE status = 'AVAILABLE' LIMIT 3`);
    if (availableSeats.length === 0) {
      return res.status(400).json({ success: false, error: 'No available seats to simulate check-in.' });
    }

    const demoSeatIds = availableSeats.map(s => s.id);
    const demoBookingId = crypto.randomUUID();
    const demoRef = `VBH-DEMO-${Math.floor(1000 + Math.random() * 9000)}`;
    const guestNames = [
      'සුනිල් පෙරේරා (Sunil Perera)',
      'අනුලා දමයන්ති (Anula Damayanthi)',
      'කසුන් මධුශංක (Kasun Madushanka)',
      'චාමර වික්‍රමසිංහ (Chamara Wickramasinghe)',
      'මාලිනී ෆොන්සේකා (Malini Fonseka)',
      'රුවන් පෙරේරා (Ruwan Perera)',
      'දිනේෂ් ප්‍රනාන්දු (Dinesh Fernando)'
    ];
    const chosenName = guestNames[Math.floor(Math.random() * guestNames.length)];
    const token = generateTicketToken({ bookingId: demoBookingId, bookingRef: demoRef, fullName: chosenName, seatIds: demoSeatIds });
    const now = new Date().toISOString();

    const firstSeat = demoSeatIds[0];
    await db.batch([
      {
        sql: `INSERT INTO bookings (id, booking_ref, full_name, nic, phone, institution_ref, seat_ids, seat_count, ticket_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [demoBookingId, demoRef, chosenName, '199256789012', '0779876543', 'EX-ARR-DEMO', JSON.stringify(demoSeatIds), demoSeatIds.length, token]
      },
      ...demoSeatIds.map(sid => ({
        sql: `UPDATE seats SET status = 'BOOKED', booking_id = ? WHERE id = ?`,
        args: [demoBookingId, sid]
      })),
      {
        sql: `INSERT INTO check_ins (id, booking_id, booking_ref, seat_id, guest_name, nic, institution_ref, seat_ids, seat_count, checked_in_at, gate_officer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [crypto.randomUUID(), demoBookingId, demoRef, firstSeat, chosenName, '199256789012', 'EX-ARR-DEMO', JSON.stringify([firstSeat]), 1, now, 'Simulation Gate']
      }
    ], 'write');

    const stats = await getAuditoriumStats();
    io.emit('gate:checked_in', {
      bookingRef: demoRef,
      guestName: chosenName,
      nic: '199256789012',
      institutionRef: 'EX-ARR-DEMO',
      seatIds: [firstSeat],
      seatCount: 1,
      checkedInAt: now,
      stats
    });
    await broadcastSeatUpdates();

    return res.json({
      success: true,
      simulated: true,
      message: `Created 3-seat reservation for ${chosenName}. Checked in 1st seat ${firstSeat} (Remaining 2 pending)`,
      seat: firstSeat,
      allSeats: demoSeatIds
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// Admin Portal Endpoints
// -------------------------------------------------------------

// 0. Admin Authentication / Login with Password
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'vibhasi@2026';

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'Password is required' });
  }

  // Accept primary password vibhasi@2026, or admin123, or vibhasi@2025
  if (password === ADMIN_PASSWORD || password === 'vibhasi@2026' || password === 'admin123' || password === 'vibhasi@2025' || password === 'vibhasi2026') {
    return res.json({
      success: true,
      message: 'Admin authentication successful',
      token: crypto.randomUUID()
    });
  }

  return res.status(401).json({
    success: false,
    error: 'වැරදි මුරපදයකි (Invalid Password). කරුණාකර නිවැරදි මුරපදය ඇතුළත් කරන්න.'
  });
});

// 1. Block / Unblock Selected Seats for VIPs
app.post('/api/admin/block-seats', async (req, res) => {
  const { seatIds, action } = req.body;

  if (!Array.isArray(seatIds) || seatIds.length === 0) {
    return res.status(400).json({ success: false, error: 'No seats provided' });
  }

  try {
    const newStatus = action === 'BLOCK' ? 'BLOCKED' : 'AVAILABLE';
    const batch = seatIds.map(id => ({
      sql: `UPDATE seats SET status = ?, booking_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND (status = 'AVAILABLE' OR status = 'BLOCKED')`,
      args: [newStatus, id]
    }));

    await db.batch(batch, 'write');
    await broadcastSeatUpdates();
    res.json({ success: true, message: `Updated ${seatIds.length} seat(s) to ${newStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Bulk Block / Unblock Entire Row for VIPs
app.post('/api/admin/block-row', async (req, res) => {
  const { rowLabel, blockSide = 'ALL', action } = req.body;

  if (!rowLabel) {
    return res.status(400).json({ success: false, error: 'rowLabel is required' });
  }

  try {
    const newStatus = action === 'BLOCK' ? 'BLOCKED' : 'AVAILABLE';
    let query = `
      UPDATE seats
      SET status = ?, booking_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE row_label = ? AND (status = 'AVAILABLE' OR status = 'BLOCKED')
    `;
    const params = [newStatus, rowLabel];

    if (blockSide === 'LEFT' || blockSide === 'RIGHT') {
      query += ` AND block = ?`;
      params.push(blockSide);
    }

    await db.run(query, params);
    await broadcastSeatUpdates();
    res.json({ success: true, message: `Row ${rowLabel} (${blockSide}) set to ${newStatus}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Admin Guest Dashboard & Attendee List with Check-In status
app.get('/api/admin/attendees', async (req, res) => {
  try {
    const attendees = await db.all(`
      SELECT
        b.id,
        b.booking_ref,
        b.full_name,
        b.nic,
        b.phone,
        b.institution_ref,
        b.seat_ids,
        b.seat_count,
        b.ticket_token,
        b.seat_tickets,
        b.status as booking_status,
        b.created_at,
        c.checked_in_at,
        c.gate_officer,
        CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END as is_checked_in
      FROM bookings b
      LEFT JOIN check_ins c ON b.id = c.booking_id
      ORDER BY b.created_at DESC
    `);

    const formatted = attendees.map(a => ({
      ...a,
      seat_ids: JSON.parse(a.seat_ids || '[]'),
      seat_tickets: a.seat_tickets ? JSON.parse(a.seat_tickets) : []
    }));

    const stats = await getAuditoriumStats();
    res.json({
      success: true,
      attendees: formatted,
      stats
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Cancel a Booking (Admin Override)
app.post('/api/admin/cancel-booking', async (req, res) => {
  const { bookingId } = req.body;
  if (!bookingId) {
    return res.status(400).json({ success: false, error: 'bookingId is required' });
  }

  try {
    await db.batch([
      { sql: `UPDATE seats SET status = 'AVAILABLE', booking_id = NULL WHERE booking_id = ?`, args: [bookingId] },
      { sql: `DELETE FROM check_ins WHERE booking_id = ?`, args: [bookingId] },
      { sql: `DELETE FROM bookings WHERE id = ?`, args: [bookingId] }
    ], 'write');

    await broadcastSeatUpdates();
    res.json({ success: true, message: 'Booking canceled and seats released successfully' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. System Reset (Clears bookings & check-ins, preserves auditorium layout)
app.post('/api/admin/reset-system', async (req, res) => {
  try {
    await db.batch([
      { sql: `UPDATE seats SET status = 'AVAILABLE', booking_id = NULL;`, args: [] },
      { sql: `DELETE FROM check_ins;`, args: [] },
      { sql: `DELETE FROM bookings;`, args: [] }
    ], 'write');

    await broadcastSeatUpdates();
    res.json({ success: true, message: 'System reset: All bookings and check-ins have been cleared.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Download Complete Database Backup (JSON Export)
app.get('/api/admin/export-database', async (req, res) => {
  try {
    const seats = await db.all('SELECT * FROM seats ORDER BY row_index ASC, seat_num ASC');
    const bookings = await db.all('SELECT * FROM bookings ORDER BY created_at ASC');
    const checkIns = await db.all('SELECT * FROM check_ins ORDER BY checked_in_at ASC');
    const stats = await getAuditoriumStats();

    const backupData = {
      exportTimestamp: new Date().toISOString(),
      system: '"Vibhasi" Concert Seating & Gate Scanner',
      stats,
      totalSeats: seats.length,
      totalBookings: bookings.length,
      totalCheckIns: checkIns.length,
      data: {
        seats,
        bookings,
        checkIns
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=vibhasi_database_backup_${new Date().toISOString().split('T')[0]}.json`);
    res.send(JSON.stringify(backupData, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: 'Database export error: ' + err.message });
  }
});

// Socket.io Real-time connection handler
io.on('connection', async (socket) => {
  try {
    const stats = await getAuditoriumStats();
    socket.emit('stats:init', stats);
  } catch (e) {}

  socket.on('disconnect', () => {
    // client disconnected
  });
});

// Serve Frontend Build Assets & SPA Fallback
const clientDist = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;

async function startServer() {
  await initDatabase();
  server.listen(PORT, () => {
    console.log(`Suhurupaya Auditorium Seat Booking Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
