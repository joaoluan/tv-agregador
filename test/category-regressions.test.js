'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {categorize}=require('../src/categories');
const {mergeChannels}=require('../src/catalog');
const {createStremioSource}=require('../src/sources/stremio');
const cats=(groups,name)=>[...(categorize(groups,name)||[])].sort();

test('etiqueta de fonte [F1] não transforma igreja ou rádio em esporte',()=>{
 assert.deepEqual(cats(['PORTUGAL'],'[F1] Maná Igreja Online {hd}'),['religiosos']);
 assert.deepEqual(cats(['PORTUGAL'],'[F1] Rádio Sines {hd}'),['musica']);
 assert.deepEqual(cats(['PORTUGAL'],'[F1] Kuriakos Music {hd}'),['musica']);
 assert.deepEqual(cats([],'F1'),['esportes']);
});
test('identidade religiosa prevalece sobre grupo culinária errado sem liberar conteúdo bloqueado',()=>{
 assert.deepEqual(cats(['Culinária'],'Canção Nova HD'),['religiosos']);
 assert.deepEqual(cats(['Culinária'],'Maná Igreja Online'),['religiosos']);
 assert.deepEqual(cats(['Filmes'],'Igreja Universal'),['religiosos']);
 assert.equal(categorize(['XXX'],'Canção Nova'),null);
 assert.equal(categorize([],'Globo [XXX]'),null);
});
test('marcas temáticas não herdam categorias incompatíveis de uma fonte',()=>{
 for(const [name,groups,want] of [
  ['GNT',['Filmes e Séries'],['variedades']],
  ['Band RJ',['Abertos','Noticias'],['abertos']],
  ['HGTV',['Filmes e Séries'],['estilo']],
  ['MTV',['Abertos'],['musica','variedades']],
  ['Multishow',['Abertos'],['musica','variedades']],
  ['Telecine Premium',['Filmes e Séries'],['filmes']],
  ['Discovery Kids',['Documentários'],['infantil']],
  ['Adult Swim',['Infantil'],['series','variedades']],
  ['BBC Earth',['Notícias'],['documentarios']],
  ['Cine Premiere',[],['filmes']],
  ['Brasileirao Serie A',['Filmes'],['esportes']],
  ['Copa do Brasil 2',['Filmes'],['esportes']],
  ['Sabor & Arte',['Variedades'],['culinaria','variedades']]
 ])assert.deepEqual(cats(groups,name),want,name);
 assert.deepEqual(cats(['Filmes e Séries'],'AXN'),['filmes','series']);
 assert.deepEqual(cats([],'Studio Universal'),['filmes']);
 assert.deepEqual(cats(['Filmes e Séries'],'Universal TV'),['filmes','series']);
});
test('24h é exclusivo pelo nome e continua exclusivo após juntar fontes',()=>{
 assert.deepEqual(cats(['Variedades','Infantil'],'24H Dragon Ball Z'),['canais24h']);
 const items=groups=>({source:{id:groups[0]},items:[{name:'Chaves',country:'BR',groups,ref:{id:'c'}}]});
 const [channel]=mergeChannels([items(['24H']),items(['Variedades'])]).values();
 assert.deepEqual([...channel.categories],['canais24h']);
});
test('grupo do catálogo é fallback; país e bloqueios do catálogo são preservados',async t=>{
 const old=global.fetch;t.after(()=>{global.fetch=old;});
 global.fetch=async url=>({ok:true,json:async()=>String(url).endsWith('manifest.json')?{name:'Fonte',catalogs:[{id:'a',type:'tv',name:'Filmes Portugal'},{id:'b',type:'tv',name:'XXX'}]}:{metas:String(url).includes('/a.json')?[{id:'x',name:'Canal Z',genres:['Esportes']}]:[{id:'y',name:'Canção Nova',genres:['Religiosos']}]} });
 const items=await createStremioSource({id:'x',manifestUrl:'https://x.example/manifest.json'}).load();
 const item=items.find(i=>i.ref.id==='x');
 assert.deepEqual(cats(item.groups,item.name),['esportes']);
 assert.equal(item.country,'PT');
 const blocked=items.find(i=>i.ref.id==='y');assert.equal(categorize(blocked.groups,blocked.name),null);
});
