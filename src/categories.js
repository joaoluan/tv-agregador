'use strict';

const { normalizeText } = require('./normalize');

// Ordem = ordem das linhas na página inicial do Stremio.
// "match" é testado contra os gêneros/grupos que cada fonte informa (sem acento, minúsculo).
// "nameHint" só é usado quando os gêneros da fonte não encaixam em nenhuma categoria.
const CATEGORIES = [
  {
    id: 'abertos',
    name: 'Canais Abertos',
    match: /\b(aberta|abertos?|globos?|sbt|record(tv)?|band|redetv|general|generalista|public|regionais?|afiliadas?)\b/,
    nameHint: /^(tv )?(globo|sbt|record|band|redetv|rede tv|tv cultura|cultura|tv brasil|tv aparecida|rede vida|cancao nova|rtp ?\d?|sic|tvi|telefe|el trece|canal 13|tve|la 1|antena 3)\b/
  },
  {
    id: 'esportes',
    name: 'Esportes',
    match: /\b(esportes?|sports?|futebol|espn|premiere|dazn|nba|nfl|ufc|lutas?|automobilismo|f1|ppv|jogos do dia|ge tv|caze( tv)?|goat|nsports|sportynet|x sports|sportv|combate|tenis|golfe?|campeonatos?|estaduais|liga|futsal|copa)\b/,
    nameHint: /\b(espn|sportv|premiere|dazn|combate|band ?sports|tnt sports|fox sports|ufc|nba|nfl|bein|eurosport|sky sports|f1|futebol|sports?)\b/
  },
  {
    id: 'filmes',
    name: 'Filmes',
    match: /\b(filmes?|movies?|cinema|telecine|hbo|cinemax|megapix|paramount|universal|apple tv|prime video|disney|max|star|classic|classicos?|cine|super herois?)\b/,
    nameHint: /\b(telecine|hbo|cinemax|megapix|tnt|space|universal|paramount|amc|axn|sony|warner|studio universal|cine|movies?|filmes?)\b/
  },
  {
    id: 'series',
    name: 'Séries',
    match: /\b(series?|novelas?|sitcoms?)\b/,
    nameHint: /\b(series?|novelas?|warner|fx|sony|axn|universal tv|amc|tnt series|a&e|ae)\b/
  },
  {
    id: 'noticias',
    name: 'Notícias',
    match: /\b(noticias?|news|jornal(ismo)?|legislative|legislativ[oa]s?|weather|clima|business|economia|politica)\b/,
    nameHint: /\b(news|noticias?|cnn|globonews|bandnews|record news|jovem pan|bbc|al jazeera|euronews|france 24|dw|sky news|bloomberg|cnbc)\b/
  },
  {
    id: 'infantil',
    name: 'Infantil',
    match: /\b(infantil|infantis|kids?|desenhos?|animation|animacao|animes?|cartoons?|criancas?|family|familia)\b/,
    nameHint: /\b(cartoon|nickelodeon|nick|disney (junior|jr|channel)|discovery kids|gloob|gloobinho|boomerang|baby|kids|zoomoo|tooncast|clan|duck)\b/
  },
  {
    id: 'documentarios',
    name: 'Documentários',
    match: /\b(documentarios?|documentary|discovery|history|historia|natureza|nature|science|ciencias?|education|educacao|educativos?|culture|cultura)\b/,
    nameHint: /\b(discovery|history|nat ?geo|national geographic|animal planet|smithsonian|curiosity|investigation|id|science|h2)\b/
  },
  {
    id: 'culinaria',
    name: 'Culinária',
    match: /\b(culinaria|cooking|food|gastronomia|cozinha|receitas?|chefs?)\b/,
    nameHint: /\b(food|cozinha|kitchen|chef|cuisine|cocina|cucina|gastronom|tastemade|gourmet)\b/
  },
  {
    id: 'variedades',
    name: 'Variedades e Reality',
    match: /\b(variedades?|entertainment|entretenimento|reality|fazenda|bbb|big brother|comedy|comedia|humor|woman|mulher|reelshorts?)\b/,
    nameHint: /\b(gnt|multishow|e!|tlc|lifetime|comedy|humor|fazenda|big brother|bbb|viva|mais globosat|discovery home)\b/
  },
  {
    id: 'estilo',
    name: 'Estilo de Vida e Viagem',
    match: /\b(lifestyle|estilo de vida|travel|viagens?|turismo|outdoor|ar livre|auto|carros?|motor|relax|casa|decoracao|moda)\b/,
    nameHint: /\b(travel|viagem|hgtv|home|garden|fishing|pesca|motor|auto|fashion|moda)\b/
  },
  {
    id: 'musica',
    name: 'Música e Rádio',
    match: /\b(musicas?|music|clipes?|radios?|sons para dormir|karaoke)\b/,
    nameHint: /\b(mtv|music|musica|vh1|bis|radio|fm|hits|clipes?|play tv)\b/
  },
  {
    id: 'religiosos',
    name: 'Religiosos',
    match: /\b(religios[oa]s?|religious|gospel|louvor|biblia|bibliaflix|igreja|catolic[oa]s?|evangelic[oa]s?|crista?o?s?)\b/,
    nameHint: /\b(gospel|cancao nova|rede vida|aparecida|novo tempo|rit|igreja|evangel|catolic|god|christian|ewtn|universal)\b/
  },
  {
    id: 'canais24h',
    name: 'Canais 24h',
    match: /\b(24 ?h|24 horas)\b/,
    nameHint: /\b(24 ?h|24 horas)\b/
  },
  {
    id: 'outros',
    name: 'Outros Canais',
    match: null,
    nameHint: null
  }
];

// Grupos/gêneros que derrubam o canal inteiro (conteúdo adulto).
const BLOCKED = /\b(xxx|adult[oa]s?|\+ ?18|18 ?\+|hot|sex[yo]?|erotic[oa]?|porn[oô]?)\b/;

// Canais de teste das fontes.
const TEST_CHANNEL = /\b(teste?|test hls|big buck bunny)\b/;

// Gêneros de iptv-org que não queremos como canal (lojas/televendas).
const DROPPED_GENRES = /^(shop|interactive)$/;

function categorize(genres, name) {
  const texts = (genres || []).map(normalizeText).filter(Boolean);
  const nameText = normalizeText(name);

  if (texts.some((t) => BLOCKED.test(t)) || BLOCKED.test(nameText)) {
    return null;
  }
  if (TEST_CHANNEL.test(nameText) || texts.includes('teste')) {
    return null;
  }
  if (texts.length && texts.every((t) => DROPPED_GENRES.test(t))) {
    return null;
  }

  const found = new Set();
  for (const text of texts) {
    for (const cat of CATEGORIES) {
      if (cat.match && cat.match.test(text)) {
        found.add(cat.id);
      }
    }
  }
  if (!found.size) {
    for (const cat of CATEGORIES) {
      if (cat.nameHint && cat.nameHint.test(nameText)) {
        found.add(cat.id);
        break;
      }
    }
  }
  if (!found.size) {
    found.add('outros');
  }
  // Canais 24h (reprises em loop) ficam só na linha própria.
  if (found.has('canais24h')) {
    return new Set(['canais24h']);
  }
  return found;
}

function byId(id) {
  return CATEGORIES.find((c) => c.id === id);
}

module.exports = { CATEGORIES, categorize, byId };
