'use strict';

const { fetchText } = require('../http');

// Fonte para listas M3U/M3U8 (IPTV). Use para adicionar suas próprias listas no futuro.
function createM3uSource({ id, label, url, country = 'BR', priority = 70 }) {
  async function load() {
    const text = await fetchText(url, { timeout: 60000 });
    return parseM3u(text, country);
  }

  async function streams(ref) {
    return ref.streams.map((s) => {
      const stream = { url: s.url, title: s.title || 'Ao vivo', behaviorHints: { notWebReady: true } };
      if (s.userAgent || s.referrer) {
        stream.behaviorHints.proxyHeaders = { request: {} };
        if (s.userAgent) {
          stream.behaviorHints.proxyHeaders.request['User-Agent'] = s.userAgent;
        }
        if (s.referrer) {
          stream.behaviorHints.proxyHeaders.request.Referer = s.referrer;
        }
      }
      return stream;
    });
  }

  return { id, label, priority, load, streams };
}

function attr(line, name) {
  const match = line.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : null;
}

function parseM3u(text, defaultCountry) {
  const lines = String(text || '').split(/\r?\n/);
  const byName = new Map();
  let current = null;
  let userAgent = null;
  let referrer = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }
    if (line.startsWith('#EXTINF')) {
      const commaIndex = line.lastIndexOf(',');
      current = {
        name: commaIndex >= 0 ? line.slice(commaIndex + 1).trim() : attr(line, 'tvg-name'),
        logo: attr(line, 'tvg-logo'),
        group: attr(line, 'group-title'),
        country: (attr(line, 'tvg-country') || '').split(/[;,]/)[0].toUpperCase() || null
      };
      userAgent = attr(line, 'http-user-agent') || attr(line, 'user-agent');
      referrer = attr(line, 'http-referrer') || attr(line, 'referrer');
      continue;
    }
    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice('#EXTVLCOPT:'.length);
      if (/^http-user-agent=/i.test(opt)) {
        userAgent = opt.split('=').slice(1).join('=');
      }
      if (/^http-referrer=/i.test(opt)) {
        referrer = opt.split('=').slice(1).join('=');
      }
      continue;
    }
    if (line.startsWith('#')) {
      continue;
    }
    if (current && current.name && /^https?:\/\//i.test(line)) {
      const key = `${current.name}|${current.country || defaultCountry}`;
      const item = byName.get(key) || {
        name: current.name,
        logo: current.logo,
        groups: current.group ? current.group.split(';').map((g) => g.trim()).filter(Boolean) : [],
        country: current.country || defaultCountry,
        ref: { streams: [] }
      };
      item.ref.streams.push({ url: line, title: null, userAgent, referrer });
      byName.set(key, item);
    }
    current = null;
    userAgent = null;
    referrer = null;
  }
  return [...byName.values()];
}

module.exports = { createM3uSource, parseM3u };
