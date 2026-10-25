# Spec: contratos e mappers das integrações musicais

## Objetivo

Concluir a integração entre busca, feed, resolução de stream e player para que uma faixa obtida por YouTube Music ou Piped chegue ao player em um formato interno válido, rastreável e reproduzível. Cada integração externa deve ser traduzida uma única vez para o modelo da aplicação. Nenhuma resposta externa deve ser tratada como `Track` só porque a API respondeu HTTP 200.

Este documento é o handoff para a próxima etapa. Ele registra o estado observado, as correções já presentes no workspace, o desenho recomendado, a sequência de trabalho, os testes necessários e as condições para considerar o fluxo encerrado.

## Escopo

Incluído:

- Definir contratos TypeScript para payloads externos, faixas internas, busca, origem da faixa e resolução de áudio.
- Implementar mappers puros para YouTube Music InnerTube e Piped.
- Reutilizar as mesmas funções de integração nas rotas Vercel e no servidor Express local.
- Manter o contrato de resposta consumido pela UI ou migrar seus consumidores de forma coordenada.
- Atualizar testes unitários para validar payloads válidos, incompletos e malformados, além do contrato de reprodução.
- Garantir que falhas de uma integração permitam fallback previsível para a outra fonte/engine.

Fora de escopo para a primeira implementação:

- Trocar os serviços externos ou adicionar outro catálogo, **exceto** pela decisão registrada em "Decisão: troca de provedores" (2026-10-25), que redefine este item.
- Fazer scraping/extração diretamente no navegador.
- Garantir disponibilidade de serviços públicos de terceiros.
- Refatorar visualmente o player.
- Alterar políticas de cache/offline sem um teste que demonstre que são necessárias.

## Estado atual observado

### Cadeia atual

1. A UI carrega `/api/feed` em `src/App.tsx` e consulta `/api/search?q=...` para busca online.
2. `/api/feed`, `/api/search` e o servidor local em `server.ts` tentam YouTube Music InnerTube e, em caso de falha ou ausência de resultados, consultam instâncias Piped.
3. Ambos os provedores criam objetos que se parecem com `Track`, mas usam objetos `any` e transformações duplicadas.
4. As faixas carregam `sources.youtubeId`. A UI passa a faixa para `AudioContext.playTrack`.
5. `AudioContext` tenta cache offline, depois chama `fetchPipedAudioStream(youtubeId)` via `/api/streams/:id`. Se recebe `audioUrl`, toca via `HTMLAudioElement`; senão ativa `HeadlessPlayerFallback` com a URL de YouTube.
6. A rota serverless `api/streams/[id].ts` e o endpoint Express local resolvem Piped streams separadamente e têm contratos/cache implementados em locais diferentes.

### Contratos existentes

- `src/types/music.ts` define `Track`, `AudioSource`, `AudioEngineType` e `PipedAudioStream`.
- `Track.sources` exige `localUrl: string` e `youtubeId: string`; `localUrl` vazio é usado como ausência.
- As rotas de busca retornam objetos `{ tracks, source }`, mas `tracks` é `any[]` e `source` é uma string que pode ser nome de instância ou nome de integração.
- Respostas de sucesso de stream têm `audioUrl`, `quality`, `bitrate` e `instanceUsed`; ausência de stream é devolvida como HTTP 200 com `directStreamAvailable: false` e `audioUrl: null`.
- O cliente interpreta o resultado do endpoint de stream e usa o fallback YouTube quando não há URL direta.

### Correções já presentes no workspace

Estas alterações estavam aplicadas ao inspecionar o workspace e devem ser preservadas:

- `src/utils/youtubeId.ts` contém `extractYouTubeId(value: unknown)`, que aceita ID simples, URL de watch, `youtu.be` e caminhos de embed/streams, valida 11 caracteres e retorna `null` para entradas inválidas.
- `api/feed.ts`, `api/search.ts` e `server.ts` usam esse helper ao mapear resultados Piped, filtrando IDs inválidos antes do limite de 15 resultados.
- `src/components/ExpandedPlayer.tsx` não monta mais outro `ReactPlayer` diretamente sobre a artwork. O fallback headless fica como proprietário da reprodução YouTube quando a engine ativa é `fallback`, evitando duas fontes tocando simultaneamente.
- `src/utils/audioEngine.test.ts` tem casos iniciais para `extractYouTubeId`.
- `tests/api/integrations.test.ts` invoca os handlers Vercel de busca, feed e stream com `fetch` simulado; também verifica o consumo da resposta de stream por `fetchPipedAudioStream`.
- `tests/api/integrations.live.test.ts` contém um smoke test opt-in que consulta busca/stream reais e verifica um byte de áudio direto ou a resposta oEmbed do fallback.
- `package.json` agora oferece `npm test`, executado por `tsx --test` sobre os testes de `src/` e `api/`.

Não reverter essas alterações durante a implementação dos contratos. O helper atual pode ser mantido ou reorganizado se todos os usos e testes forem migrados juntos.

### Validação registrada

- `npm test`: 20 testes passaram e um smoke live foi ignorado por padrão; os aprovados incluem seis testes de integração HTTP com respostas externas simuladas e a suíte unitária existente.
- `npm run test:integrations:live`: passou em 2026-10-24. A busca real retornou 15 faixas via `pipedapi.ducks.party`; resolução Piped de áudio direto falhou para a primeira faixa e o YouTube oEmbed confirmou HTTP 200 para o fallback.
- `npm run lint`: passou após instalar as dependências do projeto.
- `npm run build`: passou; o Vite ainda mostra avisos de `__dirname` no config loader e de chunks grandes.
- `git diff --check`: passou.
- Os testes de integração não chamam YouTube Music nem Piped reais. Eles validam handlers, parsing dos payloads-fixture, fallback e o contrato entre o endpoint de stream e o cliente.
- O smoke live faz chamadas reais e lê no máximo um byte do stream quando há URL direta; se não houver, valida oEmbed para identificar um fallback potencialmente incorporável. Isso não confirma reprodução efetiva no navegador.
- Não foi feito teste de playback em navegador. A disponibilidade real de streams Piped para outras faixas e o funcionamento de `HeadlessPlayerFallback` permanecem por validar.

## Diagnóstico de 2026-10-25 (integrações atuais degradadas)

Verificação manual com `curl`, `npm test` e `npm run test:integrations:live`:

- **YouTube Music InnerTube:** HTTP 200, mas **0 faixas extraídas**. A resposta inicia com `musicCardShelfRenderer`; o parser só lê `musicShelfRenderer` com `item.videoId` no nível raiz, e o `videoId` real não está nesse campo. Em produção tudo cai para Piped. É defeito do parser, e o endpoint não é uma API oficial.
- **Piped, busca:** só `pipedapi.ducks.party` e `api.piped.private.coffee` responderam com resultados. `pipedapi.in.projectsegfau.lt` e `api.piped.projectsegfau.lt` estão encerradas; `pipedapi.kavin.rocks` retorna 526; `piped-api.lunar.icu`, `pipedapi.palvelintalo.fi` e `pipedapi.mha.fi` retornam 502 ou não conectam.
- **Piped, stream:** `pipedapi.ducks.party` responde 200 com `audioStreams` vazio; `api.piped.private.coffee` não conectou no endpoint de stream. Não há stream direto utilizável.
- **Testes:** `npm test` (20 aprovados, 1 ignorado) usa respostas simuladas e não detecta essas falhas. O smoke live passa porque aceita a verificação oEmbed como sucesso, sem provar áudio.

