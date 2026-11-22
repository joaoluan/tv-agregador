'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { cleanName, channelKey } = require('../src/normalize');

test('remove numeração de lista e marcadores de qualidade', () => {
  assert.strictEqual(cleanName('100  Telecine Premium'), 'Telecine Premium');
  assert.strictEqual(cleanName('TV Tem Bauru FHD'), 'TV Tem Bauru');
  assert.strictEqual(cleanName('ESPN 4 HD [Geo-blocked]'), 'ESPN 4');
  assert.strictEqual(cleanName('🔴 Globo SP HD'), 'Globo SP');
});

test('mesmo canal com grafias diferentes gera a mesma chave', () => {
  assert.strictEqual(channelKey('TV Tem Bauru HD'), channelKey('TV Tem Bauru FHD'));
  assert.strictEqual(channelKey('Band News'), channelKey('BandNews HD'));
  assert.strictEqual(channelKey('TC Premium'), channelKey('100  Telecine Premium'));
  assert.strictEqual(channelKey('Rede Globo'), channelKey('Globo'));
  assert.strictEqual(channelKey('Discovery Channel'), channelKey('Discovery HD'));
});

test('casos reais encontrados nas fontes', () => {
  assert.strictEqual(channelKey('Disney Plus 07'), channelKey('Disney Plus 7'));
  assert.strictEqual(channelKey('Globo São Paulo'), channelKey('Globo SP'));
  assert.strictEqual(channelKey('Record Rio'), channelKey('Record RJ'));
  assert.strictEqual(channelKey('Amazon Prime 02'), channelKey('Prime Video 2'));
  assert.strictEqual(channelKey('HBO Max 3'), channelKey('Max 03'));
  assert.strictEqual(channelKey('Investigação Discovery'), channelKey('Discovery ID'));
  assert.strictEqual(channelKey('TV Aparecida'), channelKey('Aparecida'));
  assert.strictEqual(channelKey('CazeTV 1'), channelKey('CazeTV'));
  assert.strictEqual(channelKey('A&E'), channelKey('AE'));
  assert.strictEqual(cleanName('PT SportTV 1'), 'SportTV 1');
});

test('canais diferentes continuam separados', () => {
  assert.notStrictEqual(channelKey('SporTV 2'), channelKey('SporTV 3'));
  assert.notStrictEqual(channelKey('Globo SP'), channelKey('Globo RJ'));
  assert.notStrictEqual(channelKey('A Fazenda 18 - 1'), channelKey('A Fazenda 18 - 2'));
  assert.notStrictEqual(channelKey('ESPN'), channelKey('ESPN 2'));
});
