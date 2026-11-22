'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { categorize } = require('../src/categories');
const { countryFromGroups, countryPredicate } = require('../src/countries');

const cats = (genres, name) => [...(categorize(genres, name) || [])].sort();

test('gêneros das fontes brasileiras viram categorias', () => {
  assert.deepStrictEqual(cats(['Filmes e Séries'], 'AXN'), ['filmes', 'series']);
  assert.deepStrictEqual(cats(['Tv Aberta', 'Desenhos'], 'NTC TV'), ['abertos', 'infantil']);
  assert.deepStrictEqual(cats(['️ ESPN ⚽'], 'ESPN 2'), ['esportes']);
  assert.deepStrictEqual(cats(['Canais Globos Sudeste'], 'Globo SP'), ['abertos']);
  assert.deepStrictEqual(cats(['Notícias'], 'CNN Brasil'), ['noticias']);
  assert.deepStrictEqual(cats(['️ 24H CHAVES'], 'Chaves 24h'), ['canais24h']);
  assert.deepStrictEqual(cats(['A Fazenda 18'], 'A Fazenda 18 - 1'), ['variedades']);
});

test('categorias do iptv-org viram categorias', () => {
  assert.deepStrictEqual(cats(['cooking'], 'BBC Food'), ['culinaria']);
  assert.deepStrictEqual(cats(['general'], 'RTP 1'), ['abertos']);
  assert.deepStrictEqual(cats(['news', 'business'], 'Bloomberg'), ['noticias']);
  assert.deepStrictEqual(cats(['travel', 'lifestyle'], 'Travel XP'), ['estilo']);
});

test('sem gênero útil, usa o nome do canal', () => {
  assert.deepStrictEqual(cats([], 'Food Network'), ['culinaria']);
  assert.deepStrictEqual(cats(['️ 4K'], 'SporTV 4K'), ['esportes']);
  assert.deepStrictEqual(cats([], 'Canal Qualquer'), ['outros']);
});

test('canais 24h ficam só na linha própria', () => {
  assert.deepStrictEqual(cats(['️ 24H CINE ZEROUM'], 'Cine Zero Um 24h'), ['canais24h']);
  assert.deepStrictEqual(cats(['Canais 24h Series'], 'Friends 24h'), ['canais24h']);
  assert.deepStrictEqual(cats(['Canais Reality Shows'], 'BBB'), ['variedades']);
  assert.deepStrictEqual(cats(['Canais Liga Futsal'], 'LNF'), ['esportes']);
});

test('conteúdo adulto, televendas e canais de teste são descartados', () => {
  assert.strictEqual(categorize(['Variedades'], 'Teste HLS Big Buck Bunny'), null);
  assert.strictEqual(categorize(['xxx'], 'Canal X'), null);
  assert.strictEqual(categorize(['Adultos'], 'Canal'), null);
  assert.strictEqual(categorize(['shop'], 'Shoptime'), null);
});

test('país pelo grupo da fonte e filtro de país', () => {
  assert.strictEqual(countryFromGroups(['️ ARGENTINA'], 'BR'), 'AR');
  assert.strictEqual(countryFromGroups(['Portugal'], 'BR'), 'PT');
  assert.strictEqual(countryFromGroups(['Esportes'], 'BR'), 'BR');
  assert.strictEqual(countryPredicate('Portugal')('PT'), true);
  assert.strictEqual(countryPredicate('Internacional (fora do Brasil)')('BR'), false);
  assert.strictEqual(countryPredicate(undefined)('JP'), true);
});
