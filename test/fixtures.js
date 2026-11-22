'use strict';

// Amostras no mesmo formato das respostas reais dos addons de TV e do iptv-org.

const tvplay = {
  manifest: {
    id: 'community.tvplay',
    name: 'TVPlay',
    catalogs: [
      { type: 'tv', id: 'tvplay', name: 'TVPlay', extra: [{ name: 'genre', options: ['Esportes'] }, { name: 'skip' }, { name: 'search' }] },
      { type: 'tv', id: 'tvplay.1', name: 'Esportes', extra: [{ name: 'skip' }, { name: 'search' }] },
      { type: 'tv', id: 'tvplay.9', name: 'Portugal', extra: [{ name: 'skip' }, { name: 'search' }] }
    ]
  },
  catalogs: {
    tvplay: [
      { id: 'mc:espn2', type: 'tv', name: 'ESPN 2', genres: ['Esportes'], poster: 'https://img.example/espn2.png' },
      { id: 'mc:axn', type: 'tv', name: 'AXN', genres: ['Filmes e Séries'] },
      { id: 'mc:globosp', type: 'tv', name: 'Globo SP HD', genres: ['Abertos'] }
    ],
    'tvplay.1': [{ id: 'mc:espn2', type: 'tv', name: 'ESPN 2', genres: ['Esportes'] }],
    'tvplay.9': [{ id: 'mc:rtp1', type: 'tv', name: 'RTP 1' }]
  },
  streams: {
    'mc:espn2': [
      { name: 'TVPlay', title: 'ESPN 2 FHD', url: 'https://cdn.example/espn2.m3u8', behaviorHints: { bingeGroup: 'tvplay' } },
      { name: 'TVPlay', title: 'Abrir no navegador', externalUrl: 'https://site.example/espn2' }
    ],
    'mc:globosp': [{ name: 'TVPlay', title: 'Globo SP', url: 'https://cdn.example/globo.m3u8' }]
  }
};

// NTC: um catálogo só, paginado (skip), com gêneros por canal.
const ntc = {
  manifest: {
    id: 'br.ntctv.live',
    name: 'NTC TV',
    catalogs: [{ type: 'tv', id: 'ntctv-live', name: 'NTC TV (Todos os Canais)', extra: [{ name: 'genre' }, { name: 'search' }, { name: 'skip' }] }]
  },
  pages: [
    [
      { id: 'ntctv-1', type: 'tv', name: 'ESPN 2 HD', genres: ['️ ESPN ⚽'] },
      { id: 'ntctv-2', type: 'tv', name: 'TV Cultura', genres: ['Tv Aberta'] }
    ],
    [
      { id: 'ntctv-3', type: 'tv', name: 'Canal Hot', genres: ['️ HOT'] },
      { id: 'ntctv-4', type: 'tv', name: 'TyC Sports', genres: ['️ ARGENTINA'] },
      { id: 'ntctv-aviso', type: 'tv', name: '⚠️ NTC - Não autenticado', description: 'Requer autenticação' }
    ],
    []
  ],
  streams: {
    'ntctv-1': [{ name: 'NTC', title: 'ESPN 2', url: 'https://ntc.example/espn2.m3u8', isLive: true, behaviorHints: { notWebReady: true, proxyHeaders: { request: { Referer: 'https://ntc.example' } } } }]
  }
};

const iptvOrg = {
  channels: [
    { id: 'BBCFood.uk', name: 'BBC Food', country: 'GB', categories: ['cooking'], is_nsfw: false, closed: null },
    { id: 'ESPN2.br', name: 'ESPN 2', country: 'BR', categories: ['sports'], is_nsfw: false, closed: null },
    { id: 'Adult.us', name: 'Adult TV', country: 'US', categories: ['xxx'], is_nsfw: true, closed: null },
    { id: 'NoStream.fr', name: 'Sem Link', country: 'FR', categories: ['general'], is_nsfw: false, closed: null }
  ],
  streams: [
    { channel: 'BBCFood.uk', feed: null, title: 'BBC Food', url: 'https://iptv.example/bbcfood.m3u8', quality: '720p', labels: ['Geo-blocked'], user_agent: 'Mozilla/5.0', referrer: null },
    { channel: 'ESPN2.br', feed: null, title: 'ESPN 2', url: 'https://iptv.example/espn2.m3u8', quality: '1080p', labels: [], user_agent: null, referrer: null },
    { channel: 'Adult.us', feed: null, title: 'x', url: 'https://iptv.example/x.m3u8', quality: null, labels: [], user_agent: null, referrer: null },
    { channel: null, feed: null, title: 'Órfão', url: 'https://iptv.example/orfao.m3u8' }
  ],
  logos: [
    { channel: 'BBCFood.uk', feed: null, in_use: true, url: 'https://logo.example/bbcfood.png' }
  ]
};

module.exports = { tvplay, ntc, iptvOrg };
