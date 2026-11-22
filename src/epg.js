'use strict';

const { readFileSync, statSync } = require('node:fs');

const { fetchJson } = require('./http');
const MAX_GUIDE_BYTES = 1024 * 1024;

function loadGuide(path) {
  if (!path) return new Map();
  if (statSync(path).size > MAX_GUIDE_BYTES) throw new Error('Guia supera 1 MiB');
  return indexGuide(JSON.parse(readFileSync(path, 'utf8')));
}

function indexGuide(entries) {
  if (!Array.isArray(entries)) throw new Error('Guia deve conter uma lista de programas');
  const guide = new Map();
  for (const entry of entries) {
    const start = Date.parse(entry?.start);
    const end = Date.parse(entry?.end);
    if (!/^tvagg:[a-z?]+:[a-z0-9-]+$/.test(entry?.channelId) ||
        typeof entry.title !== 'string' || !entry.title.trim() ||
        !Number.isFinite(start) || !Number.isFinite(end) || start >= end) continue;
    const programs = guide.get(entry.channelId) || [];
    programs.push({ title: entry.title.slice(0, 160), start, end });
    guide.set(entry.channelId, programs);
  }
  for (const programs of guide.values()) programs.sort((a, b) => a.start - b.start);
  return guide;
}

function nowNext(guide, id, now = Date.now()) {
  const programs = guide.get(id) || [];
  return {
    now: programs.find(program => program.start <= now && now < program.end) || null,
    next: programs.find(program => program.start > now) || null
  };
}

function createSchedule(guide, url, { fetch = fetchJson, clock = Date.now } = {}) {
  if (!url) return id => nowNext(guide, id, clock());
  const endpoint = new URL(url);
  if (endpoint.protocol !== 'https:') throw new Error('EPG_URL exige HTTPS');
  let nextRefresh = 0;
  let pending;
  return async id => {
    if (!pending && clock() >= nextRefresh) {
      pending = Promise.resolve().then(() => fetch(endpoint.href, {
        timeout: 4000, retries: 0, maxBytes: MAX_GUIDE_BYTES
      })).then(entries => {
        guide = indexGuide(entries);
        nextRefresh = clock() + 15 * 60 * 1000;
      }).catch(() => {
        nextRefresh = clock() + 60 * 1000;
      }).finally(() => {
        pending = undefined;
      });
    }
    await pending;
    return nowNext(guide, id, clock());
  };
}

module.exports = { loadGuide, nowNext, createSchedule };
