'use strict';

const { fetchJson } = require('../http');

const API = 'https://iptv-org.github.io/api';

// iptv-org: base pública e aberta de canais do mundo todo, já com país e categoria.
// Os links já vêm na base, então não há chamada extra na hora de assistir.
function createIptvOrgSource({ id = 'iptvorg', label = 'iptv-org', priority = 90, countries = null } = {}) {
  async function load() {
    const [channels, streams, logos] = await Promise.all([
      fetchJson(`${API}/channels.json`, { timeout: 60000 }),
      fetchJson(`${API}/streams.json`, { timeout: 60000 }),
      fetchJson(`${API}/logos.json`, { timeout: 60000 }).catch(() => [])
    ]);
    return buildItems({ channels, streams, logos, countries });
  }

  async function streamsFor(ref) {
    return (ref.streams || []).map(toStremioStream);
  }

  return { id, label, priority, load, streams: streamsFor };
}

function buildItems({ channels, streams, logos, countries }) {
  const allowedCountries = countries ? new Set(countries) : null;
  const byChannel = new Map();
  for (const s of streams || []) {
    if (!s.channel || !s.url) {
      continue;
    }
    const list = byChannel.get(s.channel) || [];
    list.push({
      url: s.url,
      title: s.title || null,
      quality: s.quality || null,
      labels: s.labels || [],
      userAgent: s.user_agent || null,
      referrer: s.referrer || null
    });
    byChannel.set(s.channel, list);
  }

  const logoByChannel = new Map();
  for (const logo of logos || []) {
    if (!logo.channel || !logo.url) {
      continue;
    }
    const current = logoByChannel.get(logo.channel);
    const better = !current || (!logo.feed && current.feed) || (logo.in_use && !current.in_use);
    if (better) {
      logoByChannel.set(logo.channel, logo);
    }
  }

  const items = [];
  for (const ch of channels || []) {
    const channelStreams = byChannel.get(ch.id);
    if (!channelStreams || ch.is_nsfw || ch.closed) {
      continue;
    }
    if (allowedCountries && !allowedCountries.has(ch.country)) {
      continue;
    }
    const logo = logoByChannel.get(ch.id);
    items.push({
      name: ch.name,
      logo: logo ? logo.url : null,
      groups: ch.categories || [],
      country: ch.country || null,
      ref: { streams: channelStreams }
    });
  }
  return items;
}

function toStremioStream(s) {
  const details = [s.quality, ...(s.labels || [])].filter(Boolean).join(' · ');
  const stream = {
    url: s.url,
    title: [s.title, details].filter(Boolean).join('\n') || 'Ao vivo',
    behaviorHints: { notWebReady: true }
  };
  const headers = {};
  if (s.userAgent) {
    headers['User-Agent'] = s.userAgent;
  }
  if (s.referrer) {
    headers.Referer = s.referrer;
  }
  if (Object.keys(headers).length) {
    stream.behaviorHints.proxyHeaders = { request: headers };
  }
  return stream;
}

module.exports = { createIptvOrgSource, buildItems, toStremioStream };
