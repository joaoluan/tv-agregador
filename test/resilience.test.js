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

test('busca tolera troca de letras e prioriza nome exato', async () => {
  const store = createStore([{ id: 'search', async load() {
    return ['Globo SP HD', 'Globo SP Notícias', 'Globo RJ'].map(name => ({ name, ref: { id: name } }));
  } }], { log });
  await store.build();
  assert.equal(store.search('Globo SP')[0].name, 'Globo SP');
  assert.equal(store.search('Golbo SP')[0].name, 'Globo SP');
});

test('fontes preferidas ganham prioridade sem remover as demais', () => {
  const { buildSources } = require('../src/sources');
  const sources = buildSources({ PREFERRED_SOURCES: 'ntctv,tvvio' });
  assert.deepEqual(sources.slice(0, 2).map(source => source.id), ['ntctv', 'tvvio']);
  assert.ok(sources.some(source => source.id === 'tvplay'));
});

test('programação troca de programa no horário exato', () => {
  const { nowNext } = require('../src/epg');
  const first = { title: 'Primeiro', start: 100, end: 200 };
  const second = { title: 'Segundo', start: 200, end: 300 };
  const guide = new Map([['tvagg:br:demo', [first, second]]]);
  assert.deepEqual(nowNext(guide, 'tvagg:br:demo', 199), { now: first, next: second });
  assert.deepEqual(nowNext(guide, 'tvagg:br:demo', 200), { now: second, next: null });
});
