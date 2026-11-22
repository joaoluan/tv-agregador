'use strict';

const { channelKey, cleanName, normalizeText } = require('./normalize');

// Identidades reconhecíveis têm precedência sobre rótulos genéricos dos provedores.
// Regras específicas vêm antes das famílias (Discovery Kids antes de Discovery,
// GloboNews antes de Globo). Nomes desconhecidos continuam usando os metadados.
const PROFILES = [
  [/^adultswim$/, ['series', 'variedades']],
  [/^(globoplaynovelas|globonovelas|tntnovelas|tntseries|amcseries|bbcdoctorwhoclassic)$/, ['series']],
  [/^(discoverykids|disneyjunior|disneyjr|disneychannel|cartoonnetwork|cartoonito|gloob|gloobinho|tooncast|nick(?:elodeon|jr)?|dreamworks|boxkidstv|(?:tv)?ratimbum|zoomoo|sb(t|tplus)kids|kuriakoskids|babysharktv)/, ['infantil']],
  [/^(bbcearth|animalplanet|investigationdiscovery|history(?:2|hit)?|h2|nationalgeographic(?:wild)?|arte1|curta)$/, ['documentarios']],
  [/^discovery(?!kids|home|hh)/, ['documentarios']],
  [/^(hgtv|modoviagem|travelboxbrazil|fashiontv)$/, ['estilo']],
  [/^(discoveryhome(?:and)?health|discoveryhh|tlc)$/, ['estilo', 'variedades']],
  [/^(bbcfood|foodnetwork|masterchef|chefchampion|chefrocshow|inthekitchen|tastemade|sabor(?:e)?arte)$/, ['culinaria']],
  [/^(multishow|mtv)$/, ['musica', 'variedades']],
  [/^(bis|musicboxbrazil|tracebrazuca|kuriakosmusic)$/, ['musica']],
  [/^gnt$/, ['variedades']],
  [/^(artvcanalparlamento|tvcamara|tvsenado|tvalerj|tvalesp)$/, ['noticias']],
  [/^(off|canaloff|fishtv)$/, ['esportes', 'estilo']],
  [/^(globonews|bandnews|recordnews|sbtnews|jovempannews|bmcnews|cnbc.*|cnn.*|bbcnews.*|bloomberg.*|timesbrasil.*)$/, ['noticias']],
  [/^(espn\d*|sportv\d*|sporttv\d*|bandsports|combate|premiere(?:\d+|clubes)?|xsports|sportynet(?:plus)?\d*|nsports|dazn\d*|cazetv\d*|getv|goattv\d*|canalgoat\d*|nossofutebol|ufc(?:fightpass)?|f1|formula1tv|nba(?:leaguepass)?\d*|eleven\d+)$/, ['esportes']],
  [/^(telecine.*|megapix|cinemax|studiouniversal|tcm|cinema.*|cinepremiere|sonymovies)$/, ['filmes']],
  [/^(axn|amc|ae|sony(?:channel)?|canalsony|warner(?:channel|tv)?|universal(?:tv)?|universalcrime|usa|star(?:channel)?|paramount(?:channel|network)?|hbo.*|space|syfy|canalbrasil|film(?:and)?arts)$/, ['filmes', 'series']],
  [/^(globo(?!news|play|novelas|now).*|record(?!news).*|sbt(?!news|pluskids).*|band(?!news|sports).*|redetv|tvcultura|tvbrasil|futura)$/, ['abertos']]
];

function knownCategories(name) {
  const text = normalizeText(cleanName(name));
  // Um nome de igreja continua religioso mesmo com gênero incorreto na fonte.
  if (/\b(igreja|gospel|cancao nova|rede vida|aparecida|pai eterno|novo tempo|evangelizar|maranata|maanaim)\b/.test(text) ||
      /^(tv )?mana\b|^mana (church|cirkev|eglise|iglesia|tserkov)\b|^kuriakos tv$/.test(text)) {
    return ['religiosos'];
  }
  if (/\b(brasileirao|copa do brasil|league cup|liga futsal)\b/.test(text)) return ['esportes'];
  const key = channelKey(name);
  for (const [pattern, categories] of PROFILES) {
    if (pattern.test(key)) return categories;
  }
  return null;
}

module.exports = { knownCategories };
