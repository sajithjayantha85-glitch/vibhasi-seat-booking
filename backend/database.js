import { createClient } from '@libsql/client';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'suhurupaya_seats.db');

// Connect to Turso Cloud if credentials provided, otherwise local SQLite file
const databaseUrl = process.env.TURSO_DATABASE_URL || `file:${DB_PATH}`;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

console.log(`Database connecting to: ${databaseUrl.startsWith('file:') ? 'Local SQLite file' : 'Turso Cloud Database'}`);

export const client = createClient({
  url: databaseUrl,
  authToken: authToken
});

export const db = {
  client,
  async get(sql, args = []) {
    const res = await client.execute({ sql, args });
    return res.rows[0] || null;
  },
  async all(sql, args = []) {
    const res = await client.execute({ sql, args });
    return res.rows;
  },
  async run(sql, args = []) {
    return await client.execute({ sql, args });
  },
  async exec(sql) {
    return await client.execute(sql);
  },
  async batch(statements, mode = 'write') {
    return await client.batch(statements, mode);
  }
};

/**
 * Exact Custom Seating Configuration for Suhurupaya Auditorium (21 Rows: A-H, J-T, U, V; 504 Seats)
 */
export const AUDITORIUM_CONFIG = [
  // Upper Flared Section (Rows A - H)
  { rowLabel: 'A', rowIndex: 1, leftSeats: 11, rightSeats: 11 }, // 22
  { rowLabel: 'B', rowIndex: 2, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'C', rowIndex: 3, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'D', rowIndex: 4, leftSeats: 13, rightSeats: 13 }, // 26
  { rowLabel: 'E', rowIndex: 5, leftSeats: 13, rightSeats: 13 }, // 26
  { rowLabel: 'F', rowIndex: 6, leftSeats: 14, rightSeats: 14 }, // 28
  { rowLabel: 'G', rowIndex: 7, leftSeats: 14, rightSeats: 14 }, // 28
  { rowLabel: 'H', rowIndex: 8, leftSeats: 15, rightSeats: 15 }, // 30 (widest flared row)

  // Lower Main Section (Rows J - T: 12 seats each side)
  { rowLabel: 'J', rowIndex: 9, leftSeats: 12, rightSeats: 12 },  // 24
  { rowLabel: 'K', rowIndex: 10, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'L', rowIndex: 11, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'M', rowIndex: 12, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'N', rowIndex: 13, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'O', rowIndex: 14, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'P', rowIndex: 15, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'Q', rowIndex: 16, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'R', rowIndex: 17, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'S', rowIndex: 18, leftSeats: 12, rightSeats: 12 }, // 24
  { rowLabel: 'T', rowIndex: 19, leftSeats: 12, rightSeats: 12 }, // 24

  // Rear Section near Entrance (Rows U, V - Last Row)
  { rowLabel: 'U', rowIndex: 20, leftSeats: 10, rightSeats: 10 }, // 20
  { rowLabel: 'V', rowIndex: 21, leftSeats: 6, rightSeats: 6 },   // 12 (Last Row)
];

// Define Schema
export async function initDatabase() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS seats (
      id TEXT PRIMARY KEY,
      row_label TEXT NOT NULL,
      row_index INTEGER NOT NULL,
      block TEXT NOT NULL,
      seat_num INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE',
      booking_id TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_ref TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      nic TEXT NOT NULL,
      phone TEXT NOT NULL,
      institution_ref TEXT NOT NULL,
      seat_ids TEXT NOT NULL,
      seat_count INTEGER NOT NULL,
      ticket_token TEXT NOT NULL,
      seat_tickets TEXT,
      ip_address TEXT,
      status TEXT DEFAULT 'CONFIRMED',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS check_ins (
      id TEXT PRIMARY KEY,
      booking_id TEXT NOT NULL,
      booking_ref TEXT NOT NULL,
      seat_id TEXT,
      guest_name TEXT NOT NULL,
      nic TEXT NOT NULL,
      institution_ref TEXT NOT NULL,
      seat_ids TEXT NOT NULL,
      seat_count INTEGER NOT NULL,
      checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      gate_officer TEXT DEFAULT 'Main Gate 1'
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS admin_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Ensure migrations for existing DB
  try { await db.exec(`ALTER TABLE check_ins ADD COLUMN seat_id TEXT;`); } catch (e) {}
  try { await db.exec(`ALTER TABLE bookings ADD COLUMN seat_tickets TEXT;`); } catch (e) {}
  try { await db.exec(`ALTER TABLE bookings ADD COLUMN ip_address TEXT;`); } catch (e) {}

  await seedSeatsIfEmpty();
}

async function seedSeatsIfEmpty() {
  const countRow = await db.get('SELECT count(*) as count FROM seats');
  if (countRow && Number(countRow.count) > 0) {
    return;
  }

  console.log('Seeding Suhurupaya Auditorium 504-seat layout into Database...');
  const batchStatements = [];

  for (const row of AUDITORIUM_CONFIG) {
    // Left Block: seat_num 1 (aisle) to leftSeats (wall)
    for (let s = 1; s <= row.leftSeats; s++) {
      const id = `${row.rowLabel}-L${s}`;
      batchStatements.push({
        sql: `INSERT INTO seats (id, row_label, row_index, block, seat_num, status) VALUES (?, ?, ?, ?, ?, 'AVAILABLE')`,
        args: [id, row.rowLabel, row.rowIndex, 'LEFT', s]
      });
    }
    // Right Block: seat_num 1 (aisle) to rightSeats (wall)
    for (let s = 1; s <= row.rightSeats; s++) {
      const id = `${row.rowLabel}-R${s}`;
      batchStatements.push({
        sql: `INSERT INTO seats (id, row_label, row_index, block, seat_num, status) VALUES (?, ?, ?, ?, ?, 'AVAILABLE')`,
        args: [id, row.rowLabel, row.rowIndex, 'RIGHT', s]
      });
    }
  }

  // Insert in chunks of 100 for safety across networks
  for (let i = 0; i < batchStatements.length; i += 100) {
    const chunk = batchStatements.slice(i, i + 100);
    await db.batch(chunk, 'write');
  }

  console.log('Suhurupaya Auditorium layout successfully initialized.');
}