## Decisão: troca de provedores (aprovada em 2026-10-25)

### Reavaliação de Piped, Invidious e NewPipeExtractor (2026-10-25)

O usuário trouxe uma pesquisa que sugeria Piped (principal), Invidious (alternativa) e NewPipeExtractor (biblioteca) para obter streams de áudio do YouTube. Validação feita antes de descartar:

- **Piped:** é o que o app já usa. Testado com Metallica, Creed e Bon Jovi nas duas instâncias que respondem (`pipedapi.ducks.party`, `api.piped.private.coffee`): `audioStreams` vazio nas 3 faixas e nas 2 instâncias. O erro é `SignInConfirmNotBotException` / `LOGIN_REQUIRED: "Sign in to confirm that you're not a bot"`, ou seja, o YouTube bloqueia o IP das instâncias. A causa raiz não é o nosso código nem a falta de uma API melhor.
- **NewPipeExtractor:** é o motor do próprio Piped e lança essa mesma exceção; a fonte do bloqueio é o IP de origem. Usá-lo diretamente herda o problema quando roda em IP de datacenter (Vercel incluído). Não foi testado em IP residencial.
- **Invidious:** a lista oficial (`api.invidious.io`) tinha 4 instâncias HTTPS e todas bloquearam a API (`403 Endpoint disabled`, `403 forbidden`, `403` e `401`). O teste partiu de um IP de datacenter e pode diferir de outro ambiente, mas o mesmo vale para o deploy.
- **Spotube e Limusic:** só referência de arquitetura; não são bibliotecas para o app web e dependem das mesmas fontes não oficiais.
- **Hipótese não testada:** hospedar o próprio Piped/Invidious ou rodar o extractor na máquina do usuário, com IP residencial, pode funcionar, mas é frágil, sem garantia e com ressalvas de termos de uso. Seria experimento separado, não base da arquitetura.

Conclusão: as ferramentas da pesquisa não resolvem o bloqueio atual. A decisão abaixo se mantém; o experimento de IP residencial fica como opção futura para áudio completo.

## Decisão (continuação)

Requisitos do usuário: uso pessoal, somente opções gratuitas, catálogo de músicas conhecidas (não amadoras) e reprodução apenas de áudio, sem vídeo visível.

Decisões:

1. **Catálogo e metadados: Deezer API** (`GET https://api.deezer.com/search?q=...`), sem autenticação. Fornece título, artista, álbum, capa, duração real, ISRC e `preview`. Substitui InnerTube e Piped como fonte de catálogo e elimina as durações inventadas (180s/210s).
2. **Reserva de catálogo/preview: iTunes Search API** (`https://itunes.apple.com/search?term=...&entity=song`), sem chave, com `previewUrl`. Limite documentado de cerca de 20 chamadas por minuto por IP; usar cache.
3. **Áudio padrão: preview de 30s** (Deezer, ou iTunes como reserva). É a única fonte oficial, gratuita e estável de música conhecida. Nem toda faixa tem preview.
4. **Áudio completo: YouTube mantido por enquanto**, tocado pelo `HeadlessPlayerFallback` (IFrame Player oculto). O usuário ainda não decidiu a solução definitiva; esta etapa não deve consolidar o YouTube como destino final. Para localizar o vídeo, buscar por "artista + título" do Deezer. Preferir a YouTube Data API v3 oficial a InnerTube/Piped.
5. **Piped e InnerTube saem do caminho de produção.** Os clients/parsers correspondentes devem ser removidos ou arquivados depois que o novo fluxo estiver testado; não manter instâncias Piped mortas na lista.
6. `Track` continua canônico. O provider do catálogo passa a ser `deezer | itunes`, e a fonte de reprodução distingue `preview` de `youtube`, conforme as decisões de arquitetura do master.

Fatos confirmados nesta verificação (com ressalvas):

- Deezer: busca respondeu sem autenticação e trouxe `preview` em MP3. A URL do preview é **assinada com expiração** (`hdnea=exp=...`); não cachear por tempo longo e re-resolver ao dar erro de mídia. Limite de requisições e termos de uso do Deezer **não foram confirmados**; verificar em developers.deezer.com antes de uso além de pessoal.
- iTunes: busca respondeu sem chave com `previewUrl`; o limite de ~20 chamadas/min vem de documentação de parceiros da Apple; a página oficial do campo `previewUrl` não foi localizada.
- YouTube Data API v3: cota padrão de 10.000 unidades/dia e `search.list` a 100 unidades, ou seja, cerca de 100 buscas por dia por projeto (fontes secundárias divergem sobre alterações recentes). Por isso, só buscar o vídeo quando o usuário pedir reprodução completa, e cachear o resultado por faixa. Exige chave própria do usuário em variável de ambiente, nunca no repositório.
- Reprodução em navegador, incluindo CORS do `<audio>` para o CDN do Deezer, **não foi testada**.

Estado da implementação (2026-10-25, primeira fatia):

- Feito: `api/_deezer.ts` (mapper `unknown` -> `Track`, deduplicação, descarte de itens inválidos, `previewUrl` omitido quando ausente ou inválido, duração real obrigatória), busca/feed/`server.ts` migrados, `AudioContext` toca a prévia, testes determinísticos (`tests/api/deezer.test.ts` e handlers) e smoke live atualizado.
- Validação: `npm test` 28 aprovados e 1 ignorado; `npm run lint` e `npm run build` passam; smoke live com Metallica, Creed e Bon Jovi obteve prévias com HTTP 206 e `audio/*`; em Chromium headless o `<audio>` avançou ~5s de uma prévia de ~30s sem erro.
- Limitações conhecidas desta fatia (resolvidas na terceira): download offline de prévias sem CORS, erro de reprodução invisível e a primeira faixa de "Metallica One" ser uma versão ao vivo (a busca do Deezer não prioriza a original; segue em aberto).
- Pendente: ver a seção "Estabilização" abaixo.

Áudio completo via YouTube (2026-10-25, segunda fatia):

