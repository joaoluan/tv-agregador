'use strict';

const { normalizeText } = require('./normalize');

// Países oferecidos no filtro de cada categoria (Descobrir > TV > categoria > filtro).
// Ordem = ordem no filtro. Para incluir outro país, adicione código ISO e nome.
const COUNTRIES = [
  ['BR', 'Brasil'], ['PT', 'Portugal'], ['US', 'Estados Unidos'], ['GB', 'Reino Unido'],
  ['ES', 'Espanha'], ['AR', 'Argentina'], ['MX', 'México'], ['FR', 'França'], ['IT', 'Itália'],
  ['DE', 'Alemanha'], ['CA', 'Canadá'], ['CL', 'Chile'], ['CO', 'Colômbia'], ['PE', 'Peru'],
  ['UY', 'Uruguai'], ['PY', 'Paraguai'], ['BO', 'Bolívia'], ['VE', 'Venezuela'], ['EC', 'Equador'],
  ['JP', 'Japão'], ['KR', 'Coreia do Sul'], ['IN', 'Índia'], ['CN', 'China'], ['TR', 'Turquia'],
  ['NL', 'Holanda'], ['BE', 'Bélgica'], ['PL', 'Polônia'], ['SE', 'Suécia'], ['RU', 'Rússia'],
  ['AU', 'Austrália'], ['SG', 'Singapura'], ['TH', 'Tailândia'], ['PH', 'Filipinas'],
  ['AE', 'Emirados Árabes'], ['SA', 'Arábia Saudita'], ['EG', 'Egito'], ['ZA', 'África do Sul'],
  ['NG', 'Nigéria'], ['AO', 'Angola'], ['MZ', 'Moçambique'], ['IL', 'Israel'], ['GR', 'Grécia'],
  ['RO', 'Romênia']
];

const ALL_INTERNATIONAL = 'Internacional (fora do Brasil)';

// Países que aparecem no filtro. O Stremio limita o manifesto a 8 KB, e a lista
// se repete em cada categoria, por isso o filtro tem só os mais úteis.
// Canais de outros países continuam na lista "todos" e na busca.
const FILTER_CODES = [
  'BR', 'PT', 'US', 'GB', 'ES', 'AR', 'MX', 'FR', 'IT', 'DE',
  'CA', 'CL', 'CO', 'JP', 'KR', 'IN', 'TR', 'AU', 'AO'
];

const nameToCode = new Map(COUNTRIES.map(([code, name]) => [name, code]));

// Grupos das fontes brasileiras que indicam outro país (ex.: "ARGENTINA", "Portugal").
const GROUP_COUNTRY = new Map([
  ['argentina', 'AR'], ['bolivia', 'BO'], ['chile', 'CL'], ['equador', 'EC'], ['ecuador', 'EC'],
  ['portugal', 'PT'], ['venezuela', 'VE'], ['estados unidos', 'US'], ['eua', 'US'], ['usa', 'US'],
  ['paraguai', 'PY'], ['paraguay', 'PY'], ['colombia', 'CO'], ['mexico', 'MX'], ['peru', 'PE'],
  ['uruguai', 'UY'], ['uruguay', 'UY'], ['espanha', 'ES'], ['espana', 'ES'], ['italia', 'IT'],
  ['franca', 'FR'], ['alemanha', 'DE'], ['reino unido', 'GB'], ['uk', 'GB'], ['japao', 'JP'],
  ['angola', 'AO'], ['mocambique', 'MZ']
]);

function countryFromGroups(groups, fallback) {
  for (const group of groups || []) {
    const text = normalizeText(group);
    for (const [label, code] of GROUP_COUNTRY) {
      if (text === label || text.endsWith(` ${label}`) || text.startsWith(`${label} `)) {
        return code;
      }
    }
  }
  return fallback;
}

function countryName(code) {
  const found = COUNTRIES.find(([c]) => c === code);
  return found ? found[1] : code;
}

function filterOptions() {
  return [ALL_INTERNATIONAL, ...FILTER_CODES.map(countryName)];
}

// Converte o valor escolhido no filtro em um teste de país.
function countryPredicate(option) {
  if (!option) {
    return () => true;
  }
  if (option === ALL_INTERNATIONAL) {
    return (code) => code !== 'BR';
  }
  const code = nameToCode.get(option);
  return code ? (c) => c === code : () => false;
}

module.exports = { COUNTRIES, countryFromGroups, countryName, filterOptions, countryPredicate, ALL_INTERNATIONAL };
