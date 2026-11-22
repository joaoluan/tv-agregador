# Baseline técnica — 22/11/2026

Commit auditado: `6fc1afb215f9b30c2924423fa318483628c628aa`. Esta branch contém somente evidências, sem alteração de código. Fontes públicas reais, sem ADDONS_PRIVADOS nem M3U_LISTS; processo separado para IPTV_ORG off/on. Node 24.22.3 no executor local, não no Render.

`npm ci` e `npm test` executados no commit original; 24 testes passam. Saídas completas em baseline-ci.log e baseline-tests.log. Manifesto original medido por Buffer.byteLength(JSON.stringify(buildManifest())): **6002 bytes**. A2 não estoura 6 KiB nem 8 KiB no estado atual; não se deve remover filtros para forçar correção.

| IPTV_ORG | Build (ms) | Canais únicos | RSS ao concluir (MiB) |
|---|---:|---:|---:|
| off | 45469 | 1712 | 92.1 |
| on | 15282 | 11292 | 210.1 |

/status foi consultado três vezes por processo, com 300.000 ms de intervalo entre amostras; cada JSONL contém os horários e as contagens completas. A amostra inicial captura índice ainda não pronto; as duas seguintes mostram o índice pronto. O build não é reexecutado nas amostras seguintes. /health original retorna 200 até com ready=false, confirmando A6.

Itens das quatro fontes públicas: TVPlay 145, Tvvio 155, NTC TV 1886, Rede Canais 142. iptv-org trouxe 10368 itens no processo on. Não somar itens para inferir canais únicos: há deduplicação e descarte por categoria.

O RSS observado com iptv-org é maior, mas o tempo do build não foi maior nesta execução. Os dois processos usaram a mesma máquina e foram iniciados próximos; as latências das fontes variam, então isto não é benchmark causal nem evidência de OOM em 512 MB. RSS reportado ao concluir, não pico garantido.

Os limites de paginação da auditoria eram hipóteses de carga máxima, não prova de falha. Os comparativos da Fase 2 reutilizam respostas por URL para comparar a mesma fotografia das fontes.

Não verificado nesta fase: hibernação real do Render, cliente Stremio, reprodução e troca de fonte, região virginia, serviços com credenciais privadas e limites sustentados do free tier. Sem merge de código nesta fase.
