import { Router } from 'express';
import { requireAuth } from '../auth';
import { db } from '../db';
import { insertDrill, newShareToken, sanitizeDoc, sanitizeMeta, toDrill, type Row } from '../drills';
import { seedDrillsFor } from '../seed';

export const drillsRouter = Router();
drillsRouter.use(requireAuth);

const owned = (id: unknown, uid: number) =>
  db.prepare('SELECT * FROM drills WHERE id = ? AND owner_id = ?').get(Number(id), uid) as Row | undefined;

drillsRouter.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM drills WHERE owner_id = ? ORDER BY updated_at DESC, id DESC').all(req.userId) as Row[];
  res.json(rows.map(toDrill));
});

drillsRouter.post('/', (req, res) => {
  const doc = sanitizeDoc(req.body?.doc);
  if (!doc) return res.status(400).json({ error: 'Invalid drill document' });
  const id = insertDrill(req.userId!, sanitizeMeta(req.body), doc);
  res.status(201).json(toDrill(owned(id, req.userId!)!));
});

drillsRouter.post('/samples', (req, res) => {
  seedDrillsFor(req.userId!);
  const rows = db.prepare('SELECT * FROM drills WHERE owner_id = ? ORDER BY updated_at DESC, id DESC').all(req.userId) as Row[];
  res.json(rows.map(toDrill));
});

drillsRouter.get('/:id', (req, res) => {
  const row = owned(req.params.id, req.userId!);
  if (!row) return res.status(404).json({ error: 'Drill not found' });
  res.json(toDrill(row));
});

drillsRouter.put('/:id', (req, res) => {
  const row = owned(req.params.id, req.userId!);
  if (!row) return res.status(404).json({ error: 'Drill not found' });
  const doc = sanitizeDoc(req.body?.doc);
  if (!doc) return res.status(400).json({ error: 'Invalid drill document' });
  const m = sanitizeMeta(req.body);
  db.prepare(
    `UPDATE drills SET name=?, description=?, notes=?, category=?, age_group=?, duration_min=?, tags=?, rink_view=?, doc=?, updated_at=datetime('now')
     WHERE id = ? AND owner_id = ?`,
  ).run(m.name, m.description, m.notes, m.category, m.ageGroup, m.durationMin, JSON.stringify(m.tags), m.rinkView, JSON.stringify(doc), row.id, req.userId);
  res.json(toDrill(owned(row.id, req.userId!)!));
});

drillsRouter.delete('/:id', (req, res) => {
  const row = owned(req.params.id, req.userId!);
  if (!row) return res.status(404).json({ error: 'Drill not found' });
  db.prepare('DELETE FROM drills WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

drillsRouter.post('/:id/duplicate', (req, res) => {
  const row = owned(req.params.id, req.userId!);
  if (!row) return res.status(404).json({ error: 'Drill not found' });
  const d = toDrill(row);
  const id = insertDrill(req.userId!, { ...d, name: `${d.name} (copy)` }, d.doc);
  res.status(201).json(toDrill(owned(id, req.userId!)!));
});

drillsRouter.post('/:id/share', (req, res) => {
  const row = owned(req.params.id, req.userId!);
  if (!row) return res.status(404).json({ error: 'Drill not found' });
  const token = row.share_token ?? newShareToken();
  db.prepare('UPDATE drills SET share_token = ? WHERE id = ?').run(token, row.id);
  res.json({ shareToken: token });
});

drillsRouter.delete('/:id/share', (req, res) => {
  const row = owned(req.params.id, req.userId!);
  if (!row) return res.status(404).json({ error: 'Drill not found' });
  db.prepare('UPDATE drills SET share_token = NULL WHERE id = ?').run(row.id);
  res.json({ shareToken: null });
});
