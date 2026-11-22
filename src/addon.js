'use strict';

const { addonBuilder } = require('stremio-addon-sdk');
const pkg = require('../package.json');
const { randomBytes } = require('node:crypto');
// Identifica a inicialização; permanece estável durante toda a vida do processo.
const buildVersion = `${pkg.version}+${Date.now()}.${randomBytes(3).toString('hex')}`;
const { CATEGORIES } = require('./categories');
const { filterOptions, countryPredicate } = require('./countries');
const { toMetaPreview, toMeta, ID_PREFIX } = require('./catalog');

const PAGE_SIZE = 100;

function buildManifest() {
  const countryOptions = filterOptions();
  return {
    id: 'br.tvagregador',
    version: buildVersion,
    name: 'TV Agregador',
    description: 'Todos os seus canais de TV ao vivo em uma lista só, organizada por categoria e sem duplicados. Ao abrir um canal, mostra os links de todas as fontes.',
    types: ['tv'],
    idPrefixes: [ID_PREFIX],
    resources: ['catalog', 'meta', 'stream'],
    catalogs: [
      ...CATEGORIES.map((cat) => ({
        type: 'tv',
        id: `tvagg.${cat.id}`,
        name: cat.name,
        extra: [
          { name: 'genre', options: countryOptions, isRequired: false },
          { name: 'skip', isRequired: false }
        ]
      })),
      {
        type: 'tv',
        id: 'tvagg.busca',
        name: 'Canais',
        extra: [{ name: 'search', isRequired: true }]
      }
    ],
    behaviorHints: { configurable: false, configurationRequired: false }
  };
}

function createAddon(store, sourceLabels) {
  const builder = new addonBuilder(buildManifest());

  builder.defineCatalogHandler(async ({ id, extra = {} }) => {
    const ready = await store.waitReady(0);
    let list;
    if (id === 'tvagg.busca') {
      list = extra.search ? store.search(extra.search) : [];
    } else {
      const categoryId = id.replace(/^tvagg\./, '');
      list = store.list(categoryId);
    }
    const inCountry = countryPredicate(extra.genre);
    const filtered = list.filter((c) => inCountry(c.country));
    const skip = Number.parseInt(extra.skip, 10) || 0;
    const page = filtered.slice(skip, skip + PAGE_SIZE).map(toMetaPreview);
    // Enquanto o índice monta (servidor acordando), não deixa o Stremio guardar lista vazia.
    if (!ready) {
      return { metas: page, cacheMaxAge: 0 };
    }
    return { metas: page, cacheMaxAge: 30 * 60, staleRevalidate: 6 * 60 * 60 };
  });

  builder.defineMetaHandler(async ({ id }) => {
    if (!await store.waitReady(0)) return { meta: null, cacheMaxAge: 0 };
    const channel = store.get(id);
    if (!channel) {
      return { meta: null };
    }
    return { meta: toMeta(channel, sourceLabels), cacheMaxAge: 30 * 60 };
  });

  builder.defineStreamHandler(async ({ id }) => {
    if (!await store.waitReady(0)) return { streams: [], cacheMaxAge: 0 };
    const streams = await store.streamsFor(id);
    return { streams, cacheMaxAge: 60 };
  });

  return builder.getInterface();
}

module.exports = { createAddon, buildManifest };
