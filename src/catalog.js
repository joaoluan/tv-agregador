'use strict';

const { cleanName, channelKey, slugify } = require('./normalize');
const { categorize, CATEGORIES } = require('./categories');
const { countryName } = require('./countries');
const { withTimeout, STREAM_TIMEOUT_MS } = require('./http');

const ID_PREFIX = 'tvagg:';
const REFRESH_MS = 6 * 60 * 60 * 1000;

// Junta os canais de todas as fontes em uma lista única, sem duplicados.
function mergeChannels(sourceResults) {
  const channels = new Map();
  const seenMembers = new Map();

  for (const { source, items } of sourceResults) {
    for (const item of items || []) {
      if (!item || !item.name) {
        continue;
      }
      const categories = categorize(item.groups, item.name);
      if (!categories) {
        continue;
      }
      const key = channelKey(item.name);
      if (!key) {
        continue;
      }
      const country = (item.country || '??').toUpperCase();
      const id = `${ID_PREFIX}${country.toLowerCase()}:${slugify(key)}`;
      let channel = channels.get(id);
      if (!channel) {
        channel = {
          id,
          name: cleanName(item.name),
          country,
          logo: item.logo || null,
          categories: new Set(),
          members: []
        };
        channels.set(id, channel);
      }
      if (!channel.logo && item.logo) {
        channel.logo = item.logo;
      }
      for (const cat of categories) {
        channel.categories.add(cat);
      }
      const memberKey = JSON.stringify([source.id, item.ref?.id ?? item.ref]);
      const seen = seenMembers.get(id) || new Set();
      if (!seen.has(memberKey)) {
        channel.members.push({ sourceId: source.id, ref: item.ref, originalName: item.name });
        seen.add(memberKey);
        seenMembers.set(id, seen);
      }
    }
  }

  // Um canal que caiu em categorias reais não precisa ficar também em "Outros".
  for (const channel of channels.values()) {
    if (channel.categories.has('canais24h')) channel.categories = new Set(['canais24h']);
    if (channel.categories.size > 1) {
      channel.categories.delete('outros');
    }
  }
  return channels;
}

function sortChannels(list) {
  return list.sort((a, b) => {
    const brA = a.country === 'BR' ? 1 : 0;
    const brB = b.country === 'BR' ? 1 : 0;
    if (brA !== brB) {
      return brB - brA;
    }
    const sourcesA = new Set(a.members.map((m) => m.sourceId)).size;
    const sourcesB = new Set(b.members.map((m) => m.sourceId)).size;
    if (sourcesA !== sourcesB) {
      return sourcesB - sourcesA;
    }
    return a.name.localeCompare(b.name, 'pt-BR');
  });
}

