'use strict';

const { fetchJson, mapLimit } = require('../http');
const { countryFromGroups } = require('../countries');

const MAX_PAGES = 40;

// Fonte genérica: qualquer addon Stremio que tenha catálogos de TV.
// Lê todos os catálogos (com paginação), junta os canais pelo id original
// e usa o nome do catálogo como gênero quando o canal não informa gêneros.
function createStremioSource({ id, label, manifestUrl, country = 'BR', priority = 50, concurrency = 4 }) {
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
      const fresh = pageMetas.filter((m) => m && m.id && !seen.has(m.id));
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

    const byOriginalId = new Map();
    await mapLimit(catalogs, concurrency, async (catalog) => {
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
          ref: { type: meta.type || catalog.type, id: meta.id }
        };
        for (const genre of meta.genres || []) {
          entry.groups.add(genre);
        }
        if (catalogGroup) {
          entry.groups.add(catalogGroup);
        }
        byOriginalId.set(meta.id, entry);
      }
    });

    return [...byOriginalId.values()].map((entry) => {
      const groups = [...entry.groups];
      return {
        name: entry.name,
        logo: entry.logo,
        groups,
        country: countryFromGroups(groups, country),
        ref: entry.ref
      };
    });
  }

  async function streams(ref) {
    const data = await fetchJson(`${base}/stream/${ref.type}/${encodeURIComponent(ref.id)}.json`, { timeout: 9000, retries: 0 });
    return (data && data.streams) || [];
  }

  return { id, label, priority, load, streams };
}

module.exports = { createStremioSource };
