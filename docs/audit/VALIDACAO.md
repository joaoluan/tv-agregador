# Auditoria executada e validação local — 22/11/2026

Fases 1–3 implementadas em branches e PRs separados. Fase 4 **parcial: validação local concluída; staging e cliente real pendentes**. Não há autorização técnica para considerar o rollout concluído nem para fazer merge em main antes desses aceites. Os PRs estão empilhados: Fase 1 → Fase 2 → Fase 3 → Fase 4. A baseline é uma branch documental independente.

## Evidência medida

| Verificação | Baseline 6fc1afb | Depois das fases 1–3 |
|---|---:|---:|
| Manifesto serializado em UTF-8 | 6002 bytes | 6023 bytes |
| Build sem iptv-org, execução única | 45,469 s | 10,656 s |
| Canais únicos sem iptv-org | 1712 | 1711 |
| Itens TVPlay / Tvvio / NTC / Rede Canais | 145 / 155 / 1886 / 142 | 145 / 155 / 1886 / 142 |
| HTTP catálogo durante build | aguardava | 200, 6,53 ms, metas [], cacheMaxAge 0 |
| HTTP health antes/depois do build | 200 / 200 | 503 / 200, 24,25 / 2,97 ms |
| Reabertura ESPN 2 | consultava fontes novamente | 3,89 ms, 0 novas consultas |
| Suíte | 24 testes | 45 testes, três execuções consecutivas verdes |

As latências são observações locais únicas, não garantias do Render. As contagens foram também comparadas usando uma única resposta por URL, reutilizada entre os carregadores original e modificado: comparison.json. Os limites de paginação não removeram canais nessa fotografia; o único canal removido pela normalização foi FUNK +18, antes indevidamente aceito pela regex. Não houve mudança de channelKey nem variação de chaves acima de 5%.

O build final teve RSS amostrado máximo de 102,3 MiB, com amostragem a cada 100 ms. A baseline mediu RSS ao concluir de 92,1 MiB sem iptv-org e 210,1 MiB com iptv-org; não confundir RSS amostrado com pico absoluto. A baseline on terminou mais rápido que off, portanto não se atribui causalmente maior latência ao iptv-org.

Primeira abertura real do endpoint ESPN 2: 7,253 s, 6 consultas remotas, 8 opções devolvidas; repetição: nenhuma consulta remota. Não se reproduziram os links. Fonte pode ter mais de uma referência para o mesmo canal; o teste não exige uma chamada por fonte quando os refs são diferentes.

## Achados e decisões

| Achado | Resultado | Evidência / limite |
|---|---|---|
| A1 | Corrigido no handler | waitReady padrão 10s; handler usa 0 para cumprir <2s; build segue no fundo |
| A2 | Estimativa refutada | Original 6002 bytes; teste protege 6144 e 8192; filtros preservados |
| A3 | Opt-in entregue | IPTV_ORG somente on, blueprint off; custo de memória documentado, sem prova de OOM |
| A4 | Corrigido | TTL 90s, FIFO 500, compartilhamento de chamadas, invalidação no rebuild e geração protegida |
| A5 | Limites entregues | 8 catálogos × 12 páginas; teste antes fazia 400 chamadas, depois 96; dados reais sem perda |
| A6 | Corrigido | /health 503 antes de ready e 200 depois, com channels e sources |
| A7 | Corrigido no arquivo | autoDeploy=false; configuração efetiva do serviço Render ainda não aplicada |
| A8 | Corrigido | Hot Bird mantido, grupo HOT bloqueado; corrigido adicionalmente +18/18+ |
| A9 | Corrigido | Fontes públicas BR explícito; genéricas/M3U sem país ?? e filtro internacional |
| A10 | Proteção defensiva | Membro órfão injetado não lança; configuração não remove fonte dinamicamente hoje |
| A11 | Comportamento já correto para o aceite | Comentário já presente; teste SporTV 1 != SporTV 2 verde antes da mudança |
| A12 | Invariante entregue | Fetch Stremio aborta em 9s, sem retry; store exige timeout finito >9s; withTimeout não cancela fontes arbitrárias |
| A13 | Corrigido | Máximo de 3 streams por canal no iptv-org, qualidade priorizada, cabeçalhos preservados |
| A14 | Corrigido | Categoria pronta vazia recebe cacheMaxAge 1800 |
| A15 | Fixture limpa | Fixture sem U+FE0F, caso isolado já verde no normalizador original |
| A16 | Corrigido | withFetch usa try/finally no subteste offline; falha de assert injetada restaura fetch |
| A17 | Identificação de build entregue | Sufixo semver por inicialização; estável no processo e distinto em dois processos; efeito no cache do cliente não comprovado |
| A18 | Corrigido | Referência duplicada consultada uma vez, referências de outras fontes preservadas |
| A19 | Entregue | Lint limpo; dev reiniciou após alteração; lockfile atualizado |
| A20 | Coberto na Fase 2 | Testes de manifesto e IPTV_ORG default/off/on; teto original já passava, não se forçou teste vermelho |
| A21 | Coberto na Fase 1 | SporTV 1 != SporTV 2, sem mudar normalização |