- Feito: `GET /api/resolve?artist=&title=&duration=` devolve `{ videoIds }` (até 3, melhor primeiro). `api/_youtubeSearch.ts` usa a YouTube Data API v3 quando `YOUTUBE_API_KEY` existe (busca + `videos.list` com duração e `status.embeddable`) e, sem chave, a busca web não oficial do YouTube (frágil, mesma natureza do InnerTube). O ranqueamento exige duração dentro de 15s da faixa do Deezer, penaliza live/cover/remix/karaoke quando a faixa não os tem e prefere canal do artista, "- Topic" e "official audio". `AudioContext` toca o primeiro vídeo no `HeadlessPlayerFallback`, tenta os seguintes em erro do embed e por fim a prévia; cada resolução é cacheada na sessão e no CDN por 1 dia.
- Defeito corrigido: `HeadlessPlayerFallback` usava a API do react-player v2 (`url`, `onProgress`, `seekTo`) com a v3 instalada (`src`, `onTimeUpdate`, `currentTime`), então o fallback nunca tocou. Também corrigido: o evento `error` do `<audio>` ao limpar `src` derrubava o estado de reprodução ao trocar para o YouTube.
- Validação: `npm test` 45 aprovados e 2 ignorados (live); smoke live acha vídeos para Creed, Bon Jovi e Queen; no app, com a resposta de `/api/resolve` simulada com um vídeo incorporável, o primeiro candidato bloqueado (150) levou ao segundo, que tocou com duração total de 213s e `currentTime` avançando de 0,3s para 6,4s.
- **Não confirmado:** a incorporação de vídeos musicais reais. No ambiente de teste (Chromium headless, IP de datacenter) todos os candidatos de 6 faixas do feed deram erro 150, e um vídeo de teste conhecido também; só o vídeo de Rick Astley tocou. Não está claro se é bloqueio dos donos dos vídeos ou do ambiente. O `oEmbed` respondeu OK para vídeos que o player recusou, então não serve de pré-checagem confiável. Validar em navegador comum, com IP residencial, antes de afirmar que o áudio completo funciona para o usuário.
- Cota: `search.list` custa 100 unidades (cerca de 100 buscas por dia com a chave gratuita) e cada faixa tocada gera uma resolução; a busca web sem chave não tem cota, mas pode ser bloqueada.

Estabilização (2026-10-25, terceira fatia):

- **Confirmado pelo usuário em produção:** a faixa completa tocou no celular (IP residencial/móvel). Isso indica que os erros 150 do ambiente de teste vinham do IP de datacenter.
- Feito: busca com reserva iTunes (`searchCatalog`); `GET /api/audio` para baixar prévias offline sem CORS, restrito a CDNs de catálogo; favoritos guardam a faixa (migração dos ids `deezer-*`/`itunes-*` antigos quando a faixa reaparece, descarte dos ids `ytm-*`/`piped-*`); `PlaybackNotice` mostra erro ou aviso de prévia; falha da API oficial do YouTube (cota, chave) cai na busca web; faixas completas do YouTube não podem ser baixadas e a UI explica.
- Validação: `npm test` 65 aprovados e 3 ignorados (live); smoke live inclui iTunes; no Chromium headless, favorito salvo aparece na biblioteca com o feed vazio, a prévia toca com o aviso quando `/api/resolve` não acha vídeo, e o download offline guarda a prévia pelo proxy e mostra o aviso de 30s; o proxy devolve 400 para hosts fora da lista (incluindo `169.254.169.254`).
- Limitações conhecidas: o feed não tem reserva (se o Deezer cair, as categorias ficam vazias); o download offline guarda só os 30s da prévia, e o aviso diz isso; a busca web do YouTube, usada sem chave ou quando a API recusa, é não oficial e pode ser bloqueada.
- Pendente: reserva iTunes para o feed; remoção do código Piped de stream (`api/streams/[id].ts` e usos em `audioEngine.ts`); contrato versionado de resposta.

Estabilização (2026-10-25, quarta fatia):

- Player do YouTube: `src/components/youtubePlayer.ts` cria um ReactPlayer só com o provedor do YouTube. O build deixou de gerar os chunks de hls.js, dash.js, Mux, Vimeo e outros (de 17 arquivos para 4) e o aviso de chunks acima de 500 kB sumiu. Depende de exports não documentados do `react-player` 3.x; ver `AGENTS.md`.
- Laço de renders corrigido: o `console.error` "Maximum update depth exceeded" aparecia em toda reprodução (2 a 4 vezes por faixa, inclusive só com prévia). Causas: `tracks={allLiveTracks.slice(0, 20)}` criava um array novo a cada render do App e o `useEffect([tracks])` do `TrackList` chamava `setState` em toda renderização; além disso o gerador do espectro atualizava o estado do contexto a cada frame (60 por segundo) mesmo com o player recolhido, re-renderizando todos os consumidores. Agora o array é memoizado, o `TrackList` mantém o estado anterior quando nada mudou, e o espectro só roda com a faixa tocando e o player expandido, a cerca de 20 quadros por segundo.
- Validação: no Chromium headless, o aviso aparece 0 vezes em 5 cenários de reprodução (antes de 2 a 4); o visualizador continua animando com 24 barras quando o player expandido está na aba Frequência; a troca do primeiro vídeo bloqueado (150) para o segundo continua funcionando com o player novo (duração 213s, tempo avançando).
- Observação: o espectro é simulado (seno com ruído), não vem de análise do áudio, apesar do rótulo "Espectrograma Web Audio API / LIVE STREAMING" no player expandido. Não alterado.

Observabilidade (2026-10-25, quinta fatia):

- Primeiro uso em produção (deploy da `main` em 6712eb1, janela de 30 minutos): `/api/feed`, `/api/search` e `/api/resolve` responderam 200 em todas as chamadas; a busca devolveu 15 faixas via Deezer em 383ms. As respostas apareciam com `cache MISS`, esperado nas primeiras chamadas.
- Aviso `DEP0169 url.parse()` com nível `error`: aparece uma vez por instância de função (partida a frio). Nenhum código do projeto usa `url.parse` e as funções não importam pacotes externos, então a origem é o runtime Node da Vercel. Não afeta o funcionamento e não há correção no repositório; para tirá-lo do filtro de erros, a opção é definir `NODE_OPTIONS=--no-deprecation` nas variáveis do projeto na Vercel.
- Lacuna encontrada: `/api/resolve` não registrava nada quando funcionava (impossível saber se a `YOUTUBE_API_KEY` estava em uso) e o feed engolia falhas de categoria sem log. Agora cada resolução registra uma linha `[Resolve] ✅|⚠️ "artista - título" → N vídeo(s) via official|web|web-after-official-failure em Xms`, e o feed registra `[Feed] ✅|⚠️ trending=N rock=N pop=N lofi=N em Xms` mais um aviso por categoria que falhou. A chave nunca é registrada.
- Como ler: `via web` com a chave configurada indica que a chave não está chegando à função; `via web-after-official-failure` indica cota esgotada ou chave recusada (a causa aparece no aviso `[YouTube] API oficial indisponível`); `0 vídeo(s)` quer dizer que a faixa só toca em prévia.

Coleções fiéis e paginação (2026-10-25, sexta fatia):

