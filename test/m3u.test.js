'use strict';

const test = require('node:test');
const assert = require('node:assert');
const { parseM3u } = require('../src/sources/m3u');
const { m3uFromEnv } = require('../src/sources');

const sample = `#EXTM3U
#EXTINF:-1 tvg-logo="https://logo.example/globo.png" group-title="Abertos",Globo SP HD
https://m3u.example/globo1.m3u8
#EXTINF:-1 group-title="Abertos",Globo SP HD
#EXTVLCOPT:http-user-agent=VLC/3.0
https://m3u.example/globo2.m3u8
#EXTINF:-1 tvg-country="AR" group-title="Deportes",TyC Sports
https://m3u.example/tyc.m3u8
`;

test('lê lista M3U e junta links do mesmo canal', () => {
  const items = parseM3u(sample, 'BR');
  assert.strictEqual(items.length, 2);
  const globo = items.find((i) => i.name === 'Globo SP HD');
  assert.strictEqual(globo.ref.streams.length, 2);
  assert.strictEqual(globo.ref.streams[1].userAgent, 'VLC/3.0');
  assert.strictEqual(globo.logo, 'https://logo.example/globo.png');
  assert.strictEqual(items.find((i) => i.name === 'TyC Sports').country, 'AR');
});

test('configuração M3U_LISTS ignora itens inválidos', () => {
  const sources = m3uFromEnv('Minha Lista|https://lista.example/a.m3u;Quebrada|ftp://x');
  assert.strictEqual(sources.length, 1);
  assert.strictEqual(sources[0].label, 'Minha Lista');
  assert.strictEqual(sources[0].id, 'm3u-minha-lista');
});
