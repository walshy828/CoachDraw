import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { Router, type NextFunction, type Request, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { db } from './db';
import { seedDrillsFor } from './seed';

const SECRET = process.env.SESSION_SECRET ?? crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET not set: sessions will reset on restart. Set it in .env for production.');
}
const COOKIE = 'cd_token';
const MAX_AGE = 14 * 24 * 3600 * 1000;

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
}

const publicUser = (u: UserRow) => ({ id: u.id, email: u.email, name: u.name });

function setSession(res: Response, uid: number) {
  const token = jwt.sign({ uid }, SECRET, { expiresIn: '14d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: MAX_AGE,
  });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.[COOKIE];
    const payload = jwt.verify(token, SECRET) as { uid: number };
    const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.uid);
    if (!exists) throw new Error('no user');
    req.userId = payload.uid;
    next();
  } catch {
    res.status(401).json({ error: 'Not signed in' });
  }
}

export const authRouter = Router();

authRouter.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Number(process.env.AUTH_RATE_LIMIT ?? 50),
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/me',
  }),
);

authRouter.post('/register', (req, res) => {
  const { email, password, name } = req.body ?? {};
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  const mail = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(mail)) {
    return res.status(409).json({ error: 'An account with that email already exists' });
  }
  const display = typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : mail.split('@')[0];
  const info = db
    .prepare('INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)')
    .run(mail, display, bcrypt.hashSync(password, 10));
  const uid = Number(info.lastInsertRowid);
  seedDrillsFor(uid);
  setSession(res, uid);
  res.status(201).json({ id: uid, email: mail, name: display });
});

authRouter.post('/login', (req, res) => {
  const { email, password } = req.body ?? {};
  const user =
    typeof email === 'string'
      ? (db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase()) as UserRow | undefined)
      : undefined;
  // compare against a dummy hash when the user is unknown so timing does not reveal accounts
  const hash = user?.password_hash ?? '$2a$10$7EqJtq98hPqEX7fNZaFWoOhi5BTzAVHgK1x9Ra7y0uZb0u3m2k5Wy';
  const ok = typeof password === 'string' && bcrypt.compareSync(password, hash);
  if (!user || !ok) return res.status(401).json({ error: 'Incorrect email or password' });
  setSession(res, user.id);
  res.json(publicUser(user));
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId) as UserRow;
  res.json(publicUser(user));
});
