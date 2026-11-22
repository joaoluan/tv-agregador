'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {setImmediate:flush}=require('node:timers/promises');
const {createStore}=require('../src/catalog');
const log={info(){},warn(){},error(){}};
const item=name=>({name,country:'BR',ref:{id:name}});

test('sem acessos não há atualização periódica; start repetido não duplica trabalho',async t=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout','Date'],now:1000});
 let calls=0;const store=createStore([{id:'x',load:async()=>{calls++;return [item('Canal')];}}],{log,refreshMs:100,retryMs:20});t.after(()=>store.stop());
 store.start();await flush();assert.equal(calls,1);
 store.start();t.mock.timers.tick(1000);await flush();
 assert.equal(calls,1,'não deve consultar fonte por timer nem start repetido');
});
test('acesso após TTL atualiza em segundo plano, mantém índice e compartilha a rodada',async t=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout','Date'],now:1000});
 let calls=0,release;const store=createStore([{id:'x',load:async()=>{calls++;return calls===1?[item('Antigo')]:new Promise(resolve=>{release=resolve;});}}],{log,refreshMs:100});t.after(()=>store.stop());
 await store.build();t.mock.timers.tick(100);
 assert.deepEqual(await Promise.all([store.waitReady(0),store.waitReady(0),store.waitReady(0)]),[true,true,true]);
 assert.equal(calls,2);assert.equal(store.list('outros')[0].name,'Antigo');
 release([item('Novo')]);await store.build();assert.equal(store.list('outros')[0].name,'Novo');assert.equal(calls,2);
});
test('retry é sob demanda e consulta somente fonte que nunca carregou',async t=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout','Date'],now:1000});
 let good=0,bad=0;
 const store=createStore([
 {id:'a',load:async()=>{good++;return [item('A')];}},
 {id:'b',load:async()=>{bad++;if(bad===1)throw Error('offline');return [item('B')];}}
 ],{log,refreshMs:1000,retryMs:50});t.after(()=>store.stop());
 store.start();await flush();t.mock.timers.tick(49);await store.waitReady(0);assert.equal(bad,1);
 t.mock.timers.tick(1);await store.waitReady(0);await store.build();
 assert.equal(good,1);assert.equal(bad,2);assert.equal(store.list('outros').length,2);
});
test('status e store parado não disparam manutenção',async t=>{
 t.mock.timers.enable({apis:['setInterval','setTimeout','Date'],now:1000});
 let calls=0;const store=createStore([{id:'x',load:async()=>{calls++;return [item('Canal')];}}],{log,refreshMs:100});
 await store.build();store.stop();t.mock.timers.tick(1000);store.getStatus();await store.waitReady(0);await flush();assert.equal(calls,1);
});
