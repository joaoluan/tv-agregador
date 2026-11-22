# Classificação de canais e uso do Render free — 22/11/2026

Base: main 73a7fae. Correções em fix/categorias-e-economia-free. As alterações não mudam IDs, contratos, filtros de país nem o manifesto.

## Cobertura e método

Percorridas todas as páginas das 14 categorias da produção: 2471 IDs distintos. Inventário completo de nomes/IDs/categorias em inventario-antes.csv. Sete registros estavam em Culinária (seis nomes distintos por causa do país): Food Network, Master chef, Chef Champion, Chef Roc Show, In The Kitchen e Tastemade. Nenhum nome de igreja foi encontrado nessa categoria no snapshot; não se atribuiu arbitrariamente um nome ao relato do usuário. O caso exato permanece pendente de identificação.

As quatro fontes públicas também foram carregadas no executor. Para comparar o comportamento antigo e novo, cada URL foi consultado uma vez e sua resposta reutilizada entre os dois carregadores: 1711 canais antes/depois, todos os IDs preservados e contagens por fonte 145/155/1886/142 inalteradas. Há 107 mudanças de classificação nessa fotografia, listadas em mudancas-publicos.csv e comparacao-publicos.json. Fontes privadas foram auditadas pelas categorias expostas no addon; seus links pessoais e tokens não foram lidos nem copiados. Isso não equivale a inspecionar os metadados brutos privados ou a validar editorialmente a programação de todos os canais internacionais.

## Causas reproduzidas

- O classificador lia nomes crus: [F1] em Maná Igreja Online, Kuriakos Music e Rádio Sines virava Fórmula 1. Agora a inferência usa o nome limpo, mantendo o nome cru para bloqueios adultos e de teste.
- Nome de catálogo/coleção era somado ao gênero específico do canal. Agora é fallback; país, grupos bloqueados e formato 24h da coleção são preservados.
- Metadados conflitantes de fontes acumulavam temas incompatíveis. Perfis de identidade reconhecível prevalecem sobre esses rótulos genéricos; nomes desconhecidos continuam usando os metadados.
- A regra exclusiva 24h era desfeita pelo merge com outra fonte. A exclusividade passa a valer também no índice consolidado, e o nome 24h é reconhecido mesmo quando há gênero Variedades/Infantil.

| Exemplo | Antes | Depois |
|---|---|---|
| Maná Igreja Online | Religião e Esportes | Religiosos |
| Rádio Sines / Kuriakos Music | Música e Esportes | Música |
| Canção Nova / Rede Vida / Aparecida | Abertos, Variedades e Religião | Religiosos |
| GNT | Filmes, Séries e Variedades | Variedades |
| HGTV | Filmes, Séries e Variedades | Estilo de Vida |
| Food Network | Documentários, Variedades e Culinária | Culinária e Variedades |
| Telecine | Filmes e Séries | Filmes |
| Adult Swim | Podia entrar em Infantil | Séries e Variedades |
| BBC Earth | Notícias | Documentários |
| Sabor & Arte | Variedades | Culinária e Variedades |
| Reprises com 24h no nome | Variedades/Infantil e/ou 24h | Somente Canais 24h |

Os perfis não usam a palavra Universal isolada como evidência de igreja: Universal TV e Studio Universal mantêm sua identidade de filmes/séries. [F1] é removido como etiqueta; o nome F1 sem colchetes continua em Esportes. Grupos adultos continuam bloqueando inclusive nomes conhecidos. Relações legítimas de múltiplas categorias, como AXN em Filmes/Séries, são preservadas. Não se forçou categoria para canais de identidade incerta somente para diminuir Outros.

Referências editoriais verificadas: [Kuriakos TV](https://kuriakos-tv.com/sobre-a-kuriakos-tv/) declara identidade cristã; [Sabor & Arte](https://canalsaborearte.uol.com.br/) apresenta programação gastronômica. Nomes reconhecidos são perfis editoriais de manutenção explícita, não detecção infalível por IA.

## O que rodava sozinho

Não há workflow GitHub de testes versionado, cron do TV no Render ou automação ChatGPT do TV identificada. O histórico do staging mostrou apenas o deploy pontual criado nesta auditoria anterior. Produção e staging estão com autoDeploy=no; os Blueprints estão com autoSync=false. As sondagens do Render em /health são leituras de prontidão, não execução da suíte npm test.

Existiam timers internos de atualização a cada 6h e retry em 5 minutos quando uma fonte nunca carregou, executados somente enquanto o processo estava acordado. Não eram jobs externos que despertavam o Render, mas geravam consultas desnecessárias sem uso. O novo comportamento é sob demanda: após 6h, um acesso ao catálogo/meta/stream inicia refresh compartilhado em segundo plano mantendo o índice anterior; após 5min, um acesso pode tentar somente as fontes que nunca carregaram. Sem acessos não há timer periódico de manutenção. /health e /status não consultam as fontes. start é idempotente e stop impede manutenção automática posterior.

## Franquia de horas

A documentação oficial [Render free](https://render.com/docs/free) define 750 horas mensais POR WORKSPACE para serviços web gratuitos, somando seu tempo acordado. Hibernados não consomem essas horas; cada serviço hiberna após 15 minutos sem tráfego recebido. Um serviço 24h × 30 dias usa 720h, dois usam 1440h. Esses são cenários aritméticos, não consumo real medido desta conta.

Foram encontrados três serviços web free no workspace confirmado: TV Agregador, seu staging e o backend de matrículas. O frontend de matrículas é estático e não usa a franquia de horas web; tráfego e build têm limites separados. Nenhuma configuração de matrículas foi alterada. O total mensal já consumido não está disponível nas ferramentas consultadas; não se presumiu saldo restante de 750h.

A recomendação anterior de ping /health a cada 10 minutos foi removida do README, pois impedir hibernação conflita com economizar horas compartilhadas. Não foi criado monitor ou automação periódica. O staging não foi acessado por HTTP nesta auditoria. Para evitar até despertares acidentais, a suspensão completa do staging é desejável, mas permanece PENDENTE: a integração não expõe suspensão e o painel exigiu login. A tentativa segura de login foi recusada pelo GitHub como credencial incorreta; nenhuma nova tentativa automática foi feita. Não foi alegado que o staging está suspenso.

Reduzir consultas às fontes economiza processamento e tráfego, mas não reduz por si só horas de uma instância que permanece acordada por tráfego de clientes. A confirmação do gasto mensal depende do painel Billing/Monthly Included Usage. Não se propôs keep-alive, plano pago ou infraestrutura nova.

## Verificação

Os cinco testes de regressão de classificação falharam antes da correção, pelos motivos correspondentes. Nos quatro testes de manutenção, três falhavam e o de stop/status já passava. Depois, 55 testes passaram, lint limpo e suíte verde em Node 22. Relógio simulado comprova ausência de chamadas sem acessos, atualização compartilhada sem esvaziar índice e retry sem reconsultar fonte saudável. Manifesto medido: 6023 bytes, abaixo de 6144 e 8192.

A verificação do vídeo não foi repetida: este trabalho corrige a classificação e a manutenção, não garante disponibilidade de fontes nem instala streaming server. Não foi repetido o teste de 20 minutos do staging para evitar consumi-lo sem necessidade. Nomes desconhecidos e o canal específico de igreja em Culinária relatado pelo usuário ainda podem precisar de revisão com identificação exata.
