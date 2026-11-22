'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, createAddon } = require('../src/addon');
const { buildSources } = require('../src/sources');
const { createStore } = require('../src/catalog');
const { createApp } = require('../src/server');
const { createStremioSource } = require('../src/sources/stremio');
const silent = { info(){}, warn(){} };
const item = n => ({name:'Channel '+n+'z',country:'BR',ref:{id:String(n)}});

test('A2/A20: manifesto cabe em 6 KiB e preserva os filtros de todas as categorias', () => {
  const manifest = buildManifest();
  assert.ok(Buffer.byteLength(JSON.stringify(manifest)) <= 6144);
  assert.ok(Buffer.byteLength(JSON.stringify(manifest)) <= 8192);
  assert.equal(manifest.catalogs.length,15);
  assert.ok(manifest.catalogs.slice(0,14).every(c => c.extra[0].options.includes('Brasil')));
});
test('A3/A20: iptv-org exige on explícito', () => {
  assert.ok(!buildSources({}).some(s => s.id === 'iptvorg'));
  assert.ok(!buildSources({IPTV_ORG:'off'}).some(s => s.id === 'iptvorg'));
  assert.ok(buildSources({IPTV_ORG:'on'}).some(s => s.id === 'iptvorg'));
});
test('A1: catálogo frio responde 200 sem cache em menos de 2 segundos e build continua', async t => {
  let release;
  const store = createStore([{id:'slow',load:()=>new Promise(resolve => {release=resolve;})}],{log:silent});
  const {app} = createApp({sources:[],store});
  const server = app.listen(0,'127.0.0.1');
  t.after(()=>server.close());
  await new Promise(resolve=>server.once('listening',resolve));
  const start = Date.now();
  const request = fetch(`http://127.0.0.1:${server.address().port}/catalog/tv/tvagg.abertos.json`).then(async res=>({status:res.status,body:await res.json()}));
  let deadline;
  const result = await Promise.race([request,new Promise(resolve=>{deadline=setTimeout(()=>resolve(null),1500);})]);
  clearTimeout(deadline);
  release([]);
  await request;
  assert.ok(result, 'handler aguardou build em vez de responder prontamente');
  assert.equal(result.status,200);
  assert.equal(result.body.cacheMaxAge,0);
  assert.deepEqual(result.body.metas,[]);
  assert.ok(Date.now()-start<2000);
  await store.build();
  assert.equal(store.getStatus().ready,true);
});
test('A14: categoria vazia pronta permanece cacheável', async () => {
  const store = createStore([],{log:silent}); await store.build();
  const result = await createAddon(store,new Map()).get('catalog','tv','tvagg.abertos',{});
  assert.equal(result.cacheMaxAge,1800);
});
test('A4: consultas simultâneas e consecutivas compartilham cache; rebuild invalida', async () => {
  let calls=0;
  const store=createStore([{id:'x',priority:1,load:async()=>[item(1)],streams:async()=>{calls++;return [{url:'https://cdn.example/live'}];}}],{log:silent});
  await store.build(); const id=store.list('outros')[0].id;
  await Promise.all([store.streamsFor(id),store.streamsFor(id)]);
  await store.streamsFor(id);
  assert.equal(calls,1);
  await store.build(); await store.streamsFor(id);
  assert.equal(calls,2);
});
test('A4: cache expira em 90s e descarta a entrada mais antiga após 500', async t => {
  let time=100000; t.mock.method(Date,'now',()=>time);
  const calls=new Map();
  const store=createStore([{id:'x',priority:1,load:async()=>Array.from({length:501},(_,i)=>item(i)),streams:async ref=>{calls.set(ref.id,(calls.get(ref.id)||0)+1); return [{url:'https://cdn.example/'+ref.id}];}}],{log:silent});
  await store.build(); const id=n=>store.list('outros').find(c=>c.members.some(m=>m.ref.id===String(n))).id;
  await store.streamsFor(id(0)); time+=89999; await store.streamsFor(id(0)); assert.equal(calls.get('0'),1);
  time++; await store.streamsFor(id(0)); assert.equal(calls.get('0'),2);
  for(let i=1;i<=500;i++) await store.streamsFor(id(i));
  await store.streamsFor(id(0)); assert.equal(calls.get('0'),3);
});
test('A5: no máximo 8 catálogos e 12 páginas; truncamento gera diagnóstico', async t => {
  const original=global.fetch; const warnings=[]; let requests=0;
  t.after(()=>{global.fetch=original;});
  t.mock.method(console,'warn',message=>warnings.push(message));
  global.fetch=async url=>({ok:true,json:async()=>{
    if(String(url).endsWith('manifest.json')) return {catalogs:Array.from({length:10},(_,i)=>({id:String(i),type:'tv',extra:[{name:'skip'}]}))};
    requests++; return {metas:[{id:String(url),name:'Canal'}]};
  }});
  await createStremioSource({id:'x',manifestUrl:'https://x.example/manifest.json'}).load();
  assert.equal(requests,96);
  assert.ok(warnings.some(s=>/cat.log/i.test(s)));
  assert.ok(warnings.some(s=>/12/.test(s)));
});
test('A17: versão estável no processo e distinta em duas inicializações', () => {
  assert.equal(buildManifest().version,buildManifest().version);
  const code="console.log(require('./src/addon').buildManifest().version)";
  const one=execFileSync(process.execPath,['-e',code],{encoding:'utf8'}).trim();
  const two=execFileSync(process.execPath,['-e',code],{encoding:'utf8'}).trim();
  assert.notEqual(one,two);
  assert.match(one,/^\d+\.\d+\.\d+\+[a-zA-Z0-9.-]+$/);
});