- Problema: as coleções da home não correspondiam ao que prometiam. "Classic Rock" e "Alternative Pop" eram os charts de gênero do Deezer (o de pop trazia country e faixas virais), "Lofi Chill" era uma busca de texto que devolvia lixo como "Wii U Mii Maker Lofi Slowed", e "Synthwave" não tinha dados: selecioná-la mostrava todas as faixas e a contagem era a do lofi. A busca e as coleções traziam só 15 faixas, sem paginação.
- Fonte de cada coleção (`api/_categories.ts`): uma playlist editorial do Deezer cujo conteúdo foi conferido contra a descrição. `top-hits` = "Top Brazil" (Deezer Charts, 100); `classic-rock` = "Rock Essentials" (Deezer Rock, 100: AC/DC, Pink Floyd, Bowie, Beatles); `alternative-pop` = "New Alternative" (Deezer Alternative, 150), renomeada na tela para "Alternative & Indie", já que o conteúdo é indie/alternativo e não pop; `lofi-chill` = "study lofi" (Deezer Mood, 92); `synthwave` = "Synthwave" (Deezer Dance, 50). Nome e descrição de cada coleção ficam em `src/data/musicCatalog.ts` e só devem mudar junto com a playlist; `tests/api/categories.test.ts` garante que toda coleção da tela tem playlist e vice-versa.
- Contrato das rotas (`api/_endpoints.ts`, compartilhado entre as funções da Vercel e o Express): `GET /api/feed` devolve `{ categories: { [id]: { tracks, total, nextIndex } }, featured }` com a primeira página (15) de cada coleção; `GET /api/category?id=&index=&limit=` e `GET /api/search?q=&index=&limit=` devolvem uma página (`limit` padrão 20, máximo 50, inteiros não negativos; id desconhecido = 400). `nextIndex` conta os itens que o Deezer devolveu, não os que viraram faixa, para que um item descartado não desloque a página seguinte; `null` indica o fim. Falha dos provedores = 502 sem cabeçalho de cache (antes: 200 com lista vazia, que o CDN podia guardar). A reserva iTunes só vale para a primeira página da busca (a API da Apple não pagina).
- Faixas sem prévia deixam de ser descartadas: a reprodução completa vem do YouTube e a prévia é só o plano B, e descartar itens quebrava a conta da paginação. A faixa sem nenhuma fonte mostra o aviso de erro.
- Interface: `usePagedTracks` carrega a lista página a página, cancela o que estava em andamento quando a coleção ou a busca muda, e começa da página que o feed já trouxe; `LoadMoreSentinel` carrega a próxima página quando o fim da lista se aproxima da tela (IntersectionObserver com margem de 600px, recriado a cada página para não travar com a lista curta), com botão "Carregar mais" e "Tentar de novo". O cabeçalho mostra "N de TOTAL faixas". Cada carrossel da home tem "Ver tudo", que abre a coleção inteira. Chips e grade vêm de `CATEGORIES`, então nomes e rótulos não divergem. "Músicas Recomendadas" virou "Mix das coleções" (4 faixas de cada), e o destaque diz "No topo do Brasil agora".
- Validação: `npm test` 81 aprovados e 4 ignorados (live); lint e build passam; smoke live confere que cada playlist existe, tem 20 faixas ou mais e que a página 2 não repete a 1. No Chromium headless: a primeira faixa de "Classic Rock" é "AC/DC - Back In Black"; rolar a lista carrega as páginas em 15, 35, 55, 75 e 95 até "100 faixas", sem repetidos e sem o botão no fim; "Synthwave" mostra só synthwave (35 linhas ao abrir, de 50); a busca "queen" carregou 20, 40, 60 e 80 de 192 sem ids repetidos; com o backend em 502, a coleção mostra o erro e "Tentar de novo" recarrega; o feed em 502 mostra a mensagem e o retry recarrega; nenhum aviso ou erro no console.
- Limitações: faixas diferentes com o mesmo título e artista (remasters, coletâneas) aparecem como linhas parecidas, porque a linha não mostra o álbum; as playlists editoriais podem ser renomeadas ou removidas pelo Deezer (o smoke live avisa); "Top Hits" é o top do Brasil, não o global; o feed ainda não tem reserva se o Deezer cair; a busca no "catálogo local" filtra só o que já foi carregado.

Rádio e novo menu (2026-10-25, sétima fatia):

- Menu inferior: Início, Rádio, Biblioteca e Buscar (antes: Início, Buscar, Navegar e Biblioteca). O "Navegar" não tinha tela própria, mostrava a mesma home. Escolha do usuário para o "Rádio": estações por gênero, com fila contínua.
- Fonte (`api/_radios.ts`): 31 estações em 8 grupos (Brasil, Pop, Rock e Metal, Hip-hop e R&B, Soul e Funk, Eletrônica, Jazz e Blues, Mais estilos), um subconjunto curado das rádios do Deezer. A lista do Deezer é ruidosa: estações de eventos ("Liverpool Sound City 2016"), duplicadas, uma "Brazilian Music" vazia e uma "Kids Pop" que toca rap francês; "Techno" e "Pop Rock" também foram descartadas por trazerem outro estilo. Cada estação mantida teve o conteúdo conferido contra o nome. Nomes são nossos (pt-BR) e as capas vêm de `/radio/genres`; uma estação que o Deezer deixe de listar sai da tela, e o smoke live avisa.
- Como o Deezer entrega uma rádio: cada chamada a `/radio/{id}/tracks` devolve 40 faixas embaralhadas de um conjunto fixo de 50 a 120, sem paginação e diferente a cada chamada (34 de 40 se repetiram entre duas chamadas). Continuar tocando é pedir de novo.
- Contrato: `GET /api/radio` devolve `{ genres: [{ id, name, stations: [{ id, name, picture }] }] }` (cache de 1 dia); `GET /api/radio?id=` devolve uma página de faixas (`style` = nome da estação, `nextIndex` sempre null) sem cache, já que cada chamada precisa ser um novo embaralhamento; id fora da lista curada = 400; falha do Deezer = 502. Um único endpoint cobre as duas coisas para não gastar outra vaga de função (agora 8 de 12).
- Fila contínua (`AudioContext`, `src/utils/radioQueue.ts`): `startRadio` carrega o primeiro lote e toca; quando restam 5 faixas ou menos, pede outro lote e `pickRadioRefill` escolhe o que entra: prefere faixas fora das últimas 40 tocadas, devolve as mais antigas só se houver menos de 10 novas, e nunca repete as últimas 15. Tocar uma lista (coleção, busca) encerra o modo rádio; sair da aba não. A rádio ignora o aleatório e não tem fim.
- Faixa que não pode tocar (sem vídeo e sem prévia, ou embed bloqueado sem prévia) é pulada sozinha na rádio, porque ela se ouve sem tocar na tela. Depois de 5 pulos seguidos desiste, para com o aviso de erro e não fica em laço; o contador zera quando uma faixa realmente toca.
- Validação: `npm test` 103 aprovados e 5 ignorados (live); lint e build passam; smoke live confere que as 31 estações existem e rendem 20 faixas ou mais, e que duas chamadas seguidas vêm em ordem diferente. No Chromium headless: o menu mostra Início, Rádio, Biblioteca e Buscar; a tela tem 8 grupos e 31 estações com capa; ao tocar "Rock Clássico" a estação fica marcada; avançando 61 faixas seguidas a fila não acabou e a rádio pediu mais faixas uma vez, sem faixa repetida a menos de 23 plays de distância; sair para a home mantém a rádio tocando e tocar uma coleção desmarca a estação; sem vídeos, a rádio real pulou a faixa sem som e tocou a seguinte, sem aviso de erro; com todas as faixas indisponíveis tentou 6 e parou com o aviso, sem laço.
- Limitações: o conjunto de cada estação é pequeno (50 a 120 faixas), então ouvir por horas repete faixas; cada faixa da rádio é uma busca de vídeo no YouTube (100 unidades da cota diária de 10.000), então a rádio consome a cota rápido e, esgotada, o app usa a busca web não oficial; a rádio da faixa tocando (por artista) não foi feita, porque as faixas não guardam o id do artista; o nome do grupo "Mais estilos" é provisório.

