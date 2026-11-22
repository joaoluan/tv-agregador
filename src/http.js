'use strict';

const DEFAULT_TIMEOUT = 15000;
// Deve ser menor que o timeout agregado do store (10s por padrão).
const STREAM_TIMEOUT_MS = 9000;

const MAX_REQUESTS = 8;
const MAX_QUEUED = 128;
const MAX_BYTES = 32 * 1024 * 1024;
const queue = [];
let active = 0;

async function limited(signal, work) {
  signal.throwIfAborted();
  if (active >= MAX_REQUESTS) {
    if (queue.length >= MAX_QUEUED) throw new Error('Fila HTTP cheia');
    await new Promise((resolve, reject) => {
      const resume = () => {
        signal.removeEventListener('abort', cancel);
        resolve();
      };
      const cancel = () => {
        queue.splice(queue.indexOf(resume), 1);
        reject(signal.reason);
      };
      queue.push(resume);
      signal.addEventListener('abort', cancel, { once: true });
    });
  } else {
    active++;
  }
  try {
    signal.throwIfAborted();
    return await work();
  } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}

async function readBody(res, format, maxBytes) {
  if (!res.body?.getReader) return res[format]();
  const reader = res.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error('Resposta excede o limite de bytes');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const text = Buffer.concat(chunks, bytes).toString('utf8').replace(/^\uFEFF/, '');
  return format === 'json' ? JSON.parse(text) : text;
}

async function request(url, format, { timeout = DEFAULT_TIMEOUT, retries = 1, headers = {}, signal, maxBytes = MAX_BYTES } = {}) {
  const deadline = AbortSignal.timeout(timeout);
  const requestSignal = signal ? AbortSignal.any([signal, deadline]) : deadline;
  let lastError;
  for (let attempt = 0; attempt <= retries && !requestSignal.aborted; attempt++) {
    try {
      return await limited(requestSignal, async () => {
        const res = await fetch(url, {
          signal: requestSignal,
          headers: { 'User-Agent': 'tv-agregador/1.0', ...headers }
        });
        if (!res.ok) {
          await res.body?.cancel();
          const error = new Error(`HTTP ${res.status}`);
          error.retryable = res.status >= 500;
          throw error;
        }
        return readBody(res, format, maxBytes);
      });
    } catch (err) {
      lastError = err;
      if (err.retryable === false) break;
    }
  }
  const reason = requestSignal.aborted ? 'prazo excedido ou consulta cancelada' : lastError?.message;
  throw new Error(`Falha ao buscar ${safeUrl(url)}: ${reason}`);
}

function fetchJson(url, options = {}) {
  return request(url, 'json', { ...options, headers: { Accept: 'application/json', ...options.headers } });
}

function fetchText(url, options) {
  return request(url, 'text', options);
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
