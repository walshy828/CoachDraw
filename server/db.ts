import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = process.env.DATA_DIR ?? path.resolve('data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(process.env.DB_FILE ?? path.join(dataDir, 'coachdraw.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS drills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Other',
    age_group TEXT NOT NULL DEFAULT '',
    duration_min INTEGER NOT NULL DEFAULT 10,
    tags TEXT NOT NULL DEFAULT '[]',
    rink_view TEXT NOT NULL DEFAULT 'full',
    doc TEXT NOT NULL,
    share_token TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS drills_owner ON drills(owner_id);
`);
