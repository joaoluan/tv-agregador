'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {createStore}=require('../src/catalog');
const {createApp}=require('../src/server');
const {buildItems,toStremioStream}=require('../src/sources/iptvOrg');
const {withFetch}=require('./fixtures');
const {STREAM_TIMEOUT_MS}=require('../src/http');
const silent={info(){},warn(){}};

test('A6: health responde 503 antes do build e 200 com contagens depois',async t=>{
 const sources=[{id:'x',load:async()=>[{name:'Canal',country:'BR',ref:{id:'1'}}]}];
 const store=createStore(sources,{log:silent});
 const {app}=createApp({sources,store});
 const server=app.listen(0,'127.0.0.1'); t.after(()=>server.close());
 await new Promise(resolve=>server.once('listening',resolve));
 const url=`http://127.0.0.1:${server.address().port}/health`;
 const before=await fetch(url); assert.equal(before.status,503);
 const body=await before.json(); assert.equal(body.ready,false); assert.equal(body.channels,0); assert.equal(body.sources.length,1);
 await store.build(); const after=await fetch(url); assert.equal(after.status,200);
 const ready=await after.json(); assert.equal(ready.ready,true); assert.equal(ready.channels,1); assert.equal(ready.sources[0].ok,true);
});
test('A7: blueprint desliga deploy automático',()=>{
 const blueprint=fs.readFileSync('render.yaml','utf8');
 assert.doesNotMatch(blueprint,/autoDeploy:\s*true/);
 assert.match(blueprint,/autoDeploy:\s*false/);
});
test('A10: membro de fonte removida não derruba streams válidos',async()=>{
 const store=createStore([{id:'x',priority:10,load:async()=>[{name:'Canal',ref:{id:'1'}}],streams:async()=>[{url:'https://cdn.example/live'}]}],{log:silent});
 await store.build(); const channel=store.list('outros')[0];
 channel.members.unshift({sourceId:'missing',ref:{id:'old'}});
 assert.equal((await store.streamsFor(channel.id)).length,1);
});
test('A12: timeout agregado precisa exceder timeout interno Stremio mesmo com cache',async()=>{
 assert.equal(STREAM_TIMEOUT_MS,9000);
 const store=createStore([{id:'x',priority:1,load:async()=>[{name:'Canal',ref:{id:'1'}}],streams:async()=>[]}],{log:silent});
 await store.build(); const id=store.list('outros')[0].id;
 await store.streamsFor(id);
 await assert.rejects(store.streamsFor(id,{timeout:STREAM_TIMEOUT_MS}),RangeError);
 await assert.rejects(store.streamsFor(id,{timeout:NaN}),RangeError);
});
test('A13: iptv-org limita a três links, prioriza qualidade e preserva cabeçalhos',()=>{
 const streams=Array.from({length:10},(_,i)=>({channel:'x',url:'https://cdn.example/'+i,quality:(i+1)*120+'p',user_agent:'VLC',referrer:'https://origin.example'}));
 const [item]=buildItems({channels:[{id:'x',name:'Canal'}],streams,logos:[]});
 assert.equal(item.ref.streams.length,3);
 assert.deepEqual(item.ref.streams.map(s=>s.quality),['1200p','1080p','960p']);
 assert.deepEqual(toStremioStream(item.ref.streams[0]).behaviorHints.proxyHeaders.request,{'User-Agent':'VLC',Referer:'https://origin.example'});
});
test('A16: assert falhando dentro da troca de fetch restaura o original',async()=>{
 const original=global.fetch; const broken=async()=>{throw new Error('offline');};
 try {
  await assert.rejects(withFetch(broken,async()=>{
   assert.equal(global.fetch,broken);
   assert.fail('falha injetada');
  }),/falha injetada/);
  assert.equal(global.fetch,original);
 } finally {global.fetch=original;}
});
test('A19: scripts dev e lint estão configurados',()=>{
 const {scripts,devDependencies}=require('../package.json');
 assert.equal(scripts.dev,'node --watch src/server.js');
 assert.equal(scripts.lint,'eslint src test');
 assert.ok(devDependencies.eslint);
});

test('A7: blueprint de produção fixa main mesmo quando a origem do Blueprint é outra branch',()=>{
 const blueprint=fs.readFileSync('render.yaml','utf8');
 assert.match(blueprint,/branch:\s*main\b/);
});
