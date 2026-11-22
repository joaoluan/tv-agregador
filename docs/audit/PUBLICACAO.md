# Validação externa e publicação — 22/11/2026

Workspace confirmado pelo usuário: My workspace. O usuário autorizou os merges necessários em main.

## Staging criado e verificado

- Serviço: tv-agregador-staging-tr52, plano free, Virginia, Node 22.
- URL: https://tv-agregador-staging-tr52.onrender.com
- Commit de aplicação testado: 3c53a9e3a3d8c39cb8a6688bb25fd6ceb38f9417.
- Deploy dep-dc1fs2pksfps738pr200 chegou a live em 2026-11-22T14:37:34Z.
- Blueprint exs-dc1fru3l550s73ectotg, autoSync=false e autoDeploy=false; healthCheckPath=/health.
- Todas as quatro fontes carregaram; 1711 canais, itens 145/155/1886/142. Métricas do Render registraram memória entre 68,3 e 76,1 MiB nas três amostras de 14:38–14:40Z (staging-metrics.json); http_latency não retornou série neste plano, sem inferir duração do handler a partir da ausência.
- Manifesto recebido do staging: 6023 bytes, 14 categorias e catálogo de busca.

| Endpoint | HTTP | Tempo observado do executor | Resultado |
|---|---:|---:|---|
| /manifest.json | 200 | 6.571 s | versão 1.0.0+1795358248481.018974 |
| /health | 200 | 6.207 s | ready=True |
| /status | 200 | 6.200 s | ready=True; 1711 canais |
| /catalog/tv/tvagg.abertos.json | 200 | 6.338 s | 100 resultados |
| /catalog/tv/tvagg.busca/search=espn.json | 200 | 6.239 s | 6 resultados |
| /meta/tv/tvagg:br:espn2.json | 200 | 6.209 s | Espn 2 |
| /stream/tv/tvagg:br:espn2.json | 200 | 8.746 s | 8 resultados |
| /catalog/tv/tvagg.abertos/genre=Portugal.json | 200 | 6.219 s | 2 resultados |

Os tempos externos incluem a rede do executor e não equivalem ao tempo do handler medido em loopback. Até requests com serviço pronto levaram cerca de 6,2 segundos deste executor; portanto não se declara cumprido o aceite de <2 segundos ponta a ponta.

## Configuração efetiva da produção

Blueprint exs-dc1ft259fdbs73ao3lh0 adotou somente tv-agregador. O plano revisado continha apenas UpdateAutoDeploy true→false e IPTV_ORG=off, sem pedir credenciais. Aplicado com autorização do usuário. Serviço confirmou autoDeploy=no, autoDeployTrigger=off e branch=main. O deploy de configuração dep-dc1ft6qvcj2c73efmuog ficou live com o código anterior 6fc1afb.

Foi necessário explicitar branch: main no render.yaml: serviços no mesmo repo herdam a branch do Blueprint quando esse campo falta. O teste novo falhou antes de adicionar o campo e passou depois. Alteração somente de configuração; a aplicação do staging permaneceu idêntica.

## Suíte antes da promoção

46 testes passam em três execuções seguidas, além de Node 22; lint limpo. Logs release-tests-*.log, release-node22-tests.log e release-lint.log.

## Hibernação e cliente

Ociosidade iniciada em 2026-11-22T14:39:11.554608+00:00. Primeira checagem permitida somente após 20 minutos, sem requests intermediários ao staging. O Stremio Web foi preparado em modo Guest e ainda não recebeu o URL de staging durante a janela. A medição começou em 2026-11-22T14:59:11.555307Z, 1200 segundos após a última resposta. /robots.txt retornou a resposta de serviço hibernado (User-agent: *, Disallow: /) sem despertar o serviço; /health levou 28,130 s e retornou 200/ready=true. /status voltou com 1711 canais e as quatro fontes recarregadas às 14:59:39–42Z; catálogo respondeu 200 e cacheMaxAge=1800. O aceite <2s ponta a ponta não foi cumprido no Render free. Evidência completa: staging-wake.json. Não se tratou a latência do handler local como cumprimento do despertar real.

A reprodução no cliente Web pode depender do streaming server: a interface informou Streaming server is not available antes mesmo de instalar o addon. Isso será distinguido de falha do agregador.

No Stremio Web Guest, o manifesto após despertar foi aceito como versão 1.0.0+1795359577610.d7fbc6, diferente do processo anterior 1.0.0+1795358248481.018974. A instalação foi confirmada e as 14 categorias apareceram. O código de aplicação e dependências permaneceu idêntico entre o commit do staging e o candidato final; a diferença posterior foi branch: main e seu teste.

## Cliente Stremio Web Guest

A versão de staging foi instalada no cliente Web real, em Guest, sem login nem alteração da conta do usuário. O tipo TV channel, as 14 categorias e o catálogo Canais Abertos carregaram. A busca ESPN 2 mostrou o resultado na linha Canais - TV channel; abrir o resultado mostrou metadados e as quatro fontes públicas. As opções TVPlay e Tvvio foram selecionadas em sequência e o cliente retornou à lista de fontes.

A reprodução de ambas terminou em Unable to play media. O mesmo erro já havia sido observado no addon original de produção, e o cliente informou Streaming server is not available antes de instalar o addon. A causa do erro de reprodução não foi determinada; não foi atestado vídeo reproduzindo, nem foi alegado que a mudança resolveu fontes indisponíveis, CORS, codecs ou streaming server. Troca de seleção na UI foi verificada, troca com reprodução contínua permanece sem aceite.

O critério de cold start <2s e a reprodução de vídeo não foram apresentados como verdes. O usuário autorizou explicitamente os merges necessários em main e a publicação prosseguiu com essas ressalvas documentadas. Não se adicionou transcodificação ou serviço de proxy, itens fora do escopo.
