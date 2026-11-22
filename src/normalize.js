'use strict';

const aliases = require('./aliases');

// Marcadores de qualidade/variante que não mudam o canal.
const QUALITY_TOKENS = [
  'fhd', 'uhd', 'hd', 'sd', '4k', '8k', 'h265', 'h\\.265', 'hevc', 'fullhd', 'full hd',
  '1080p', '1080', '720p', '720', '480p', '480', 'alt', 'alternativo', 'backup', 'reserva',
  'op\\d', 'opcao \\d', 'opção \\d', 'link \\d', 'ao vivo', 'live', '24/7'
];
const QUALITY_RE = new RegExp(`(^|\\s)(${QUALITY_TOKENS.join('|')})(?=\\s|$)`, 'gi');

// Prefixo de país que algumas fontes colocam no nome (ex.: "PT SportTV 1").
const COUNTRY_PREFIX_RE = /^(pt|br|us|uk|ar|mx)\s*[:\-|]?\s+(?=\S)/i;

// Nomes de praça por extenso -> sigla (ex.: "Globo São Paulo" = "Globo SP").
const REGION_SUFFIXES = [
  ['saopaulo', 'sp'], ['riodejaneiro', 'rj'], ['rio', 'rj'], ['minasgerais', 'mg'], ['minas', 'mg'],
  ['belohorizonte', 'mg'], ['espiritosanto', 'es'], ['portoalegre', 'rs'], ['riograndedosul', 'rs'],
  ['brasilia', 'df'], ['distritofederal', 'df'], ['goias', 'go'], ['goiania', 'go'], ['bahia', 'ba'],
  ['salvador', 'ba'], ['pernambuco', 'pe'], ['recife', 'pe'], ['parana', 'pr'], ['curitiba', 'pr'],
  ['santacatarina', 'sc'], ['ceara', 'ce'], ['fortaleza', 'ce'], ['amazonas', 'am'], ['manaus', 'am'],
  ['paraiba', 'pb'], ['para', 'pa'], ['belem', 'pa']
];
const REGION_PREFIXES = ['globo', 'record', 'sbt', 'band', 'redetv'];

function stripAccents(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Nome para exibir: sem numeração de lista, emojis, tags e marcadores de qualidade.
function cleanName(raw) {
  let name = String(raw || '');
  name = name.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, ' ');
  name = name.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ');
  name = name.replace(/^\s*\d{3}\s+(?=\S)/, '');
  name = name.replace(/[|•·]+/g, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  name = name.replace(COUNTRY_PREFIX_RE, '');
  let previous;
  do {
    previous = name;
    name = name.replace(QUALITY_RE, ' ').replace(/\s+/g, ' ').trim();
  } while (name !== previous);
  name = name.replace(/[\s\-–:]+$/g, '').trim();
  return name || String(raw || '').trim();
}

function normalizeRegion(key) {
  for (const prefix of REGION_PREFIXES) {
    if (!key.startsWith(prefix)) {
      continue;
    }
    const rest = key.slice(prefix.length);
    for (const [full, short] of REGION_SUFFIXES) {
      if (rest === full) {
        return prefix + short;
      }
    }
  }
  return key;
}

// Chave de comparação: mesmo canal com grafias diferentes gera a mesma chave.
function channelKey(raw, { preserveOne = false } = {}) {
  let key = stripAccents(cleanName(raw)).toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/&/g, '')
    .replace(/[^a-z0-9]/g, '');
  key = key.replace(/([a-z])0+(\d)/g, '$1$2'); // "max02" = "max2"
  if (!preserveOne) key = key.replace(/([a-z])1$/, '$1'); // "Max 1" = "Max", "CazéTV 1" = "CazéTV"
  key = normalizeRegion(key);
  if (aliases[key]) {
    return aliases[key];
  }
  // Apelido também vale para canais numerados ("Amazon Prime 2" = "Prime Video 2").
  const numbered = key.match(/^(.*[a-z])(\d+)$/);
  if (numbered && aliases[numbered[1]]) {
    return aliases[numbered[1]] + numbered[2];
  }
  return key;
}

function slugify(text) {
  return stripAccents(String(text)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function normalizeText(text) {
  return stripAccents(String(text || '')).toLowerCase().replace(/[^a-z0-9+/ ]+/g, ' ').replace(/\s+/g, ' ').trim();
}

module.exports = { cleanName, channelKey, slugify, normalizeText, stripAccents };
