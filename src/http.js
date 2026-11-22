'use strict';

const DEFAULT_TIMEOUT = 15000;
// Deve ser menor que o timeout agregado do store (10s por padrão).
const STREAM_TIMEOUT_MS = 9000;

async function fetchJson(url, { timeout = DEFAULT_TIMEOUT, retries = 1, headers = {} } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'tv-agregador/1.0', Accept: 'application/json', ...headers }
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Falha ao buscar ${safeUrl(url)}: ${lastError && lastError.message}`);
}

async function fetchText(url, { timeout = DEFAULT_TIMEOUT, retries = 1 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'tv-agregador/1.0' } });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Falha ao buscar ${safeUrl(url)}: ${lastError && lastError.message}`);
}

// Nunca loga caminhos/query strings completos (podem conter configurações privadas).
function safeUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch (e) {
    return '<url inválida>';
  }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

function withTimeout(promise, ms, fallback) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

module.exports = { STREAM_TIMEOUT_MS, fetchJson, fetchText, mapLimit, withTimeout, safeUrl };
