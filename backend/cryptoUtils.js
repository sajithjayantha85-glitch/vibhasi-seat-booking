import crypto from 'node:crypto';

const SECRET_KEY = process.env.TICKET_SECRET_KEY || 'suhurupaya-auditorium-secure-ticket-key-2026';

/**
 * Generate a simplified, high-speed scan tamper-proof token for an E-Ticket seat pass
 * Produces a concise string (~35-40 chars) which creates a low-density, fast-scanning QR code.
 */
export function generateTicketToken(payload) {
  // 1. Compact fast-scan format for individual seat passes
  if (payload && payload.bookingRef && payload.seatId) {
    const dataStr = `${payload.bookingRef}:${payload.seatId}`;
    const sig = crypto.createHmac('sha256', SECRET_KEY).update(dataStr).digest('hex').substring(0, 16);
    return `VIB1:${payload.bookingRef}:${payload.seatId}:${sig}`;
  }

  // 2. Compact fast-scan format for master booking
  if (payload && payload.bookingRef && !payload.seatId) {
    const dataStr = `${payload.bookingRef}:ALL`;
    const sig = crypto.createHmac('sha256', SECRET_KEY).update(dataStr).digest('hex').substring(0, 16);
    return `VIB1:${payload.bookingRef}:ALL:${sig}`;
  }

  // 3. Fallback for custom objects
  const data = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data: payload, sig: signature })).toString('base64url');
}

/**
 * Verify a ticket token from QR code scan
 */
export function verifyTicketToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Empty or invalid ticket token format' };
  }

  const cleanToken = token.trim();

  // 1. Check compact format: VIB1:BOOKING_REF:SEAT_ID:SIG
  if (cleanToken.startsWith('VIB1:')) {
    const parts = cleanToken.split(':');
    if (parts.length === 4) {
      const [, bookingRef, seatIdOrAll, sig] = parts;
      const dataStr = `${bookingRef}:${seatIdOrAll}`;
      const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(dataStr).digest('hex').substring(0, 16);
      if (sig === expectedSig) {
        return {
          valid: true,
          payload: {
            bookingRef,
            seatId: seatIdOrAll === 'ALL' ? null : seatIdOrAll
          }
        };
      }
      return { valid: false, error: 'Cryptographic signature mismatch! Ticket is tampered or counterfeit.' };
    }
  }

  // 2. Check JSON Base64url format (legacy / full-payload format)
  try {
    const raw = Buffer.from(cleanToken, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.data || !parsed.sig) {
      return { valid: false, error: 'Malformed ticket token' };
    }
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(JSON.stringify(parsed.data)).digest('hex');
    if (parsed.sig !== expectedSig) {
      return { valid: false, error: 'Cryptographic signature mismatch! Ticket is tampered or counterfeit.' };
    }
    return { valid: true, payload: parsed.data };
  } catch (err) {
    return { valid: false, error: 'Unable to decode ticket token: ' + err.message };
  }
}