## Validação reproduzível e arquivos

- npm ci: final-ci.log; npm run lint: final-lint.log.
- npm test três vezes: final-tests-1.log, final-tests-2.log, final-tests-3.log (45/45 em cada).
- Node 22: `npm exec --yes --package=node@22 -- node --test test/*.test.js`, node22-tests.log (45/45).
- Node 24.22.3 no executor padrão; não se testou cada versão histórica permitida por engines >=20.
- node --watch pelo script npm run dev: dev-watch.log mostra partida, detecção, reinício e nova partida.
- Ciclos de regressão: phase1-red/green, phase2-red/green e phase3-red/green. Fase 1: 4 casos vermelhos; Fase 2: 7; Fase 3: 7. Os testes novos para comportamentos já corretos ficaram verdes antes da correção.
- Phase1-live.json, comparison.json e final-live.json registram contagens e medições completas. Comparison reutiliza respostas por URL para evitar atribuir flutuação da fonte ao código.
- A baseline independente guarda as três amostras de /status a intervalos de 5 minutos e a saída completa da suíte original.

Os testes novos incluem configuração, catálogo frio HTTP, categoria vazia pronta, TTL/FIFO, compartilhamento simultâneo e invalidação após rebuild, fonte órfã, timeouts inválidos, qualidade de links e isolamento de fetch.

Não foram publicados links privados, listas M3U com credenciais ou variáveis pessoais. Todas as medições usaram somente fontes públicas. Os IDs de catálogo tvagg.*, prefixo tvagg:, nomes de variáveis e formato dos streams foram preservados. IDs individuais sem país passam de br para ?? como consequência necessária de A9; os públicos mantêm BR declarado.

## Pendências que bloqueiam merge e deploy

1. Preparar um serviço Render separado para staging apontando à branch de validação. A integração Render já foi conectada, mas nenhum workspace está selecionado. O workspace disponível, My workspace, precisa de confirmação explícita antes da leitura ou criação de recursos.
2. Medir cold start real após 20 minutos sem tráfego. Um monitor periódico impediria essa hibernação e precisa ficar ausente durante a medição.
3. No Stremio real: abrir categoria, abrir canal, trocar de fonte e buscar; conferir filtros, 14 categorias, paginação 100 e atualização do manifesto.
4. Comparar /status do staging com a baseline, considerando a remoção esperada de FUNK +18 e as flutuações das fontes.
5. Só depois concluir revisão, fazer os merges na ordem e deploy manual. Mudanças de render.yaml precisam ser aplicadas ao serviço; este trabalho não alterou a configuração de produção.

Responder rápido em loopback não elimina boot/roteamento da plataforma Render, e a mudança de /health para readiness pode afetar o instante em que a plataforma começa a rotear tráfego. A17 também não é prova de invalidação do cache do Stremio: metadados de build semver não alteram a precedência da versão.

ESLint 9 emite aviso de depreciação na instalação. Foi usado para manter engines >=20 sem elevar o mínimo por uma tarefa de higiene; migrar à linha que exige versão mais recente de Node requer decisão separada. Não foi acrescentada licença sem confirmação do titular; a ausência de LICENSE do anexo continua registrada.

Não avaliados: região virginia, experiência na TV, credenciais de addons privados/M3U, reprodução de streams, saturação sustentada de memória, OOM e disponibilidade das fontes ao longo de dias. Nenhum item fora do escopo foi implementado. Rollback segue por fase, revertendo o merge e redeploy do commit anterior, sem migrações.
