'use strict';

const { createStremioSource } = require('./stremio');
const { createIptvOrgSource } = require('./iptvOrg');
const { createM3uSource } = require('./m3u');
const { slugify } = require('../normalize');

// Fontes de canais. "priority": menor número = aparece primeiro na lista de links.
// Para adicionar outro addon de TV do Stremio, copie uma linha e troque o manifestUrl.
const STREMIO_ADDONS = [
  { id: 'tvplay', label: 'TVPlay', manifestUrl: 'https://c69e439124f3-tvplay.baby-beamup.club/manifest.json', country: 'BR', priority: 10 },
  { id: 'tvvio', label: 'Tvvio', manifestUrl: 'https://c69e439124f3-tvvio.baby-beamup.club/manifest.json', country: 'BR', priority: 20 },
  { id: 'ntctv', label: 'NTC TV', manifestUrl: 'https://ntcstudios.com.br/ntctv/manifest.json', country: 'BR', priority: 30 },
  { id: 'redecanais', label: 'Rede Canais', manifestUrl: 'https://redecanaistv-addon-stremio.onrender.com/manifest.json', country: 'BR', priority: 40 }
];

// Addons que exigem login pessoal (ex.: FrostStream) geram um link de instalação com
// token próprio. Esse link é segredo: vai na variável ADDONS_PRIVADOS do Render, nunca aqui.
// Formato: Nome|https://link-pessoal/manifest.json ; Outro|https://...
function privateAddonsFromEnv(value) {
  if (!value) {
    return [];
  }
  return value.split(';').map((part, index) => {
    const [label, manifestUrl] = part.split('|').map((s) => s && s.trim());
    if (!label || !/^https:\/\/.+\/manifest\.json$/i.test(manifestUrl || '')) {
      console.warn(`[config] ADDONS_PRIVADOS item ${index + 1} ignorado (use Nome|https://.../manifest.json)`);
      return null;
    }
    return createStremioSource({ id: `addon-${slugify(label)}`, label, manifestUrl, priority: 50 + index });
  }).filter(Boolean);
}

// Listas M3U opcionais, configuradas no Render (variável de ambiente M3U_LISTS),
// para que links com usuário/senha nunca fiquem no código.
// Formato: Nome|https://link-da-lista.m3u ; Outro Nome|https://outro-link.m3u
function m3uFromEnv(value) {
  if (!value) {
    return [];
  }
  return value.split(';').map((part, index) => {
    const [label, url] = part.split('|').map((s) => s && s.trim());
    if (!label || !/^https?:\/\//i.test(url || '')) {
      console.warn(`[config] M3U_LISTS item ${index + 1} ignorado (use Nome|https://...)`);
      return null;
    }
    return createM3uSource({ id: `m3u-${slugify(label)}`, label, url, priority: 60 + index });
  }).filter(Boolean);
}

function buildSources(env = process.env) {
  const sources = STREMIO_ADDONS.map((cfg) => createStremioSource(cfg));
  sources.push(...privateAddonsFromEnv(env.ADDONS_PRIVADOS));
  sources.push(...m3uFromEnv(env.M3U_LISTS));
  if (env.IPTV_ORG === 'on') {
    sources.push(createIptvOrgSource({ priority: 90 }));
  }
  const preferred = (env.PREFERRED_SOURCES || '').split(',').map(id => id.trim()).filter(Boolean);
  const ranks = new Map(preferred.map((id, index) => [id, index]));
  for (const source of sources) {
    if (ranks.has(source.id)) source.priority = ranks.get(source.id) - preferred.length;
  }
  return sources.sort((a, b) => a.priority - b.priority);
}

module.exports = { buildSources, m3uFromEnv, privateAddonsFromEnv, STREMIO_ADDONS };
