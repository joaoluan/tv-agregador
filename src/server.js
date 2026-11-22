'use strict';

const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const { buildSources } = require('./sources');
const { createStore } = require('./catalog');
const { createAddon } = require('./addon');

function createApp({ sources = buildSources(), store } = {}) {
  const channelStore = store || createStore(sources);
  const sourceLabels = new Map(sources.map((s) => [s.id, s.label]));
  const addonInterface = createAddon(channelStore, sourceLabels);
  const app = express();

  app.disable('x-powered-by');

  app.get('/health', (req, res) => {
    const status = channelStore.getStatus();
    res.status(status.ready ? 200 : 503).json({
      ok: status.ready, ready: status.ready, channels: status.channels, sources: status.sources
    });
  });

  app.get('/status', (req, res) => {
    res.json(channelStore.getStatus());
  });

  app.get('/', (req, res) => {
    const rawHost = req.get('host') || '';
    const host = /^[a-z0-9.\-]+(:\d+)?$/i.test(rawHost) ? rawHost : 'localhost';
    const manifestUrl = `https://${host}/manifest.json`;
    const webInstall = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifestUrl)}`;
    res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TV Agregador</title>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.5">
<h1>TV Agregador</h1>
<p>Canais de TV ao vivo de várias fontes, organizados por categoria e sem duplicados.</p>
<p><a href="${webInstall}">Instalar no Stremio Web</a> · <a href="stremio://${host}/manifest.json">Abrir no app do Stremio</a></p>
<p>Link do manifesto: <code>${manifestUrl}</code></p>
<p><a href="/status">Ver status das fontes</a></p>
</body></html>`);
  });

  app.use(getRouter(addonInterface));

  return { app, store: channelStore };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 7000;
  const { app, store } = createApp();
  store.start();
  app.listen(port, () => {
    console.log(`TV Agregador rodando na porta ${port}`);
  });
}

module.exports = { createApp };
