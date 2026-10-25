import cookieParser from 'cookie-parser';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { authRouter } from './auth';
import { db } from './db';
import { toDrill, type Row } from './drills';
import { drillsRouter } from './routes/drills';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  // request bodies must be JSON; together with SameSite=Lax cookies this blocks cross-site form posts
  app.use('/api', (req, res, next) => {
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0;
    if (hasBody && !req.is('json')) return res.status(415).json({ error: 'JSON required' });
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/drills', drillsRouter);

  app.get('/api/shared/:token', (req, res) => {
    const row = db.prepare('SELECT * FROM drills WHERE share_token = ?').get(req.params.token) as Row | undefined;
    if (!row) return res.status(404).json({ error: 'This shared drill is no longer available' });
    const d = toDrill(row);
    res.json({ ...d, id: 0, shareToken: null });
  });

  const webDir = path.resolve(process.env.WEB_DIR ?? 'dist/web');
  if (fs.existsSync(webDir)) {
    app.use(express.static(webDir, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(webDir, 'index.html')));
  }
  return app;
}

if (process.env.VITEST === undefined) {
  const port = Number(process.env.PORT ?? 3000);
  createApp().listen(port, () => console.log(`CoachDraw listening on :${port}`));
}
