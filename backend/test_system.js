// Comprehensive System Verification Test
import { db, initDatabase } from './database.js';
import { generateTicketToken, verifyTicketToken } from './cryptoUtils.js';

async function runTests() {
  console.log('=== STARTING AUTOMATED TEST SUITE ===');

  // Test 1: Verify Layout & Seat Count
  const seatRow = await db.get('SELECT count(*) as count FROM seats');
  const seatCount = Number(seatRow ? seatRow.count : 0);
  console.log(`[TEST 1] Total seats configured: ${seatCount}`);
  if (seatCount < 400) throw new Error('Expected at least 400 seats for Suhurupaya auditorium!');
  console.log('✓ PASS: Auditorium geometry initialized with all rows.');

  // Test 2: Cryptographic HMAC Token
  const testPayload = {
    bookingId: 'test-uuid-1234',
    bookingRef: 'SHP-2026-TEST',
    fullName: 'Kamal Gunaratne',
    nic: '198812345678',
    institutionRef: 'REF-TEST-001',
    seatIds: ['A-L1', 'A-L2']
  };
  const token = generateTicketToken(testPayload);
  console.log('[TEST 2] Generated Ticket Token:', token.substring(0, 30) + '...');
  const verified = verifyTicketToken(token);
  if (!verified.valid || verified.payload.bookingRef !== 'SHP-2026-TEST') {
    throw new Error('HMAC token verification failed!');
  }
  console.log('✓ PASS: Cryptographic token generates and verifies correctly.');

  // Tamper test
  const tamperedToken = token.slice(0, -6) + 'AAAAAA';
  const tamperResult = verifyTicketToken(tamperedToken);
  if (tamperResult.valid) {
    throw new Error('Tampered token should have failed verification!');
  }
  console.log('✓ PASS: Tampered token was rejected as expected.');

  // Test 3: API Endpoint Tests
  const BASE_URL = 'http://localhost:5000';

  // Reset database to ensure clean test state
  await fetch(`${BASE_URL}/api/admin/reset-system`, { method: 'POST' });

  // 3a. Seats API
  const seatsRes = await fetch(`${BASE_URL}/api/seats`);
  const seatsData = await seatsRes.json();
  if (!seatsData.success || seatsData.seats.length !== seatCount) {
    throw new Error('GET /api/seats failed');
  }
  console.log('✓ PASS: GET /api/seats returned all seats and initial stats.');

  // 3b. Max 3 seats constraint: Attempt 4 seats
  const fourSeatsRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Rule Breaker',
      nic: '200012345678',
      phone: '0712345678',
      institutionRef: 'REF-TEST-004',
      seatIds: ['A-L1', 'A-L2', 'A-L3', 'A-L4']
    })
  });
  if (fourSeatsRes.status !== 400) {
    throw new Error(`Expected status 400 for 4 seats, got ${fourSeatsRes.status}`);
  }
  console.log('✓ PASS: Strict 3-seat limit correctly rejected 4-seat reservation.');

  // 3c. Valid Booking (3 seats)
  const validBookingRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Nimal Perera',
      nic: '199212345678',
      phone: '0779876543',
      institutionRef: 'REF-SUH-084',
      seatIds: ['A-L1', 'A-L2', 'A-L3']
    })
  });
  const bookingData = await validBookingRes.json();
  if (!bookingData.success) {
    throw new Error('Valid booking failed: ' + JSON.stringify(bookingData));
  }
  console.log(`✓ PASS: Booking succeeded! Ref: ${bookingData.booking.bookingRef}, Seats: ${bookingData.booking.seats.join(', ')}`);

  // 3d. Double Booking Prevention (Conflict 409)
  const conflictRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Another User',
      nic: '199587654321',
      phone: '0701112233',
      institutionRef: 'REF-SUH-099',
      seatIds: ['A-L1'] // already booked by Nimal
    })
  });
  if (conflictRes.status !== 409) {
    throw new Error(`Expected 409 conflict for already-booked seat, got ${conflictRes.status}`);
  }
  console.log('✓ PASS: Double-booking prevention returned 409 Conflict.');

  // 3e. Gate Verification - First Scan (Success)
  const firstScanRes = await fetch(`${BASE_URL}/api/gate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      qrPayload: bookingData.booking.ticketToken,
      gateOfficer: 'Main Entrance Gate A'
    })
  });
  const firstScanData = await firstScanRes.json();
  if (!firstScanData.valid || firstScanData.isDuplicate) {
    throw new Error('Gate first scan failed: ' + JSON.stringify(firstScanData));
  }
  console.log(`✓ PASS: Gate First Scan Valid! Attendee admitted: ${firstScanData.guest.fullName}`);

  // 3f. Gate Verification - Duplicate Scan (Fraud Detection)
  const secondScanRes = await fetch(`${BASE_URL}/api/gate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      qrPayload: bookingData.booking.ticketToken,
      gateOfficer: 'Main Entrance Gate A'
    })
  });
  const secondScanData = await secondScanRes.json();
  if (secondScanData.valid !== false || secondScanData.isDuplicate !== true) {
    throw new Error('Gate duplicate scan detection failed! Did not flag duplicate entry.');
  }
  console.log(`✓ PASS: Duplicate Scan flagged immediately! Warning: "${secondScanData.message}"`);

  // 3f-2: Individual Seat Pass Verification (Separate check-ins for each person in a 3-seat booking)
  const separateBookingRes = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Kasun Bandara',
      nic: '198577788899',
      phone: '0714455667',
      institutionRef: 'REF-SEP-101',
      seatIds: ['C-L1', 'C-L2', 'C-L3']
    })
  });
  const sepBookingData = await separateBookingRes.json();
  if (!sepBookingData.success || !sepBookingData.booking.seatTickets || sepBookingData.booking.seatTickets.length !== 3) {
    throw new Error('Expected 3 individual seatTickets for separate pass booking');
  }

  // Check in ONLY Seat 1 (C-L1)
  const seat1Token = sepBookingData.booking.seatTickets[0].ticketToken;
  const scanSeat1Res = await fetch(`${BASE_URL}/api/gate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload: seat1Token, gateOfficer: 'Gate 2' })
  });
  const scanSeat1Data = await scanSeat1Res.json();
  if (!scanSeat1Data.valid || scanSeat1Data.checkedSeat !== 'C-L1') {
    throw new Error('Individual seat 1 scan failed');
  }
  console.log(`✓ PASS: Individual Seat Pass 1 (${scanSeat1Data.checkedSeat}) admitted independently!`);

  // Verify that Seat 1 is checked in, but Seats 2 & 3 are NOT checked in on live map
  const checkSeatsRes = await fetch(`${BASE_URL}/api/seats`);
  const checkSeatsData = await checkSeatsRes.json();
  const cL1 = checkSeatsData.seats.find(s => s.id === 'C-L1');
  const cL2 = checkSeatsData.seats.find(s => s.id === 'C-L2');
  const cL3 = checkSeatsData.seats.find(s => s.id === 'C-L3');
  if (cL1.is_checked_in !== 1 || cL2.is_checked_in !== 0 || cL3.is_checked_in !== 0) {
    throw new Error(`Independent seat check-in state mismatch! C-L1: ${cL1.is_checked_in}, C-L2: ${cL2.is_checked_in}, C-L3: ${cL3.is_checked_in}`);
  }
  console.log('✓ PASS: Live map correctly reflects C-L1 as Checked-In, while C-L2 and C-L3 remain Awaiting Arrival.');

  // Test duplicate scan on Seat 1
  const dupSeat1Res = await fetch(`${BASE_URL}/api/gate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload: seat1Token, gateOfficer: 'Gate 2' })
  });
  const dupSeat1Data = await dupSeat1Res.json();
  if (dupSeat1Data.valid !== false || dupSeat1Data.isDuplicate !== true || dupSeat1Data.seatId !== 'C-L1') {
    throw new Error('Duplicate scan on individual seat 1 was not caught!');
  }
  console.log('✓ PASS: Rescanning Seat 1 pass immediately rejected as duplicate entry.');

  // Now scan Seat 2 (C-L2) - should succeed
  const seat2Token = sepBookingData.booking.seatTickets[1].ticketToken;
  const scanSeat2Res = await fetch(`${BASE_URL}/api/gate/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ qrPayload: seat2Token, gateOfficer: 'Gate 2' })
  });
  const scanSeat2Data = await scanSeat2Res.json();
  if (!scanSeat2Data.valid || scanSeat2Data.checkedSeat !== 'C-L2') {
    throw new Error('Individual seat 2 scan failed');
  }
  console.log(`✓ PASS: Individual Seat Pass 2 (${scanSeat2Data.checkedSeat}) admitted independently at later time!`);

  // 3g. Admin VIP Block / Unblock
  const blockRes = await fetch(`${BASE_URL}/api/admin/block-seats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seatIds: ['B-L1', 'B-L2'],
      action: 'BLOCK'
    })
  });
  const blockData = await blockRes.json();
  if (!blockData.success) throw new Error('Admin block failed');
  console.log('✓ PASS: Admin VIP Block executed successfully.');

  // 3h. Attendees Registry
  const attendeesRes = await fetch(`${BASE_URL}/api/admin/attendees`);
  const attendeesData = await attendeesRes.json();
  if (!attendeesData.success || attendeesData.attendees.length === 0) {
    throw new Error('Admin attendees registry failed');
  }
  const found = attendeesData.attendees.find(a => a.booking_ref === bookingData.booking.bookingRef);
  if (!found || !found.is_checked_in) {
    throw new Error('Attendee registry check-in status mismatch');
  }
  console.log(`✓ PASS: Attendee Registry correctly reflects check-in status: ${found.full_name} (${found.institution_ref}) is Checked In.`);

  // 3i. Live Seat Check-in status & occupancy metrics
  const seatsCheckRes = await fetch(`${BASE_URL}/api/seats`);
  const seatsCheckData = await seatsCheckRes.json();
  const checkedInSeat = seatsCheckData.seats.find(s => s.id === 'A-L1');
  if (!checkedInSeat || !checkedInSeat.is_checked_in) {
    throw new Error('Expected seat A-L1 to have is_checked_in = 1');
  }
  console.log(`✓ PASS: Seat A-L1 correctly reports is_checked_in = 1 with guest "${checkedInSeat.guest_name}"`);
  console.log(`✓ PASS: Live occupancy stats: ${seatsCheckData.stats.checkedInSeats} seats occupied (${seatsCheckData.stats.occupancyRate}% full).`);

  // 3j. Test gate check-in simulation endpoint
  const simRes = await fetch(`${BASE_URL}/api/gate/simulate-checkin`, { method: 'POST' });
  const simData = await simRes.json();
  if (!simData.success) throw new Error('Simulation check-in failed');
  console.log(`✓ PASS: Gate check-in simulation succeeded: ${simData.message}`);

  // 3k. Test Admin Login with Password Protection
  const badLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrongpassword999' })
  });
  if (badLoginRes.status !== 401) {
    throw new Error(`Expected 401 for wrong admin password, got ${badLoginRes.status}`);
  }
  console.log('✓ PASS: Admin login rejected incorrect password with 401 Unauthorized.');

  const goodLoginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'vibhasi@2026' })
  });
  const goodLoginData = await goodLoginRes.json();
  if (!goodLoginData.success) {
    throw new Error('Admin login failed with correct password');
  }
  console.log('✓ PASS: Admin login successfully authenticated with valid password (vibhasi@2026).');

  console.log('\n=========================================');
  console.log('🎉 ALL SYSTEM TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('=========================================\n');
}

runTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
