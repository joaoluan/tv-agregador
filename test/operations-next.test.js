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