Coerência do menu (2026-10-25, oitava fatia): auditoria das abas Início, Biblioteca e Buscar depois da troca do menu. Defeitos encontrados no navegador e corrigidos:

- O chip de coleção tocado na aba Biblioteca ficava marcado, mas a tela continuava nos favoritos. Agora todo chip leva à tela que mostra o que ele seleciona: "Favoritos" abre a Biblioteca e os demais abrem a home.
- A aba marcada no menu não seguia a tela: abrir a busca pelo ícone do topo deixava "Início" marcada, e fechá-la deixava "Buscar" marcada sobre a home. Agora a aba marcada é derivada do que está na tela (`navTab`) e o botão ativo ganha `aria-current="page"`.
- O texto digitado na busca continuava filtrando as outras telas: com "queen" digitado, a home passava a mostrar "Resultados para queen" com o campo de busca escondido, sem como limpar. Agora sair da busca (por outra aba ou pelo ícone do topo) limpa o texto.
- Os quatro botões do menu tinham larguras diferentes (57, 57, 76 e 63px) e centros espaçados de 94, 102 e 106px. Agora são quatro colunas iguais.
- Verificado no Chromium headless com 360, 414 e 768px de largura: colunas iguais; chip na Biblioteca abre a coleção com "Início" marcada; chip "Favoritos" abre a Biblioteca; busca aberta e fechada pelo topo marca e desmarca "Buscar"; texto digitado some ao sair; sem erros nem avisos no console.

Rádio ao vivo (2026-10-25, nona fatia): o usuário observou que uma rádio deveria ser reprodução ao vivo, e não uma playlist. A fila infinita do Deezer (sétima fatia) continua sendo um mix automático e tinha controles de playlist. Escolha do usuário: as duas coisas, com a aba Rádio em duas seções.

- Seção "Ao vivo": 25 rádios de verdade em 7 grupos (Pop e hits, Rock, MPB e clássicos, Sertanejo, Samba, pagode e forró, Jazz e soul, Notícias e esporte), em `src/data/liveRadios.ts`. Vieram do Radio Browser (diretório comunitário, `all.api.radio-browser.info`), que falha de forma intermitente (consultas caíram com erro de SSL) e tem muitas entradas mortas (só 17 de 38 candidatas por gênero responderam), por isso o app nunca o consulta: a lista é fixa, com o endereço de cada transmissão testado em 2026-10-25. Estações como Antena 1, Mix FM, Transamérica, Kiss FM, 89 FM, Alpha FM, CBN, BandNews, Itatiaia e Rádio Globo estão na lista. Não usa nenhuma função da Vercel nem o YouTube: é um `<audio>` direto no endereço da transmissão (HTTPS obrigatório, por causa do app em HTTPS).
- Modelo: `liveStationToTrack` transforma a estação em um `Track` com `sources.isLive` e `duration` 0, para o player, a fila e a media session tratarem como qualquer faixa. O id (`live-...`) não casa com os ids de favoritos, então uma estação nunca vai para a Biblioteca.
- Player de rádio (ao vivo e mix por gênero): a linha do tempo, o aleatório, o repetir e o anterior somem. Ao vivo mostra "RÁDIO AO VIVO", o nome da estação, a etiqueta "AO VIVO" e só play/pausa e volume (sem próxima, sem coração e sem a aba Letra); o mix por gênero mostra "Rádio {estação}" e mantém próxima e coração. O mini player esconde a barra de progresso (ao vivo, uma linha pulsante) e a próxima. A media session de uma transmissão desliga anterior, próxima e busca.
- Comportamento ao vivo: pausar e retomar sintoniza de novo em vez de tocar o que ficou no buffer; a duração infinita que o navegador informa é ignorada; se a estação derruba a conexão, o player para e avisa; o botão da estação mostra "No ar agora".
- Validação: `npm test` 107 aprovados e 6 ignorados (live); lint e build passam; o smoke live abre as 25 transmissões, exige `audio/*` e 8 KB de áudio e todas responderam. No Chromium headless (com uma estação em MP3, pois esse Chromium não decodifica AAC): a tela lista as 25 estações; ao ouvir "Zé Ramalho" o áudio avança (5,2s em 6s) e o botão fica marcado; no mini player não há próxima e a barra pulsa; no player expandido aparecem "AO VIVO" e o cabeçalho, e não há linha do tempo, aleatório, anterior, próxima, repetir, coração nem Letra; pausar e retomar recomeça do ao vivo (tempo 3,2s depois de 4s); o mix "Rock Clássico" mostra a pílula e esconde linha do tempo, aleatório, anterior e repetir, mantendo próxima e coração; uma lista normal traz todos os controles de volta; sem erros nem avisos no console.
- Limitações: o formato de cada estação segue o nome e as etiquetas do diretório, sem checagem por audição; várias estações são de São Paulo e algumas podem bloquear fora do Brasil (o teste foi feito de um servidor nos EUA e todas responderam, mas não de um aparelho brasileiro); não mostra a música no ar (o navegador não lê esse dado da transmissão; leria-se por uma função no servidor); tem propaganda e locução, como qualquer rádio; estações mudam de endereço ou saem do ar (o smoke live avisa); em AAC o áudio depende do aparelho (iPhone e Chrome tocam), e não foi testado num aparelho real nem com a tela bloqueada.

Critérios de aceite adicionais para esta troca:

- Busca e feed devolvem `Track` com duração real vinda do provedor, sem passar por Piped/InnerTube.
- Faixa sem `preview` é sinalizada explicitamente (sem tocar silêncio) e oferece o caminho completo via YouTube.
- Teste determinístico de mapper Deezer/iTunes com fixtures, incluindo `preview` ausente e vazio; testes continuam sem rede.
- Smoke live atualizado para exigir áudio direto do preview (ao menos um byte) em vez de aceitar apenas oEmbed.
- Teste de playback em navegador antes de declarar a reprodução funcionando.

## Problema central

A aplicação não tem uma fronteira tipada e testável entre respostas externas e o player. O mesmo conceito de conversão está copiado em três locais, usa `any` e deriva identidade com regras locais. Isso abre espaço para que uma integração retorne uma faixa que satisfaz superficialmente a interface, mas contém ID inválido, metadados incorretos, duração inventada ou uma fonte que o player não sabe resolver.

Além disso, `youtubeId` mistura duas dimensões diferentes:

- **Origem do catálogo**: de qual integração veio a metadata (YouTube Music ou Piped).
- **Fonte de reprodução**: como obter o áudio (stream direto, resolver Piped pelo video ID, URL local/offline ou fallback YouTube).

Essas dimensões precisam ser representadas sem confundir uma com a outra.

## Desenho alvo recomendado

### 1. Modelos internos e externos

Adicionar contratos explícitos em uma área compartilhada, sugerida: `src/integrations/contracts.ts` ou `src/types/integrations.ts`.

A forma exata deve seguir a implementação, mas cobrir ao menos:

