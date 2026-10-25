import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let app: import('express').Express;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coachdraw-test-'));

beforeAll(async () => {
  process.env.DATA_DIR = dir;
  process.env.SESSION_SECRET = 'test-secret';
  process.env.AUTH_RATE_LIMIT = '1000';
  const mod = await import('../server/index');
  app = mod.createApp();
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const doc = {
  tokens: [{ id: 't1', kind: 'player', label: 'C', team: 'off', x: 10, y: 10 }],
  paths: [],
  steps: [{ id: 's1', title: 'Step 1', caption: '' }],
  colors: { off: '#f2b705', def: '#d62839' },
};

async function signUp(email: string) {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/register').send({ email, password: 'password123', name: 'Coach' });
  expect(res.status).toBe(201);
  return agent;
}

describe('api', () => {
  it('requires auth', async () => {
    expect((await request(app).get('/api/drills')).status).toBe(401);
  });

  it('registers with sample drills, persists edits, and isolates users', async () => {
    const a = await signUp('a@example.com');
    const b = await signUp('b@example.com');

    const list = await a.get('/api/drills');
    expect(list.body.length).toBe(7);

    const created = await a.post('/api/drills').send({ name: 'My drill', doc });
    expect(created.status).toBe(201);
    const id = created.body.id;

    const upd = await a.put(`/api/drills/${id}`).send({ name: 'Renamed', notes: 'n', rinkView: 'half-right', doc });
    expect(upd.body.name).toBe('Renamed');
    expect(upd.body.rinkView).toBe('half-right');

    expect((await b.get(`/api/drills/${id}`)).status).toBe(404);
    expect((await b.put(`/api/drills/${id}`).send({ name: 'x', doc })).status).toBe(404);
    expect((await b.delete(`/api/drills/${id}`)).status).toBe(404);
    expect((await b.get('/api/drills')).body.every((d: { id: number }) => d.id !== id)).toBe(true);
  });

  it('rejects bad logins and short passwords', async () => {
    await signUp('c@example.com');
    expect((await request(app).post('/api/auth/login').send({ email: 'c@example.com', password: 'nope' })).status).toBe(401);
    expect((await request(app).post('/api/auth/register').send({ email: 'd@example.com', password: 'short' })).status).toBe(400);
    expect((await request(app).post('/api/auth/register').send({ email: 'c@example.com', password: 'password123' })).status).toBe(409);
  });

  it('shares read-only via token and can stop sharing', async () => {
    const a = await signUp('e@example.com');
    const d = (await a.post('/api/drills').send({ name: 'Shared', doc })).body;
    const { shareToken } = (await a.post(`/api/drills/${d.id}/share`)).body;
    const pub = await request(app).get(`/api/shared/${shareToken}`);
    expect(pub.status).toBe(200);
    expect(pub.body.name).toBe('Shared');
    expect(pub.body.shareToken).toBeNull();
    await a.delete(`/api/drills/${d.id}/share`);
    expect((await request(app).get(`/api/shared/${shareToken}`)).status).toBe(404);
  });

  it('duplicates and deletes', async () => {
    const a = await signUp('f@example.com');
    const d = (await a.post('/api/drills').send({ name: 'Orig', doc })).body;
    const copy = await a.post(`/api/drills/${d.id}/duplicate`);
    expect(copy.body.name).toBe('Orig (copy)');
    expect((await a.delete(`/api/drills/${copy.body.id}`)).status).toBe(200);
  });

  it('rejects malformed documents', async () => {
    const a = await signUp('g@example.com');
    expect((await a.post('/api/drills').send({ name: 'bad', doc: { tokens: 1 } })).status).toBe(400);
  });
});
