'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fetchJson } = require('../src/http');
const { withFetch } = require('./fixtures');
const { audit } = require('../scripts/audit-catalog');

test('HTTP limita concorrência e descarta consulta cancelada na fila', async () => {
  const releases = [];
  await withFetch(async () => new Promise(resolve => releases.push(resolve)), async () => {
    const requests = Array.from({ length: 8 }, () => fetchJson('https://test.example'));
    const controller = new AbortController();
    const queued = fetchJson('https://test.example', { signal: controller.signal });
    assert.equal(releases.length, 8);
    controller.abort();
    await assert.rejects(queued, /cancelada/);
    for (const release of releases) release(Response.json({ ok: true }));
    await Promise.all(requests);
    assert.equal(releases.length, 8);
  });
});

test('HTTP rejeita resposta maior que o orçamento', async () => {
  await withFetch(async () => Response.json({ data: 'long' }), async () => {
    await assert.rejects(fetchJson('https://test.example', { maxBytes: 4, retries: 0 }), /limite de bytes/);
  });
});

test('auditoria registra mudança de categoria e país incerto', () => {
  const report = audit([
    { name: 'Arte 1', country: 'BR', categories: ['outros'] },
    { name: 'Arte 1', url: 'https://test.example/private' }
  ]);
  assert.equal(report.changes[0].name, 'Arte 1');
  assert.equal(report.uncertainCountries.length, 1);
  assert.doesNotMatch(JSON.stringify(report), /private/);
});

test('EPG compartilha atualização e conserva o guia após falha remota', async () => {
  const { createSchedule } = require('../src/epg');
  const id = 'tvagg:br:demo';
  let now = Date.parse('2026-11-22T19:00:00Z');
  let calls = 0;
  const schedule = createSchedule(new Map(), 'https://epg.example/guide.json', {
    clock: () => now,
    async fetch() {
      if (++calls > 1) throw new Error('offline');
      return [{ channelId: id, title: 'Jornal', start: '2026-11-22T18:55:00Z', end: '2026-11-22T20:00:00Z' }];
    }
  });
  const [first, second] = await Promise.all([schedule(id), schedule(id)]);
  assert.equal(first.now.title, 'Jornal');
  assert.deepEqual(first, second);
  assert.equal(calls, 1);
  now += 15 * 60 * 1000;
  assert.equal((await schedule(id)).now.title, 'Jornal');
  assert.equal((await schedule(id)).now.title, 'Jornal');
  assert.equal(calls, 2);
});

test('metadados entregam agora e a seguir no endpoint usado pelo Stremio', async () => {
  const { createApp } = require('../src/server');
  const id = 'tvagg:br:demo';
  const now = Date.now();
  const { app, store } = createApp({
    sources: [{ id: 'demo', label: 'Demo', async load() {
      return [{ name: 'Demo', country: 'BR', ref: { id: 'demo' } }];
    } }],
    guide: new Map([[id, [
      { title: 'Jornal', start: now - 60000, end: now + 60000 },
      { title: 'Esporte', start: now + 60000, end: now + 120000 }
    ]]]),
    epgUrl: ''
  });
  await store.build();
  const server = app.listen(0, '127.0.0.1');
  try {
    await require('node:events').once(server, 'listening');
    const response = await fetch(`http://127.0.0.1:${server.address().port}/meta/tv/${id}.json`);
    assert.equal(response.status, 200);
    const { meta } = await response.json();
    assert.match(meta.description, /Agora: Jornal · A seguir: Esporte/);
  } finally {
    server.close();
    server.closeAllConnections();
  }
});