```ts
export type CatalogProvider = 'youtube-music' | 'piped';

export interface SearchResult {
  tracks: Track[];
  source: CatalogProvider;
}

export interface TrackSource {
  provider: 'youtube';
  videoId: string;
}

export interface ResolvedAudioStream {
  url: string;
  quality?: string;
  bitrate?: number;
  provider: 'piped';
  instanceUsed?: string;
}

export type StreamResolution =
  | { status: 'resolved'; stream: ResolvedAudioStream }
  | { status: 'fallback-required'; videoId: string; reason: string };
```

O exemplo é uma direção, não uma exigência de manter nomes ou os mesmos campos. Requisitos do contrato:

- Distinguir origem dos metadados de engine/fonte de reprodução.
- Não usar string vazia como ausência de uma fonte quando uma união discriminada ou propriedade opcional expressa isso com mais clareza.
- Tornar impossível, pelo tipo, construir um resultado `resolved` sem URL ou um resultado `fallback-required` sem video ID.
- Preservar `Track` como formato canônico que a UI, fila, favoritos e player consomem.
- Preservar compatibilidade com cache offline, cujo índice atual usa `track.id`, e avaliar explicitamente a compatibilidade dos IDs favoritos persistidos no localStorage antes de mudar a identidade de faixas.
- Evitar expor payloads inteiros externos ao domínio/UI.

Se a migração da interface `AudioSource` atual for grande, introduzir o contrato novo e um adaptador temporário no limite. Não realizar alteração parcial que deixe alguns consumidores esperando `youtubeId` e outros esperando `videoId` sem conversão única e testada.

### 2. Validação runtime e mappers puros

Criar funções independentes de rede e sem efeitos colaterais, por exemplo:

- `mapPipedSearchItemToTrack(input: unknown): Track | null`
- `mapYouTubeMusicItemToTrack(input: unknown): Track | null`
- `mapPipedStreamPayload(input: unknown): ResolvedAudioStream | null` ou equivalente para seleção do melhor audio stream.

Requisitos dos mappers:

- Aceitar `unknown` nos limites externos; validar objetos, strings e números antes de acessar campos.
- Retornar `null` (ou resultado discriminado inválido) para entradas que não são uma faixa reproduzível. Não lançar por payload incompleto comum.
- Validar video ID usando o helper atual ou lógica central equivalente. Nunca aceitar que o `id` de faixa seja uma URL sem normalização.
- Normalizar URL Piped relativa/absoluta, ID direto, URL `watch?v=...` e short URL dentro de uma política explícita.
- Rejeitar duração `NaN`, infinita, zero ou negativa como metadata válida; usar fallback só se essa política for mantida e documentada. Preferível preservar o fallback existente de 180 segundos para Piped enquanto a UI depende de duração válida, mas não fingir que o valor veio do provedor.
- Tratar campos opcionais com fallback local consistente: artista desconhecido, álbum single e artwork fallback.
- Preferir artwork/thumb fornecido pelo payload quando disponível e URL derivada do video ID quando apropriado.
- Garantir que `sources` contenha os identificadores necessários para o resolvedor funcionar.
- Não executar `fetch`, ler estado React, localStorage ou acessar `window`.
- Deduplicar pela identidade canônica do vídeo, não apenas pelo prefixo `ytm-`/`piped-`, para evitar duplicatas entre integrações. Antes de mudar `Track.id`, avaliar impacto em liked IDs/offline IDs persistidos.

O parser YouTube Music atual assume o caminho específico `tabbedSearchResultsRenderer -> tabs -> sectionListRenderer -> musicShelfRenderer -> musicResponsiveListItemRenderer`, lê colunas fixas e usa duração fixa de 210 segundos. Isolar essa travessia em extração/mapping tipado. Se a resposta mudar ou vier por outra forma de shelf, o mapper deve retornar zero resultados com segurança, permitindo fallback Piped.

### 3. Separação entre cliente de integração e mapper

Um cliente de provedor pode fazer rede e retornar `unknown` ou DTOs validados; o mapper converte para domínio. Exemplo de módulos (adaptar à estrutura que já existe):

```text
src/integrations/music/
  contracts.ts
  pipedClient.ts
  pipedMapper.ts
  youtubeMusicClient.ts
  youtubeMusicMapper.ts
  searchMusic.ts
  streamResolver.ts
```

Não é obrigatório criar todos esses arquivos. Evitar fragmentar código em excesso. A condição importante é que:

- As funções de chamada aos provedores sejam reutilizadas por `api/feed.ts`, `api/search.ts` e `server.ts`.
- As rotas cuidem de HTTP, parâmetros, status/cache e serialização, não de parsing de payload externo.
- Configuração de instâncias Piped não fique repetida em `api/feed.ts`, `api/search.ts`, `api/streams/[id].ts` e `server.ts`.
- Feed e busca usem o mesmo `SearchResult` e o mesmo modelo `Track`.
- A ordem atual continue explícita: tentar YouTube Music primeiro; usar Piped se houver erro ou resultados válidos insuficientes/ausentes. Definir se resultados vazios são fallback e testar isso.

Pode-se definir uma interface pequena como `MusicSearchProvider`, mas não é preciso construir framework genérico de plugins. Só introduzir abstração de provider se ela for usada realmente nos dois provedores e simplificar teste/ordenação de fallback.

### 4. Contrato da resolução e proprietário de reprodução

O player só deve receber uma faixa normalizada. Um único fluxo escolhe a engine:

1. Cache offline válido da faixa.
2. Stream direto de `localUrl`, se configurado e validado.
3. Resolver Piped a partir do ID canônico do YouTube.
4. Fallback YouTube headless se stream Piped não estiver disponível.
5. Erro explícito se não houver fonte reproduzível ou se o player headless falhar.

Requisitos:

- `fetchPipedAudioStream` deve validar a resposta da API interna; HTTP 200, sozinho, não prova que `audioUrl` é uma URL utilizável.
- O timeout deve ser sempre limpo com `finally`, inclusive em erro de `fetch`/JSON; o código atual limpa apenas depois de uma resposta bem-sucedida.
- Stream direto selecionado deve ter URL `http(s)` válida, bitrate/quality normalizados e compatibilidade de mime observável quando disponível.
- Erro do `HTMLAudioElement` após receber stream Piped deve poder tentar uma alternativa sem deixar a UI eternamente em `isPlaying` ou `isBuffering`.
- Erro no `HeadlessPlayerFallback` não deve apenas `console.warn`; definir um canal de erro/estado de playback e parar/atualizar controles de forma coerente. Uma tentativa automática de próximo provedor pode ser considerada, mas evitar loop infinito ou trocar de faixa silenciosamente.
- Um único elemento/engine controla áudio por vez. `ExpandedPlayer` não deve criar um player YouTube independente do `activeEngine`; a correção já está aplicada e precisa de teste/revisão visual se o painel voltar a ser alterado.
- Corrigir/revisar `pipedStatus`: o contexto inicializa o status, atualiza cache offline, mas o caminho de sucesso Piped deve também informar qualidade/instância; status precisa refletir a engine efetiva.

