'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../src/catalog');
const { createStremioSource } = require('../src/sources/stremio');
const { withFetch } = require('./fixtures');

const log = { info() {}, warn() {}, error() {} };

test('falha no catálogo preserva o último resultado válido', async () => {
  let offline = false;
  await withFetch(async url => {
    if (url.endsWith('/manifest.json')) {
      return { ok: true, json: async () => ({ catalogs: [{ id: 'live', type: 'tv' }] }) };
    }
    return offline ? { ok: false, status: 503 }
      : { ok: true, json: async () => ({ metas: [{ id: 'a', name: 'Canal' }] }) };
  }, async () => {
    const store = createStore([createStremioSource({
      id: 'test', manifestUrl: 'https://test.example/manifest.json'
    })], { log });
    await store.build();
    offline = true;
    await store.build();
    assert.equal(store.getStatus().channels, 1);
    assert.equal(store.getStatus().sources[0].usingPrevious, true);
  });
});

test('falha de todas as fontes não deixa o catálogo pronto', async () => {
  const store = createStore([{ id: 'test', async load() { throw Error('offline'); } }], { log });
  await store.build();
  assert.equal(store.getStatus().ready, false);
});

test('falha transitória de stream pode recuperar na próxima abertura', async () => {
  let calls = 0;
  const store = createStore([{
    id: 'test',
    async load() { return [{ name: 'Canal', ref: { id: 'a' } }]; },
    async streams() {
      if (++calls === 1) throw Error('offline');
      return [{ url: 'https://test.example/live' }];
    }
  }], { log });
  await store.build();
  const [channel] = store.list('outros');
  assert.deepEqual(await store.streamsFor(channel.id), []);
  assert.equal((await store.streamsFor(channel.id)).length, 1);
});
