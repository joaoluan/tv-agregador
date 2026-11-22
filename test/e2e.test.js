'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { tvplay, ntc, iptvOrg, withFetch } = require('./fixtures');
const { createStremioSource } = require('../src/sources/stremio');
const { createIptvOrgSource } = require('../src/sources/iptvOrg');
const { createStore } = require('../src/catalog');
const { createApp } = require('../src/server');

const TVPLAY = 'https://tvplay.example';
const NTC = 'https://ntc.example/ntctv';
const realFetch = global.fetch;

function json(data) {
  return { ok: true, status: 200, json: async () => data, text: async () => JSON.stringify(data) };
}

function fakeFetch(url) {
  const u = String(url);
  if (u.startsWith('http://127.0.0.1')) {
    return realFetch(url);
  }
  if (u === `${TVPLAY}/manifest.json`) return Promise.resolve(json(tvplay.manifest));
  if (u === `${NTC}/manifest.json`) return Promise.resolve(json(ntc.manifest));
  let m = u.match(/^https:\/\/tvplay\.example\/catalog\/tv\/([^/]+?)(\/skip=(\d+))?\.json$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    return Promise.resolve(json({ metas: m[3] ? [] : (tvplay.catalogs[id] || []) }));
  }
  m = u.match(/^https:\/\/ntc\.example\/ntctv\/catalog\/tv\/ntctv-live(\/skip=(\d+))?\.json$/);
  if (m) {
    const page = (Number(m[2]) || 0) / 2;
    return Promise.resolve(json({ metas: ntc.pages[page] || [] }));
  }
  m = u.match(/^https:\/\/tvplay\.example\/stream\/tv\/(.+)\.json$/);
  if (m) return Promise.resolve(json({ streams: tvplay.streams[decodeURIComponent(m[1])] || [] }));
  m = u.match(/^https:\/\/ntc\.example\/ntctv\/stream\/tv\/(.+)\.json$/);
  if (m) return Promise.resolve(json({ streams: ntc.streams[decodeURIComponent(m[1])] || [] }));
  if (u.endsWith('/api/channels.json')) return Promise.resolve(json(iptvOrg.channels));
  if (u.endsWith('/api/streams.json')) return Promise.resolve(json(iptvOrg.streams));
  if (u.endsWith('/api/logos.json')) return Promise.resolve(json(iptvOrg.logos));
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
}

test('agregador de ponta a ponta', async (t) => {
  global.fetch = fakeFetch;
  t.after(() => {
    global.fetch = realFetch;
  });

  const sources = [
    createStremioSource({ id: 'tvplay', label: 'TVPlay', manifestUrl: `${TVPLAY}/manifest.json`, country: 'BR', priority: 10 }),
    createStremioSource({ id: 'ntctv', label: 'NTC TV', manifestUrl: `${NTC}/manifest.json`, country: 'BR', priority: 30 }),
    createIptvOrgSource({ priority: 90 })
  ];
  const silent = { info() {}, warn() {}, error() {} };
  const store = createStore(sources, { log: silent });
  const { app } = createApp({ sources, store });
  await store.build();

  const server = app.listen(0);
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}`;
  const get = async (path) => (await realFetch(base + path)).json();

  await t.test('manifesto tem uma linha por categoria e busca', async () => {
    const manifest = await get('/manifest.json');
    const ids = manifest.catalogs.map((c) => c.id);
    assert.ok(ids.includes('tvagg.esportes'));
    assert.ok(ids.includes('tvagg.culinaria'));
    assert.ok(ids.includes('tvagg.busca'));
    assert.deepStrictEqual(manifest.idPrefixes, ['tvagg:']);
  });

  await t.test('ESPN 2 aparece uma vez só, juntando 3 fontes', async () => {
    const { metas } = await get('/catalog/tv/tvagg.esportes.json');
    const espn = metas.filter((m) => /espn 2/i.test(m.name));
    assert.strictEqual(espn.length, 1);
    assert.strictEqual(espn[0].id, 'tvagg:br:espn2');
    assert.strictEqual(metas[0].id, 'tvagg:br:espn2', 'canal com mais fontes vem primeiro');
  });

  await t.test('canal adulto da fonte não entra em lugar nenhum', async () => {
    const status = await get('/status');
    const total = status.categories.reduce((n, c) => n + c.channels, 0);
    const all = [];
    for (const c of status.categories) {
      const { metas } = await get(`/catalog/tv/tvagg.${c.id}.json`);
      all.push(...metas);
    }
    assert.ok(total > 0);
    assert.ok(!all.some((m) => /hot|adult/i.test(m.name)));
    assert.ok(!all.some((m) => /autenticado/i.test(m.name)), 'aviso de login não vira canal');
  });

  await t.test('filtro de país separa os internacionais', async () => {
    const pt = await get(`/catalog/tv/tvagg.abertos/genre=${encodeURIComponent('Portugal')}.json`);
    assert.deepStrictEqual(pt.metas.map((m) => m.name), ['RTP 1']);
    const intl = await get(`/catalog/tv/tvagg.esportes/genre=${encodeURIComponent('Internacional (fora do Brasil)')}.json`);
    assert.deepStrictEqual(intl.metas.map((m) => m.name), ['TyC Sports']);
    const food = await get('/catalog/tv/tvagg.culinaria.json');
    assert.deepStrictEqual(food.metas.map((m) => m.name), ['BBC Food']);
  });

  await t.test('ao abrir o canal, mostra links de todas as fontes na ordem', async () => {
    const { streams } = await get('/stream/tv/tvagg:br:espn2.json');
    assert.deepStrictEqual(streams.map((s) => s.name), ['📺 TVPlay', '📺 NTC TV', '📺 iptv-org', '📺 TVPlay']);
    assert.ok(streams[3].externalUrl, 'link externo vai para o fim');
    assert.deepStrictEqual(streams[1].behaviorHints.proxyHeaders, { request: { Referer: 'https://ntc.example' } });
  });

  await t.test('link do iptv-org leva os cabeçalhos exigidos', async () => {
    const { streams } = await get('/stream/tv/tvagg:gb:bbcfood.json');
    assert.strictEqual(streams.length, 1);
    assert.deepStrictEqual(streams[0].behaviorHints.proxyHeaders, { request: { 'User-Agent': 'Mozilla/5.0' } });
    assert.match(streams[0].title, /Geo-blocked/);
  });

  await t.test('página do canal lista fontes e categorias', async () => {
    const { meta } = await get('/meta/tv/tvagg:br:espn2.json');
    assert.match(meta.description, /3 fonte\(s\): TVPlay, NTC TV, iptv-org/);
    assert.ok(meta.genres.includes('Esportes'));
  });

  await t.test('busca encontra canais', async () => {
    const { metas } = await get('/catalog/tv/tvagg.busca/search=globo.json');
    assert.deepStrictEqual(metas.map((m) => m.name), ['Globo SP']);
  });

  await t.test('fonte fora do ar não derruba as outras', async () => {
    await withFetch((url) => (String(url).startsWith(TVPLAY) ? Promise.reject(new Error('offline')) : fakeFetch(url)), async () => {
      await store.build();
      const status = await get('/status');
      const tv = status.sources.find((s) => s.id === 'tvplay');
      assert.strictEqual(tv.ok, false);
      assert.strictEqual(tv.usingPrevious, true);
      const { metas } = await get('/catalog/tv/tvagg.esportes.json');
      assert.strictEqual(metas[0].id, 'tvagg:br:espn2');
    });
  });
});
