'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { categorize } = require('../src/categories');
const { channelKey, normalizeText } = require('../src/normalize');
const { mergeChannels, createStore } = require('../src/catalog');
const { countryPredicate } = require('../src/countries');
const { createStremioSource } = require('../src/sources/stremio');
const { createM3uSource } = require('../src/sources/m3u');
const { STREMIO_ADDONS } = require('../src/sources');

test('A21/A11: canal 1 permanece distinto de canal 2; alias sem número preservado', () => {
  assert.notEqual(channelKey('SporTV 1'), channelKey('SporTV 2'));
  assert.equal(channelKey('CazeTV 1'), channelKey('CazeTV'));
});
test('A15: variation selector isolado é normalizado', () => {
  assert.equal(normalizeText('\uFE0F ARGENTINA'), 'argentina');
  assert.equal(categorize(['\uFE0F HOT'], 'Canal'), null);
});
test('A8: Hot Bird é mantido, HOT como grupo e conteúdo adulto são bloqueados', () => {
  assert.ok(categorize(['Abertos'], 'Hot Bird').has('abertos'));
  assert.ok(categorize(['Hot Bird'], 'Canal'));
  for (const group of ['HOT', 'xxx', 'Adultos', '18+', '+18', 'erotic', 'porn', 'sex']) {
    assert.equal(categorize([group], 'Canal'), null, group);
  }
});
test('A9: item sem país é internacional e não Brasil', () => {
  const channels = mergeChannels([{source:{id:'x'}, items:[{name:'Canal',ref:{id:'1'}}]}]);
  const [channel] = channels.values();
  assert.equal(channel.country, '??');
  assert.equal(countryPredicate('Brasil')(channel.country), false);
  assert.equal(countryPredicate('Internacional (fora do Brasil)')(channel.country), true);
  assert.ok(STREMIO_ADDONS.every(source => source.country === 'BR'));
});
test('A9: fontes genéricas sem país explícito usam desconhecido', async t => {
  const original = global.fetch;
  t.after(() => { global.fetch = original; });
  global.fetch = async url => ({ok:true, json:async()=>String(url).endsWith('manifest.json')
    ? {catalogs:[{id:'all',type:'tv'}]}
    : {metas:[{id:'1',name:'Canal'}]}, text:async()=> '#EXTM3U\n#EXTINF:-1,Canal\nhttps://cdn.example/live\n'});
  const stremio = createStremioSource({id:'x',manifestUrl:'https://x.example/manifest.json'});
  assert.equal((await stremio.load())[0].country, '??');
  const m3u = createM3uSource({id:'m',url:'https://m.example/list'});
  assert.equal((await m3u.load())[0].country, '??');
});
test('A18: referência repetida da mesma fonte gera uma consulta, fontes distintas preservadas', async () => {
  let calls = 0;
  const item = {name:'Canal',country:'BR',ref:{id:'same'}};
  const sources = ['a','b'].map(id => ({id,priority:1,load:async()=>[item,{...item}],streams:async()=>{calls++;return [{url:'https://cdn.example/'+id}];}}));
  const store = createStore(sources,{log:{info(){},warn(){}}});
  await store.build();
  const [channel] = store.list('outros');
  assert.equal(channel.members.length, 2);
  assert.equal((await store.streamsFor(channel.id)).length, 2);
  assert.equal(calls, 2);
});
