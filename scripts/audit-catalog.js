'use strict';

const { readFileSync } = require('node:fs');
const { categorize } = require('../src/categories');
const { channelKey, cleanName } = require('../src/normalize');

function audit(items) {
  if (!Array.isArray(items)) throw new Error('Use uma lista JSON de canais');
  const counts = {};
  const identities = new Map();
  const unknown = [];
  const changes = [];
  let excluded = 0;
  for (const item of items) {
    if (!item || typeof item.name !== 'string') throw new Error('Canal sem nome válido');
    const name = cleanName(item.name);
    const categories = categorize(Array.isArray(item.groups) ? item.groups : [], item.name);
    if (!categories) {
      excluded++;
      continue;
    }
    const current = [...categories].sort();
    for (const category of current) counts[category] = (counts[category] || 0) + 1;
    if (categories.has('outros')) unknown.push(name);
    const previous = Array.isArray(item.categories) ? [...item.categories].sort() : null;
    if (previous && JSON.stringify(previous) !== JSON.stringify(current)) {
      changes.push({ name, previous, current });
    }
    const key = channelKey(name);
    const country = /^[a-z]{2}$/i.test(item.country) ? item.country.toUpperCase() : '??';
    const countries = identities.get(key) || new Set();
    countries.add(country);
    identities.set(key, countries);
  }
  const uncertainCountries = [...identities]
    .filter(([, countries]) => countries.has('??') && countries.size > 1)
    .map(([key, countries]) => ({ key, countries: [...countries].sort() }));
  return { total: items.length, excluded, counts, unknown, changes, uncertainCountries };
}

if (require.main === module) {
  try {
    const input = readFileSync(process.argv[2] || 0, 'utf8');
    console.log(JSON.stringify(audit(JSON.parse(input)), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { audit };
