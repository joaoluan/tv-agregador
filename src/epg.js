'use strict';

const { readFileSync, statSync } = require('node:fs');

function loadGuide(path) {
  if (!path) return new Map();
  if (statSync(path).size > 1024 * 1024) throw new Error('Guia supera 1 MiB');
  const entries = JSON.parse(readFileSync(path, 'utf8'));
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

module.exports = { loadGuide, nowNext };
