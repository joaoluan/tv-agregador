'use strict';

const express = require('express');
const { getRouter } = require('stremio-addon-sdk');
const { buildSources } = require('./sources');
const { createStore } = require('./catalog');
const { createAddon } = require('./addon');

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

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

  app.get('/diagnostico', (req, res) => {
    const status = channelStore.getStatus();
    const labels = {
      starting: 'Montando o catálogo',
      available: 'Catálogo disponível',
      degraded: 'Catálogo disponível com falhas em algumas fontes',
      unavailable: 'Catálogo indisponível'
    };
    const summary = labels[status.state] || 'Status desconhecido';
    const sources = status.sources.map(source =>
      `<li>${escapeHtml(source.label || source.id)} · ${source.items || 0} itens · ${source.ok === true ? 'Disponível' : source.ok === false ? 'Com falha' : 'Aguardando'}</li>`
    ).join('');
    const age = status.lastBuildAt === null ? 'Aguardando primeira carga' :
      `${Math.max(0, Math.floor((Date.now() - status.lastBuildAt) / 60000))} min desde a última rodada completa`;
    res.type('html').send(`<!doctype html><html lang="pt-BR"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Diagnóstico · TV Agregador</title>
<h1>${summary}</h1><p>${status.channels} canais · ${age}</p>
<p>${status.updating ? 'Atualização em andamento.' : 'Atualize a página para consultar o estado.'}</p>
<h2>Fontes</h2><ul>${sources}</ul>
<h2>Informar canal errado</h2><p>Copie o modelo e preencha com os dados vistos no Stremio.</p>
<textarea rows="5" cols="36" readonly aria-label="Modelo de relato">Canal:
ID (se disponível):
Fonte:
Categoria ou vídeo incorreto:</textarea>
<p><a href="/">Voltar à instalação</a></p></html>`);
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
<p><a href="/diagnostico">Ver diagnóstico das fontes</a></p>
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