A duração do cache de URL de áudio merece verificação específica: `server.ts` guarda URL Piped por quatro horas, enquanto Vercel/CDN usa `s-maxage=3600`. URLs assinadas podem expirar antes do cache. Não reduzir/aumentar TTL por suposição; criar um teste/observação que determine a política ou documentar cache curto/re-resolução após erro de mídia.

## Sequência sugerida de implementação

1. **Preparar validação**: identificar a ferramenta de teste adotada pelo projeto; instalar dependências com `npm ci`, conforme `package-lock.json`, o único lockfile do projeto. Não reintroduzir outro gerenciador de pacotes sem justificativa.
2. **Definir contratos**: ajustar `src/types/music.ts` ou criar módulo compartilhado para catálogo, fonte, busca e stream. Decidir a migração de `youtubeId`/`localUrl` com todos os usos localizados.
3. **Escrever testes de mapper primeiro**: fixtures mínimas inspiradas no formato atual dos payloads, cobrindo válidos, campos ausentes, IDs inválidos, URL relativa/absoluta, duração ruim, artwork ausente, payload não-objeto e deduplicação.
4. **Implementar mappers puros**: Piped Search, YouTube Music e seleção/resposta de audio stream.
5. **Extrair clientes compartilhados**: remover cópias da busca e lista de instâncias entre Express e rotas Vercel. Injetar `fetch`/dependências como argumento onde necessário para testes determinísticos; não chamar serviços reais nos testes unitários.
6. **Migrar feed e busca**: garantir mesma estrutura de resposta e mesma política de fallback; tratar status/erros em um local previsível.
7. **Migrar resolução**: validar resposta de `/api/streams`, manter fallback, registrar status correto e tratar erros do elemento de áudio/player headless.
8. **Atualizar testes**: adicionar testes de contrato nos clients, rotas e fluxo de resolução; manter os testes existentes de queue, tempo, offline e IDs.
9. **Rodar validações**: typecheck, todos os testes unitários, build e checagem de diff. Fazer smoke test com serviços externos manualmente, sem torná-lo dependência da suíte unitária.
10. **Revisar compatibilidade**: IDs persistidos em favoritos/cache offline, Service Worker/cache API, URLs de busca e layout/capa do player.

## Matriz mínima de testes

### Mappers de busca

- Piped item com `/watch?v=VIDEO_ID` válido gera uma faixa completa e reproduzível.
- Piped item com URL absoluta `youtube.com/watch?v=...`, `youtu.be/...`, `/streams/VIDEO_ID` e ID direto é tratado conforme a política escolhida.
- URL sem ID válido, ID com tamanho/caracteres inválidos, título ausente ou URL ausente é rejeitado sem exceção.
- Payload Piped sem `items`, `items` que não seja array, JSON `null` ou texto inválido retorna zero faixas/erro tipado conforme a fronteira.
- Itens inválidos antes de itens válidos não fazem o limite de 15 eliminar todos os válidos.
- Campos opcionais (`uploaderName`, `duration`, `thumbnail`) recebem fallbacks consistentes.
- YouTube Music extrai video ID, título, artista, álbum e artwork do fixture conhecido; campos incompletos são tratados sem exception.
- Resultado YouTube Music vazio ou mapper sem faixas faz fallback Piped.
- IDs duplicados entre shelves ou provedores são deduplicados pela chave acordada.

### Busca/feed e contratos HTTP

- Busca sem `q` retorna 400 sem chamar os provedores.
- Busca com resultado válido retorna `{ tracks: Track[], source: CatalogProvider }` (ou o contrato versionado acordado).
- Erro/timeout/HTTP inválido YouTube Music provoca fallback Piped.
- Falha em uma instância Piped permite outra instância; falha total retorna resposta vazia e válida, não payload inconsistente.
- Feed devolve `categories` (uma página por coleção) e `featured`, e cada item passa pelo mesmo contrato de Track (ver "Coleções fiéis e paginação").
- Resposta inválida do provedor nunca chega à UI como faixa com ID vazio.

### Resolução/reprodução

- ID válido é passado ao endpoint interno codificado corretamente.
- Resposta `resolved` válida seleciona Piped e usa a URL retornada.
- HTTP 200 com `audioUrl: null`, payload inválido, HTTP não-2xx, timeout e JSON inválido selecionam fallback sem rejeição não tratada.
- URL de stream inválida é rejeitada.
- Stream direto e fallback não ficam ativos ao mesmo tempo.
- Cache offline tem prioridade e mantém funcionamento.
- Erro `audio` ou erro headless termina estado de buffering/playback e disponibiliza erro/fallback definido.
- `pipedStatus` reflete a instância/qualidade da última resolução efetiva.

### Execução

- Preferir testes com `node:test` se já for a convenção e resolver imports com o setup adequado, ou adotar Vitest se necessário para Vite/React; não deixar os arquivos de teste sem script para execução.
- Adicionar scripts explícitos, por exemplo `test` e possivelmente `test:watch`, após escolher runner.
- Mockar `fetch` para fixtures determinísticas. Nenhum teste unitário deve fazer requisição a Piped/YouTube.
- `npm run test:integrations:live` é a exceção explícita para smoke test com rede real; não deve ser incluído no `npm test` padrão.
- Comandos esperados no final: `npm test` (ou script acordado), `npm run lint`, `npm run build` e `git diff --check`.
- Smoke test externo é separado, opcional por disponibilidade e sem credenciais: busca uma faixa conhecida, valida contrato e tenta resolver seu stream; se o áudio direto falhar, verifica se o vídeo de fallback é incorporável. Relatar instância e engine selecionadas sem imprimir URL assinada completa.

## Critérios de aceite

- Existe um único modelo canônico `Track` utilizado por feed, busca, biblioteca/favoritos, fila e player.
- Nenhuma rota contém mapeamento inline duplicado dos payloads YouTube Music/Piped.
- Dados externos são tratados como `unknown` até serem validados por mapper.
- A origem dos metadados não é confundida com a engine/fonte de reprodução.
- Cada faixa entregue ao player tem um caminho reproduzível explícito ou é rejeitada antes da UI.
- Os contratos das rotas feed/search/stream são tipados e cobertos por testes determinísticos.
- Os testes provam fallback YouTube Music -> Piped e Piped stream -> YouTube headless, inclusive erro/timeout/payload malformado.
- Não há duas engines tocando simultaneamente e falhas de reprodução atualizam estado observável.
- Typecheck, testes e build passam no ambiente com dependências instaladas.
- Mudanças nos IDs não quebram silenciosamente favoritos/offline; decisão e eventual migração são testadas.

## Arquivos atuais relevantes

