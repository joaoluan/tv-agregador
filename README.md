# TV Agregador

Addon do Stremio que junta os canais de TV ao vivo de várias fontes em **uma lista só**, organizada **por categoria** e **sem duplicados**. Ao abrir um canal, ele mostra os links de **todas as fontes** que têm aquele canal, para você trocar se um não funcionar.

## Como funciona

1. Na partida (e a cada 6 horas), o agregador lê os catálogos de todas as fontes configuradas.
2. Junta os canais com o mesmo nome. Exemplos: "Globo SP HD", "Globo São Paulo" e "Globo SP" viram um canal só, assim como "Disney Plus 07" e "Disney Plus 7".
3. Distribui os canais nas categorias: Canais Abertos, Esportes, Filmes, Séries, Notícias, Infantil, Documentários, Culinária, Variedades e Reality, Estilo de Vida e Viagem, Música e Rádio, Religiosos, Canais 24h e Outros Canais.
4. Ao abrir um canal, consulta todas as fontes ao mesmo tempo e lista os links assim: `📺 TVPlay`, `📺 Tvvio`, `📺 iptv-org`…

Dentro de cada categoria, o filtro do **Descobrir** permite escolher o país, por exemplo Culinária → Itália, ou "Internacional (fora do Brasil)". Na página inicial, os canais brasileiros aparecem primeiro e, depois deles, os que estão em mais fontes.

Conteúdo adulto, televendas e canais de teste das fontes são descartados.

## Fontes

| Fonte | Tipo | Onde configurar |
|---|---|---|
| TVPlay, Tvvio, NTC TV, Rede Canais | addons de TV do Stremio | `src/sources/index.js` |
| Addons com login pessoal (ex.: FrostStream) | addons de TV do Stremio | variável `ADDONS_PRIVADOS` no Render |
| iptv-org | base pública de canais do mundo todo | liga/desliga com `IPTV_ORG` |
| Suas listas M3U | IPTV próprio (opcional) | variável `M3U_LISTS` no Render |

**Adicionar outro addon de TV do Stremio:** copie uma linha de `STREMIO_ADDONS` em `src/sources/index.js` e troque o `manifestUrl`. O campo `priority` define a ordem dos links: o menor número aparece primeiro.

**Addon que exige login (ex.: FrostStream):** faça o login no site do addon e copie o seu link pessoal de instalação, que termina em `/manifest.json`. No Render, crie a variável `ADDONS_PRIVADOS` com o valor `FrostStream|https://seu-link-pessoal/manifest.json`. Esse link contém o seu token, por isso fica só no Render e nunca no código.

**Adicionar uma lista M3U:** no Render, crie a variável `M3U_LISTS` no formato `Nome|https://link.m3u`. Para mais de uma lista, separe por `;`. Os links ficam só nessa variável e nunca no código, o que é importante quando eles têm usuário e senha.

**iptv-org:** desligado por padrão. Use `IPTV_ORG=on` para habilitar. Baixa três bases JSON e aumenta o uso de rede e memória durante o build. Na baseline local de 22/11/2026, o RSS ao terminar foi 92 MiB sem a fonte e 210 MiB com ela (execuções únicas, não picos garantidos no Render).

**País da fonte:** os addons públicos listados em `STREMIO_ADDONS` declaram `country: 'BR'`. Fontes genéricas, privadas e M3U sem país informado usam `??` e aparecem no filtro internacional. Grupos de país em addons e `tvg-country` em M3U continuam tendo prioridade.

**Limites de carga:** cada fonte Stremio carrega até 8 catálogos e 12 páginas por catálogo; truncamentos geram aviso. Links por canal ficam em cache por 90 segundos (até 500 canais, descarte FIFO), compartilhando consultas simultâneas. Cada reconstrução invalida esse cache.

**Versão do manifesto:** recebe um sufixo de build por inicialização, estável durante o processo. Isso identifica a execução; não garante atualização automática no cliente Stremio sem validação real.

**Dois canais iguais não foram juntados?** Adicione um apelido em `src/aliases.js`.

## Publicar no Render (gratuito)

1. Crie um repositório **novo** no GitHub (ex.: `tv-agregador`) e envie esta pasta.
2. No Render, clique em **New → Blueprint** e escolha o repositório. Ele lê o `render.yaml` e cria o serviço gratuito.
3. Quando terminar, abra o endereço do serviço (ex.: `https://tv-agregador.onrender.com`). Na página, clique em **Instalar no Stremio Web**. Com isso o addon vai para a sua conta e aparece na TV.
4. Confira em `/status` quantos canais cada fonte trouxe. `/health` retorna 503 durante a construção inicial e 200 quando o índice está pronto, com as contagens.
5. Deploy automático está desativado. Antes do deploy manual, rode `npm ci`, `npm run lint` e `npm test` e conclua a validação de staging.

### Plano gratuito: servidor "dormindo"

No plano gratuito, o Render desliga o serviço depois de 15 minutos sem uso. Quando você abre o Stremio, ele acorda, mas leva entre 30 segundos e 1 minuto para religar e montar a lista. Os handlers respondem sem aguardar o índice e não permitem cache da lista vazia enquanto ele carrega. Se as linhas aparecerem vazias, saia e volte depois de alguns segundos. Esse comportamento não elimina o tempo de inicialização da própria plataforma Render.

Para evitar a espera, cadastre um monitor gratuito (como o UptimeRobot) que acesse `https://SEU-SERVICO.onrender.com/health` a cada 10 minutos. As 750 horas grátis por mês cobrem um serviço ligado o tempo todo.

## Rodar no computador

```bash
npm install
npm start          # http://localhost:7000
npm test           # testes
npm run lint       # análise estática
npm run dev        # reinicia ao alterar arquivos
```

## Endpoints

- `/manifest.json`: manifesto do addon
- `/status`: fontes, quantidade de canais e erros
- `/health`: usado pelo Render