function createStore(sources, { refreshMs = REFRESH_MS, retryMs = 5 * 60 * 1000, log = console } = {}) {
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const lastGood = new Map();
  const streamCache = new Map();
  const streamPending = new Map();
  const status = new Map();
  let channels = new Map();
  let byCategory = new Map();
  let ready = false;
  let building = null;
  let started = false;
  let stopped = false;
  let lastFullBuildAt = null;
  let lastRetryAt = null;

  async function loadSource(source) {
    const started = Date.now();
    try {
      const items = await source.load();
      lastGood.set(source.id, items);
      status.set(source.id, { ok: true, items: items.length, ms: Date.now() - started, at: new Date().toISOString() });
    } catch (err) {
      const previous = lastGood.get(source.id);
      status.set(source.id, {
        ok: false,
        error: err.message,
        items: previous ? previous.length : 0,
        usingPrevious: Boolean(previous),
        at: new Date().toISOString()
      });
      log.warn(`[${source.id}] falhou ao carregar: ${err.message}`);
    }
    return { source, items: lastGood.get(source.id) || [] };
  }

  async function build({ missingOnly = false } = {}) {
    if (building) {
      return building;
    }
    building = (async () => {
      const results = await Promise.all(sources.map((source) =>
        missingOnly && lastGood.has(source.id)
          ? { source, items: lastGood.get(source.id) }
          : loadSource(source)));
      const merged = mergeChannels(results);
      const grouped = new Map(CATEGORIES.map((c) => [c.id, []]));
      for (const channel of merged.values()) {
        for (const cat of channel.categories) {
          grouped.get(cat).push(channel);
        }
      }
      for (const list of grouped.values()) {
        sortChannels(list);
      }
      streamCache.clear();
      streamPending.clear();
      channels = merged;
      byCategory = grouped;
      ready = true;
      log.info(`[índice] ${merged.size} canais únicos de ${sources.length} fontes`);
      if (!missingOnly) lastFullBuildAt = Date.now();
      lastRetryAt = Date.now();
    })().finally(() => {
      building = null;
    });
    return building;
  }

  // Manutenção é acionada por acesso aos handlers, nunca por timer periódico.
  // /health e /status só leem o estado e não geram consultas às fontes.
  function maintainOnAccess() {
    if (stopped || building) return;
    const now = Date.now();
    const fullDue = lastFullBuildAt === null || now - lastFullBuildAt >= refreshMs;
    const retryDue = sources.some((source) => !lastGood.has(source.id)) &&
      (lastRetryAt === null || now - lastRetryAt >= retryMs);
    if (fullDue || retryDue) {
      build({ missingOnly: !fullDue }).catch((err) => log.error(`[índice] erro: ${err.message}`));
    }
  }

  function start() {
    if (started) return;
    started = true;
    stopped = false;
    if (ready) maintainOnAccess();
    else build().catch((err) => log.error(`[índice] erro: ${err.message}`));
  }

  function stop() {
    started = false;
    stopped = true;
  }

  async function waitReady(ms = 10000) {
    if (ready) {
      maintainOnAccess();
      return true;
    }
    if (stopped) return false;
    // Os handlers usam ms=0 para responder imediatamente; o build continua ao fundo.
    const work = building || build();
    if (ms > 0) await withTimeout(work, ms, null);
    else work.catch((err) => log.error(`[índice] erro: ${err.message}`));
    return ready;
  }

  function list(categoryId) {
    return byCategory.get(categoryId) || [];
  }

  function search(query) {
    const key = channelKey(query);
    if (!key) {
      return [];
    }
    const found = [...channels.values()].filter((c) => channelKey(c.name).includes(key));
    return sortChannels(found);
  }

  function get(id) {
    return channels.get(id) || null;
  }

  async function streamsFor(id, options = {}) {
    // withTimeout não cancela requests: fetchJson deve abortar primeiro, sem retries.
    const timeout = options.timeout ?? STREAM_TIMEOUT_MS + 1000;
    if (!Number.isFinite(timeout) || timeout <= STREAM_TIMEOUT_MS) {
      throw new RangeError(`timeout de streamsFor deve exceder ${STREAM_TIMEOUT_MS} ms`);
    }
    const cached = streamCache.get(id);
    if (cached && Date.now() - cached.at < 90000) return cached.streams;
    if (streamPending.has(id)) return streamPending.get(id);
    const generation = channels;
    const pending = resolveStreams(id, { timeout }).then((streams) => {
      if (channels === generation && generation.has(id)) {
        streamCache.delete(id);
        streamCache.set(id, { streams, at: Date.now() });
        if (streamCache.size > 500) streamCache.delete(streamCache.keys().next().value);
      }
      return streams;
    }).finally(() => {
      if (streamPending.get(id) === pending) streamPending.delete(id);
    });
    streamPending.set(id, pending);
    return pending;
  }

  async function resolveStreams(id, { timeout = 10000 } = {}) {
    const channel = channels.get(id);
    if (!channel) {
      return [];
    }
    const members = channel.members.filter((member) => sourceById.has(member.sourceId)).sort((a, b) => {
      return (sourceById.get(a.sourceId)?.priority ?? 999) - (sourceById.get(b.sourceId)?.priority ?? 999);
    });
    const perMember = await Promise.all(members.map(async (member) => {
      const source = sourceById.get(member.sourceId);
      try {
        const result = await withTimeout(source.streams(member.ref), timeout, []);
        return (result || []).map((stream) => labelStream(stream, source, member, channel));
      } catch (err) {
        log.warn(`[${source.id}] sem links para "${channel.name}": ${err.message}`);
        return [];
      }
    }));
    const all = perMember.flat();
    // Links que abrem fora do Stremio (navegador) vão para o fim da lista.
    return [...all.filter((s) => !s.externalUrl), ...all.filter((s) => s.externalUrl)];
  }

  function getStatus() {
    return {
      ready,
      channels: channels.size,
      categories: CATEGORIES.map((c) => ({ id: c.id, name: c.name, channels: list(c.id).length })),
      sources: sources.map((s) => ({ id: s.id, label: s.label, ...(status.get(s.id) || { ok: null }) }))
    };
  }

  return { start, stop, build, waitReady, list, search, get, streamsFor, getStatus };
}

function labelStream(stream, source, member, channel) {
  const original = [stream.name, stream.title, stream.description].filter(Boolean).join(' · ').replace(/\s+/g, ' ').trim();
  const labeled = { ...stream };
  labeled.name = `📺 ${source.label}`;
  const detail = original && original !== channel.name ? original : member.originalName;
  labeled.title = stream.externalUrl ? `${detail}\n(abre fora do Stremio)` : detail;
  delete labeled.description;
  labeled.behaviorHints = { ...(stream.behaviorHints || {}), bingeGroup: `tvagg-${source.id}` };
  return labeled;
}

function toMetaPreview(channel) {
  return {
    id: channel.id,
    type: 'tv',
    name: channel.name,
    poster: channel.logo || undefined,
    logo: channel.logo || undefined,
    posterShape: 'square',
    genres: [countryName(channel.country)]
  };
}

function toMeta(channel, sourceLabels) {
  const sourceNames = [...new Set(channel.members.map((m) => sourceLabels.get(m.sourceId)))];
  const categoryNames = CATEGORIES.filter((c) => channel.categories.has(c.id)).map((c) => c.name);
  return {
    ...toMetaPreview(channel),
    background: channel.logo || undefined,
    genres: [...categoryNames, countryName(channel.country)],
    description: `Disponível em ${sourceNames.length} fonte(s): ${sourceNames.join(', ')}.`
  };
}

module.exports = { createStore, mergeChannels, sortChannels, labelStream, toMetaPreview, toMeta, ID_PREFIX };