- `src/types/music.ts`: modelo canônico atual de Track e fontes.
- `src/utils/youtubeId.ts`: normalização atual do ID, já compartilhada por busca/feed/local server.
- `src/utils/audioEngine.ts`: seleção de stream e engine no cliente.
- `src/utils/audioEngine.test.ts`: testes de utilitários e casos iniciais do ID.
- `tests/api/integrations.test.ts`: cobertura de integração com HTTP mockado para busca, feed e resolução.
- `tests/api/integrations.live.test.ts`: smoke externo condicionado por `RUN_LIVE_INTEGRATION_TESTS=1`.
- `src/context/AudioContext.tsx`: prioridade offline, resolução Piped, fallback e estado playback.
- `src/components/HeadlessPlayerFallback.tsx`: player ReactPlayer para fallback YouTube.
- `src/components/ExpandedPlayer.tsx`: artwork do player expandido; não deve hospedar engine paralela.
- `src/App.tsx`: consumidores HTTP do feed e da busca.
- `api/feed.ts`, `api/search.ts`, `api/streams/[id].ts`: endpoints serverless, atualmente com parsing/integração próprios.
- `server.ts`: servidor Express local, também contém clients, parsing e cache Piped.
- `package.json`, `package-lock.json`, `tsconfig.json`: scripts/dependências e configuração; `npm test` roda `tsx --test`. O gerenciador adotado é npm (o `bun.lock` foi removido em 2026-10-25, quando a Vercel passou a usar npm). O conflito entre `esbuild` e o peer do Vite 8 foi resolvido alinhando `esbuild` a `^0.28.0`, então `npm ci` funciona sem `--legacy-peer-deps`.

## Observações para o próximo agente

- Comece verificando `git status` e preserve todas as alterações existentes; este spec não autoriza descartar trabalho do usuário.
- Reabra os arquivos antes de editar, pois o estado pode ter avançado desde a criação deste documento.
- Não considerar o trabalho anterior completo: os testes atuais simulam provedores e não substituem contratos/mappers compartilhados, smoke test real ou validação de playback no navegador.
- Não alegar reprodução garantida com base em testes unitários, no smoke oEmbed ou na resolução da API isoladamente. Serviços públicos podem ficar indisponíveis, mudar payload, bloquear tráfego, limitar taxa ou devolver URLs expiradas.
- Priorizar a cadeia reproduzível e observável de ponta a ponta, mantendo testes sem rede e deixando o smoke test externo como evidência complementar.

## Atualização de sessões abertas (2026-10-25)

- Cada build grava `version.json` (`{ "version": "<sha ou timestamp>" }`) e injeta o mesmo valor como `__APP_VERSION__`. `useAppUpdate` consulta o arquivo (`cache: 'no-store'`) ao voltar ao primeiro plano e a cada 10 minutos; se a versão publicada difere da carregada, `UpdateBanner` mostra "Nova versão disponível" com o botão "Atualizar" (recarrega a página). Nada recarrega sozinho.
- O chunk do player do YouTube é baixado 2 s depois da abertura (`preloadYouTubePlayer`). Sem isso, uma sessão anterior a um deploy pedia um chunk inexistente (a rewrite devolve HTML com status 200) e tocava só a prévia até recarregar.
- Regra de compatibilidade da API com o cliente anterior: ver `AGENTS.md`.
- Critério: com a versão 1 aberta e a 2 publicada, o banner aparece, e "Atualizar" carrega a 2 e o esconde (verificado em Chromium com um segundo build; não verificado em iPhone real). Testes: `tests/appVersion.test.ts`.

## Fila que continua além da página carregada (2026-10-25)

- `playTrack(track, lista, origem?)` aceita uma `QueueSource` (`src/utils/queueSource.ts`): onde começa a próxima página (`nextIndex`) e como carregá-la. A origem é montada em `src/App.tsx` para coleções (carrosséis, "Ver tudo" e destaque) e para a busca online; Biblioteca, Mix das coleções e a busca no catálogo local não têm origem e acabam no fim do que mostram.
- `AudioContext` busca a próxima página quando restam 3 faixas ou menos depois da atual (`needsMoreTracks`), acrescenta só o que ainda não está na fila (`newTracks`) e tenta até 3 páginas seguidas se vierem só repetidas. Ao terminar a última faixa carregada com mais páginas disponíveis, `playNext` espera o carregamento em vez de parar ou voltar ao início; se a busca falhar, cai no comportamento anterior. Com aleatório ou repetir uma faixa não há espera: o aleatório sorteia entre as faixas já carregadas, que seguem sendo ampliadas pela busca antecipada.
- Rádio (mix e ao vivo) mantém o mecanismo próprio de renovação (`refillRadio`).
- Verificado em Chromium: tocar a 13ª de 15 faixas de um carrossel pediu `/api/category?id=top-hits&index=15` e a reprodução seguiu além da 15ª. Testes: `tests/queueSource.test.ts`.

## Remoção do código Piped (2026-10-25)

- Removidos: `api/streams/[id].ts` e a rota equivalente do `server.ts` (com o cache em memória), a rewrite em `vercel.json`, `fetchPipedAudioStream`, `extractAudioStreamFromPipedData` e `PIPED_INSTANCES` (`src/utils/audioEngine.ts`), `src/utils/audioLogger.ts`, o ramo Piped de `downloadTrackForOffline`, a pré-carga do próximo stream em `AudioContext`, o motor `piped` (`AudioEngineType` agora é `native | fallback`), o tipo `PipedAudioStream` e o campo `cachedStreams` do `/api/health` local. `pipedStatus` virou `playbackStatus`.
- Por que era seguro: a faixa do catálogo (Deezer/iTunes) nunca traz `youtubeId`; o vídeo é localizado depois por `/api/resolve` e passado direto ao player oculto. O ramo Piped só rodava para uma faixa que já chegasse com `youtubeId`, o que nada produz hoje; esse caso agora vai direto ao player oculto, sem tentar o Piped antes.
- Efeito: as funções da Vercel passam de 8 para 7; o `/api/health` local deixa de informar `cachedStreams`; 4 testes saíram (os dois do endpoint de stream, o do cliente e o do parser Piped). Todas as seções acima que descrevem Piped são histórico do diagnóstico.
- Resta, fora do Piped: `preferredEngine` e `switchEngineManually` no `AudioContext` não têm nenhuma tela que os use e podem sair numa próxima limpeza.

## Desempenho de listas longas (2026-10-25)

- Medição (Chromium, "Ver tudo" de Top Hits carregada até 100 linhas, 40 eventos `timeupdate` simulados, o equivalente a 10 s de música): a lista renderizava **40 vezes**, uma por evento, porque todo consumidor de `useAudio()` renderizava a cada mudança do relógio. Depois: **0 renderizações**. O áudio de prévia não carrega no ambiente de teste (o CDN do Deezer não responde), então os eventos foram simulados; o gatilho de re-renderização é o mesmo.
- Mudanças: o relógio (`currentTime`, `duration`) saiu do contexto principal para `PlaybackTimeContext` (`usePlaybackTime()`, usado só pelo `ExpandedPlayer`); o valor de `useAudio()` é memoizado; `likedTrackIds` passou a ser memoizado (era um array novo a cada render e mudava `isLiked` e o valor inteiro); `playPrevious` e `seekTo` leem o relógio por refs e os controles da tela de bloqueio por `mediaActionsRef`, de modo que os handlers do Media Session não são registrados de novo a cada tick e seguem atualizados.
- `TrackList` usa `content-visibility: auto` com altura estimada de 72 px nas linhas: o navegador não faz layout nem pintura do que está fora da tela, sem virtualização em JavaScript (Safari 18 ou mais novo; antes disso a propriedade é ignorada e nada quebra).
- Não verificado em iPhone real: o ganho percebido (rolagem, aquecimento, bateria) é o objetivo do T10.

