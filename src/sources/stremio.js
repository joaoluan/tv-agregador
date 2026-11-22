'use strict';

const { fetchJson, mapLimit, STREAM_TIMEOUT_MS } = require('../http');
const { countryFromGroups } = require('../countries');
const { categorize } = require('../categories');

const MAX_PAGES = 12;
const MAX_CATALOGS = 8;

// Itens de aviso que alguns addons devolvem no lugar dos canais (ex.: falta de login).
const NOTICE_RE = /(nao autenticad|not authenticated|unauthori[sz]ed|login necess|requer autentica|configure (o|the) addon|token (invalido|expirado))/i;

function isNotice(meta) {
  const text = `${meta.name || ''} ${meta.description || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return NOTICE_RE.test(text);
}

// Fonte genérica: qualquer addon Stremio que tenha catálogos de TV.
// Lê todos os catálogos (com paginação), junta os canais pelo id original
// e usa o nome do catálogo como gênero quando o canal não informa gêneros.
function createStremioSource({ id, label, manifestUrl, country = '??', priority = 50, concurrency = 4 }) {
  const base = manifestUrl.replace(/\/manifest\.json$/, '');

  async function fetchCatalogPages(catalog) {
    const metas = [];
    const seen = new Set();
    let skip = 0;
    for (let page = 0; page < MAX_PAGES; page++) {
      const path = skip
        ? `/catalog/${catalog.type}/${encodeURIComponent(catalog.id)}/skip=${skip}.json`
        : `/catalog/${catalog.type}/${encodeURIComponent(catalog.id)}.json`;
      const data = await fetchJson(base + path);
      const pageMetas = (data && data.metas) || [];
      const fresh = pageMetas.filter((m) => m && m.id && !seen.has(m.id) && !isNotice(m));
      if (!fresh.length) {
        break;
      }
      for (const meta of fresh) {
        seen.add(meta.id);
        metas.push(meta);
      }
      const supportsSkip = (catalog.extra || []).some((e) => e.name === 'skip') ||
        (catalog.extraSupported || []).includes('skip');
      if (!supportsSkip) {
        break;
      }
      skip += pageMetas.length;
      if (page === MAX_PAGES - 1) {
        console.warn(`[${id}] catálogo "${catalog.id}" truncado em ${MAX_PAGES} páginas`);
      }
    }
    return metas;
  }

  async function load() {
    const manifest = await fetchJson(`${base}/manifest.json`);
    const addonName = manifest.name || label;
    const catalogs = (manifest.catalogs || []).filter((c) => {
      const required = (c.extra || []).some((e) => e.isRequired) || (c.extraRequired || []).length > 0;
      return ['tv', 'channel'].includes(c.type) && !required;
    });

    if (catalogs.length > MAX_CATALOGS) {
      console.warn(`[${id}] ${catalogs.length - MAX_CATALOGS} catálogos omitidos (limite ${MAX_CATALOGS})`);
    }
    const byOriginalId = new Map();
    await mapLimit(catalogs.slice(0, MAX_CATALOGS), concurrency, async (catalog) => {
      let metas = [];
      try {
        metas = await fetchCatalogPages(catalog);
      } catch (err) {
        console.warn(`[${id}] catálogo "${catalog.name}" falhou: ${err.message}`);
        return;
      }
      const catalogGroup = catalog.name && catalog.name !== addonName ? catalog.name : null;
      for (const meta of metas) {
        const entry = byOriginalId.get(meta.id) || {
          name: meta.name,
          logo: meta.logo || meta.poster || null,
          groups: new Set(),
          catalogGroups: new Set(),
          ref: { type: meta.type || catalog.type, id: meta.id }
        };
        for (const genre of meta.genres || []) {
          entry.groups.add(genre);
        }
        if (catalogGroup) {
          entry.catalogGroups.add(catalogGroup);
        }
        byOriginalId.set(meta.id, entry);
      }
    });

    return [...byOriginalId.values()].map((entry) => {
      const genres = [...entry.groups];
      const allGroups = [...genres, ...entry.catalogGroups];
      const explicit = categorize(genres, entry.name);
      const combined = categorize(allGroups, entry.name);
      // O gênero do canal é mais específico que o título da coleção.
      // País, bloqueios e formato 24h do catálogo não podem ser perdidos.
      const groups = !combined || combined.has('canais24h') || !explicit || explicit.has('outros')
        ? allGroups : genres;
      return {
        name: entry.name,
        logo: entry.logo,
        groups,
        country: countryFromGroups(allGroups, country),
        ref: entry.ref
      };
    });
  }

  async function streams(ref) {
    const data = await fetchJson(`${base}/stream/${ref.type}/${encodeURIComponent(ref.id)}.json`, { timeout: STREAM_TIMEOUT_MS, retries: 0 });
    return (data && data.streams) || [];
  }

  return { id, label, priority, load, streams };
}

module.exports = { createStremioSource };
