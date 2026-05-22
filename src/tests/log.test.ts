import request from 'supertest';
import app from '../index';
import { prisma } from '../db/client';
import { computeHash } from '../lib/hasher';

const KEY = process.env.API_KEY || 'potens-dev-key-change-in-production';
const auth = { 'x-api-key': KEY };

describe('Tamper-Evident Log Service', () => {
  beforeEach(async () => {
    await prisma.logEntry.deleteMany();
  });

  test('computeHash produces consistent SHA-256', () => {
    const h1 = computeHash('0', 'alice', 'login', { ip: '1.2.3.4' }, '2026-01-01T00:00:00.000Z');
    const h2 = computeHash('0', 'alice', 'login', { ip: '1.2.3.4' }, '2026-01-01T00:00:00.000Z');
    expect(h1).toHaveLength(64);
    expect(h1).toMatch(/^[a-f0-9]+$/);
    expect(h1).toBe(h2);
  });

  test('computeHash is payload-key-order independent', () => {
    const h1 = computeHash('0', 'a', 'b', { x: 1, y: 2 }, 't');
    const h2 = computeHash('0', 'a', 'b', { y: 2, x: 1 }, 't');
    expect(h1).toBe(h2);
  });

  test('POST /log rejects missing actor', async () => {
    const res = await request(app).post('/log').set(auth).send({ action: 'a', payload: {} });
    expect(res.status).toBe(400);
  });

  test('POST /log without API key returns 401', async () => {
    const res = await request(app).post('/log').send({ actor: 'a', action: 'b', payload: {} });
    expect(res.status).toBe(401);
  });

  test('consecutive entries chain via previousHash', async () => {
    const r1 = await request(app)
      .post('/log').set(auth)
      .send({ actor: 'alice', action: 'create', payload: { id: 1 } });
    expect(r1.status).toBe(201);
    expect(r1.body.previousHash).toBe('0');

    const r2 = await request(app)
      .post('/log').set(auth)
      .send({ actor: 'bob', action: 'update', payload: { id: 1 } });
    expect(r2.status).toBe(201);
    expect(r2.body.previousHash).toBe(r1.body.currentHash);
  });

  test('GET /verify returns pass on untampered chain', async () => {
    await request(app).post('/log').set(auth).send({ actor: 'alice', action: 'x', payload: {} });
    await request(app).post('/log').set(auth).send({ actor: 'bob', action: 'y', payload: {} });
    const res = await request(app).get('/verify').set(auth);
    expect(res.body.status).toBe('pass');
  });

  test('GET /verify detects direct DB mutation', async () => {
    const r1 = await request(app)
      .post('/log').set(auth)
      .send({ actor: 'alice', action: 'create', payload: {} });
    const r2 = await request(app)
      .post('/log').set(auth)
      .send({ actor: 'alice', action: 'create', payload: {} });

    await prisma.logEntry.update({
      where: { id: r2.body.id },
      data: { action: 'tampered_action' },
    });

    const res = await request(app).get('/verify').set(auth);
    expect(res.body.status).toBe('fail');
    expect(res.body.broken_id).toBe(r2.body.id);
    expect(res.body.reason).toBe('hash_mismatch');
  });

  test('GET /log/:id returns entry with verification block', async () => {
    const post = await request(app)
      .post('/log').set(auth)
      .send({ actor: 'alice', action: 'create', payload: {} });
    const get = await request(app).get(`/log/${post.body.id}`).set(auth);
    expect(get.status).toBe(200);
    expect(get.body.verification.overall).toBe('valid');
    expect(get.body.verification.selfHashValid).toBe(true);
  });

  test('GET /export filters by actor', async () => {
    await request(app).post('/log').set(auth).send({ actor: 'alice', action: 'a', payload: {} });
    await request(app).post('/log').set(auth).send({ actor: 'bob', action: 'b', payload: {} });
    const res = await request(app).get('/export?actor=alice').set(auth);
    expect(res.body.entries.length).toBe(1);
    expect(res.body.entries[0].actor).toBe('alice');
  });
});