# Master: integrações musicais e reprodução

## Propósito e autoridade

Este é o master do domínio de busca musical, normalização de faixas e reprodução de áudio. Ele resume o estado conhecido e direciona para as especificações granulares ativas. O ponto de entrada global continua sendo [a base documental](../README.md); este master não substitui nem duplica esse índice.

As especificações ativas são [Contratos, mappers e testes](../specs/current/music-integration-contracts.spec.md) e o [Roteiro de validação em produção](../specs/current/validation-checklist.spec.md), que lista o que precisa ser testado no aparelho do usuário e registra os resultados. O primeiro é a fonte detalhada para requisitos, decisões a implementar, testes automáticos e critérios de aceite. Se este resumo divergir deles, confira o código e atualize os documentos; não escolha uma interpretação silenciosamente.

## Estado

**Status: busca, coleções da home (playlists editoriais fiéis, paginadas), rádio ao vivo e mix por gênero com fila contínua, prévia de 30s e faixa completa (YouTube oculto); reserva iTunes na busca, download offline de prévias, favoritos com metadados e avisos de reprodução implementados e validados.**

Já existem correções parciais de normalização de IDs do YouTube, remoção do player concorrente no painel expandido, testes determinísticos dos handlers e um smoke test contra os serviços reais. Ainda faltam contratos de integração tipados, mappers runtime, unificação dos clients das rotas e teste de playback no navegador.

Os testes HTTP simulam respostas dos provedores e validam parsing, fallback e contratos dentro do processo. O smoke executado em 2026-10-24 encontrou busca via `pipedapi.ducks.party`, mas não obteve stream Piped direto para a primeira faixa; o fallback passou na verificação oEmbed do YouTube. Isso comprova a busca e que o vídeo é incorporável, não que áudio tocou. Não afirmar que reprodução está garantida sem teste real no navegador.

## Direção aprovada (2026-10-25)

A verificação de 2026-10-25 mostrou as integrações atuais degradadas: o parser InnerTube extrai 0 faixas, a maioria das instâncias Piped está fora do ar e nenhum stream direto Piped funcionou. A direção aprovada para uso pessoal, gratuito e somente áudio é: catálogo e metadados via **Deezer** (reserva **iTunes**), áudio padrão por **preview de 30s**, e áudio completo por **YouTube oculto**, mantido provisoriamente até o usuário decidir a solução definitiva. Piped e InnerTube saem do caminho de produção. Diagnóstico completo, fatos confirmados, limites e critérios de aceite estão no [satélite](../specs/current/music-integration-contracts.spec.md#decisão-troca-de-provedores-aprovada-em-2026-10-25). **Implementado (2026-10-25):** `api/_deezer.ts` (mapper puro + client, usado por `api/search.ts`, `api/feed.ts` e `server.ts`), tipo `AudioSource` com `previewUrl` e `youtubeId` opcionais, e prioridade de playback offline -> prévia -> Piped/YouTube em `AudioContext`. Busca, feed e prévia foram validados (testes determinísticos, smoke live com Metallica, Creed e Bon Jovi, e reprodução em Chromium headless com `currentTime` avançando). **Áudio completo (2026-10-25):** `api/_youtubeSearch.ts` e `GET /api/resolve` localizam até 3 vídeos por artista + título + duração, e `AudioContext` toca o primeiro no `HeadlessPlayerFallback`; se o embed falhar, tenta o próximo vídeo e depois a prévia. O `HeadlessPlayerFallback` foi reescrito para a API do react-player v3, pois a versão anterior usava a API v2 (`url`, `seekTo`) e nunca tocou. **Confirmado em produção (2026-10-25):** o usuário ouviu a faixa completa no celular. **Estabilização (2026-10-25):** `searchCatalog` (Deezer, depois iTunes) atende a busca; `GET /api/audio` copia prévias de CDNs permitidos para o download offline; favoritos guardam a faixa inteira; `PlaybackNotice` mostra erro ou aviso de prévia; se a API oficial do YouTube recusar (cota, chave), a resolução usa a busca web. **Pendente:** reserva iTunes para o feed, remoção do código Piped de stream e uma solução definitiva para áudio completo (decisão do usuário). As seções abaixo ainda descrevem a arquitetura anterior onde indicado.

## Domínio coberto

O fluxo abrangido por este master é:

```text
Deezer (reserva iTunes)
  -> client e validação do payload externo
  -> mapper para Track canônico
  -> API de busca, coleções ou rádio
  -> UI, fila e AudioContext
  -> cache offline / prévia de 30s / URL local (rádio ao vivo)
  -> faixa completa no player oculto do YouTube
```

Serviços atuais:

- A aba Rádio tem três seções. "Ao vivo": 25 rádios de verdade numa lista curada (`src/data/liveRadios.ts`), tocadas direto por `<audio>`, sem função da Vercel nem YouTube. "Mais rádios ao vivo": emissoras por estilo do diretório radio-browser.info (`api/_radioBrowser.ts`; `GET /api/radio?live=<estilo>` com cache de 1 h; passa pelos espelhos do diretório com `User-Agent` próprio e avisa cada reprodução por `?click=<uuid>`, como o serviço pede em api.radio-browser.info). "Mix por gênero": faixas do Deezer com vídeo do YouTube. As duas primeiras tocam por áudio nativo e seguem com a tela bloqueada no app instalado (matriz, 2026-10-27). O player de rádio esconde linha do tempo, aleatório, repetir e anterior.
- A aba Rádio lista estações curadas do Deezer por gênero (`/radio/genres` para as capas, `/radio/{id}/tracks` para os lotes de 40 faixas embaralhadas); a fila se renova sozinha e a faixa que não toca é pulada.
- Deezer API é a fonte de busca (`/search`) e das coleções da home (`/playlist/{id}/tracks`, uma playlist editorial por coleção em `api/_categories.ts`); artistas vêm de `/search/artist`, `/artist/{id}` e `/artist/{id}/top`, `/artist/{id}/albums`, `/artist/{id}/related` e `/album/{id}` (`GET /api/search?artists=`, `?artist=` e `?album=`, cache de 30 min; contrato em acrescentar campos, como as demais rotas); tudo é paginado por `index`/`limit` e as faixas trazem duração real e `previewUrl` de 30s quando existir.
- O áudio padrão é a faixa completa via YouTube oculto (engine `fallback`), com o vídeo localizado por `/api/resolve`. Sem vídeo ou com embed bloqueado, toca a prévia de 30s por `HTMLAudioElement` (engine `native`) e `playbackStatus.notice` avisa o usuário. Faixa sem nenhuma fonte define `playbackStatus.error`. `PlaybackNotice` exibe ambos no mini player e no player expandido. A escolha do vídeo favorece a fonte mais limpa da gravação de estúdio (canal Topic, depois áudio oficial, por último clipe), e o player completo oferece "Outra versão" quando há mais de um candidato, lembrando a escolha por faixa (ver o satélite, seção "Escolha do vídeo para um app só de áudio").
- O código Piped foi removido em 2026-10-25: a rota `/api/streams/:id` (e sua cópia em `server.ts`), as funções `fetchPipedAudioStream` e `extractAudioStreamFromPipedData`, o logger de extração, a pré-carga do próximo stream e o motor `piped`. Nenhuma faixa do catálogo (Deezer/iTunes) passava por esse caminho, e as instâncias públicas estavam bloqueadas pelo YouTube. O InnerTube de busca já havia saído antes. Os trechos históricos abaixo e no satélite descrevem o diagnóstico que levou a isso.
- O `HeadlessPlayerFallback` só é acionado para faixas com `youtubeId`.

## Limitações conhecidas

- **Áudio com a tela bloqueada (iPhone):** a faixa completa (YouTube oculto) continua tocando no navegador (testado em 2026-10-25 no Microsoft Edge, iPhone 11), mas para no app instalado na tela inicial (PWA) e o play da tela de bloqueio não religa. O app recomenda o navegador no modal de instalação do iPhone. Detalhes e o que ficou sem teste no [roteiro de validação](../specs/current/validation-checklist.spec.md) (T04).
- **Widget na tela inicial do iPhone:** não existe para PWA; exigiria um app nativo (WidgetKit), fora do escopo atual.

## Código proprietário

- `src/types/music.ts`: formato interno atual de `Track` e `AudioSource`.
- `src/utils/youtubeId.ts`: normalização de IDs para URLs e IDs simples.
- `src/data/liveRadios.ts`, `src/utils/liveRadio.ts`: rádios ao vivo (lista fixa com a transmissão de cada estação) e a conversão em `Track` marcada com `sources.isLive`.
- `api/_radios.ts`, `api/radio.ts`, `src/components/RadioView.tsx` e `src/utils/radioQueue.ts`: estações de rádio curadas, a rota única de estações e lotes de faixas, a tela e a escolha do que entra na fila contínua (a fila e o modo rádio ficam em `AudioContext`).
- `api/_deezer.ts`: mapper e client Deezer compartilhados; `api/_categories.ts`: playlist de cada coleção; `api/_endpoints.ts`: lógica de feed, categoria e busca usada pelas funções da Vercel (`api/feed.ts`, `api/category.ts`, `api/search.ts`) e por `server.ts`, que só tratam HTTP/cache.
- `tests/api/deezer.test.ts`: testes do mapper sem rede.
- `api/_itunes.ts`, `api/_catalog.ts`: mapper/client iTunes e `searchCatalog` (Deezer primeiro, iTunes se falhar ou vier vazio), com `tests/api/itunes.test.ts`.
- `api/_audioProxy.ts`, `api/audio.ts`, `tests/api/audioProxy.test.ts`: cópia same-origin de prévias, **sem uso desde 2026-10-28** (o download offline foi retirado; remover a rota quando o usuário decidir); só HTTPS e hosts `*.dzcdn.net`, `*.mzstatic.com`, `*.itunes.apple.com`, até 4 MB, sem redirecionamentos.
- `src/utils/feedCache.ts`: cópia da última home no aparelho, mostrada quando não dá para atualizar.
- `src/utils/playlists.ts`, `src/context/PlaylistsContext.tsx`, `src/components/AddToPlaylistSheet.tsx` e `src/components/Dialogs.tsx`: playlists criadas pelo usuário (guardadas no aparelho; ver o satélite).
- `src/utils/likedTracks.ts`: biblioteca de favoritos com metadados (`aurastream_liked_track_objects`), migração dos ids antigos e testes.
- `api/_youtubeSearch.ts`, `api/resolve.ts` e `tests/api/youtubeSearch.test.ts`: busca do vídeo da faixa (API oficial com `YOUTUBE_API_KEY`, ou busca web não oficial sem chave), ranqueamento por duração/título/canal e testes sem rede.
- `server.ts`: servidor Express local e do AI Studio, com as mesmas rotas das funções da Vercel.
- `src/utils/audioEngine.ts`: chamada client-side à resolução e utilitários de engine.
- `src/context/AudioContext.tsx`: prioridade offline, stream, engine ativa e controles de playback.
- `src/components/HeadlessPlayerFallback.tsx`: playback YouTube de fallback.
- `src/components/ExpandedPlayer.tsx`: UI expandida; não deve iniciar uma engine paralela.
- `src/App.tsx`: consumo de `/api/feed`, `/api/category` e `/api/search` com `src/hooks/usePagedTracks.ts`, `src/utils/catalogClient.ts`, `src/utils/pagedList.ts` e `src/components/LoadMoreSentinel.tsx` (lista paginada com rolagem infinita).
- `src/utils/audioEngine.test.ts`: testes existentes de utilitários e IDs.
- `tests/api/integrations.test.ts`: testes de integração dos handlers Vercel e do cliente de streams, com respostas HTTP simuladas.
- `tests/api/integrations.live.test.ts`: smoke test opt-in que busca três artistas no Deezer e confirma `audio/*` no preview (leitura de 1 byte).
- `package.json`: `npm test` executa a suíte via `tsx --test`.

A especificação ativa contém o mapa mais completo dos arquivos e os detalhes conhecidos; consulte-a antes de mudar qualquer contrato.

## Decisões de arquitetura a manter

1. `Track` é o formato canônico entre providers, UI, fila, favoritos e player.
2. Payload de terceiro começa como `unknown`, passa por validação e mapper, e não atravessa a fronteira de integração como `any`/DTO externo.
3. Origem dos metadados (Deezer/iTunes) deve ser distinta da fonte/engine de reprodução (offline, prévia, URL local, player oculto do YouTube).
4. Mappers são puros, testáveis sem rede e únicos para cada formato de integração.
5. Rotas Express e Vercel reutilizam a mesma lógica de clients/mappers sempre que compatível com o bundling; rotas permanecem responsáveis por HTTP/cache e adaptação de entrada/saída.
6. A ordem de playback deve ser explícita: cache offline, vídeo do YouTube localizado por `/api/resolve`, prévia de 30s, URL local; erros precisam refletir estado observável, não só log.
7. Uma única engine pode tocar por vez. O painel expandido não monta um player YouTube separado.
8. IDs de faixa afetam favoritos e cache offline persistidos; qualquer alteração de identidade exige avaliar migração/compatibilidade.
9. Testes unitários nunca dependem de serviços externos. Rede real é smoke test complementar.

## Navegação para a especificação

Leia [Contratos, mappers e testes](../specs/current/music-integration-contracts.spec.md) para:

- contratos TypeScript desejados;
- detalhes dos payloads atuais e lacunas de validação;
- implementação sugerida de mappers/client;
- tratamento e fallback de resolução de stream;
- sequência recomendada de mudanças;
- matriz de testes e critérios de aceite;
- limitações da validação já executada.

Leia [Fontes de áudio, descobertas e decisões](../specs/current/audio-sources-decisions.spec.md) para saber de onde vem o áudio, por que o iOS o pausa em segundo plano, o que foi medido no aparelho, as opções avaliadas (extração de stream, Spotify, Apple Music, Capacitor, arquivos próprios, rádios) com a decisão de cada uma, e as frentes em aberto.

Leia a [matriz de compatibilidade](../specs/current/compatibility-matrix.spec.md) para saber o que funciona em cada ambiente (navegador do iPhone, app instalado, teste automático) e com que evidência, e o [roteiro de validação](../specs/current/validation-checklist.spec.md) para repetir os testes no aparelho.

Com dependências instaladas, execute `npm test` para os testes determinísticos. Execute `npm run test:integrations:live` separadamente quando houver acesso à rede; esse comando consulta serviços públicos e pode falhar por indisponibilidade externa.

## Invariantes da reprodução (não quebre)

Cada invariante tem um id e pelo menos um teste que o cita pelo id (`tests/docs.test.ts` reprova se algum ficar sem teste, ou se um teste citar um id que não existe aqui). O que vale em cada ambiente está na [matriz de compatibilidade](../specs/current/compatibility-matrix.spec.md).

- **INV-LIVE-01:** de uma busca no diretório de rádios só entram emissoras verificadas como no ar, em HTTPS, num formato que o celular toca (MP3, AAC) e sem nome repetido; no máximo 12 por estilo.
- **INV-LIVE-02:** se um servidor do diretório falha, o próximo é tentado; se todos falham, a rota responde 502 (sem cache) e a tela mantém a lista curada de rádios ao vivo.
- **INV-LIVE-03:** a rota só aceita os estilos da lista (`LIVE_STYLES`) e uuids de emissora válidos: não dá para usá-la para buscar outra coisa no diretório.
- **INV-LIVE-04:** a rádio ao vivo por estilo toca por `<audio>` nativo (sem YouTube, sem cota) e avisa o diretório de cada reprodução.
- **INV-PREV-01:** o link de prévia do Deezer é assinado e vence em cerca de 15 minutos (`hdnea=exp=…`); o app lê o vencimento do próprio link e nunca dá por vencido um link sem assinatura (iTunes, rádios).
- **INV-PREV-02:** `GET /api/search?preview=deezer-<id>` devolve um link novo de prévia, sem cache, e só aceita ids do Deezer.
- **INV-PREV-03:** antes de tocar uma prévia com o link vencido (ou quando o navegador recusa o link com `NotSupportedError`), o app pede um link novo e toca, sem aviso nem segundo toque.
- **INV-PLAY-01:** a tela nunca mostra "tocando" quando não sai som: sem som em 6 s (a contagem recomeça uma vez, por mais 6 s, quando o player do YouTube termina de carregar; 15 s numa rádio ao vivo, cuja transmissão pode demorar a começar) o botão volta a ▶ com o aviso, e se o som começar depois a tela volta a "tocando".
- **INV-PLAY-12:** uma rádio ao vivo tem 15 s para começar antes de o aviso aparecer: uma transmissão que demora 7 s a começar toca sem aviso.
- **INV-PLAY-02:** uma faixa com vídeo já conhecido (no aparelho ou no cache compartilhado) começa sem pedir nada à rede no toque.
- **INV-PLAY-03:** só a resolução, no toque, de uma faixa que ninguém tocou antes gasta busca do YouTube e cota; a consulta em lote ao cache nunca busca nem consome.
- **INV-PLAY-04:** o toque numa faixa desbloqueia o elemento de áudio do navegador, e os eventos do clipe de silêncio nunca contam como música.
- **INV-PLAY-05:** sair do app e voltar com a prévia tocando não pausa a faixa nem mostra aviso.
- **INV-PLAY-06:** a mesma música com outro id aproveita o vídeo já achado; o vídeo denunciado sai das duas chaves do cache.
- **INV-PLAY-07:** uma faixa nova não toca a prévia como ponte: o botão de reproduzir mostra carregamento (um anel, sem texto) enquanto o vídeo é procurado e o player do YouTube começa, e a faixa completa começa por ele. A prévia só toca quando não há faixa completa (sem vídeo, cota do dia acabada) ou ela falhou.
- **INV-PLAY-08:** o player do YouTube (`youtubeEngine`) é criado dentro do toque, antes de o vídeo ser conhecido, e as faixas seguintes entram no mesmo iframe (nenhum iframe novo por faixa).
- **INV-PLAY-09:** quando o navegador não deixa a faixa completa começar, o app tenta de novo sozinho (e a cada toque na tela) e a prévia segue; nenhuma ação manual é exigida do usuário.
- **INV-PLAY-10:** o player do YouTube é criado em repouso (cerca de 2 s depois de abrir o app), para estar pronto no toque, e não toca nada até o vídeo real ser conhecido. Não há vídeo-reserva: a tentativa de liberar o player tocando um vídeo mudo no toque (PR #58) coincidiu com a prévia deixar de começar em faixas novas no aparelho (2026-10-28) e foi retirada.
- **INV-PLAY-11:** uma prévia que o navegador recusa (ela só toca quando não há faixa completa) vai para o relatório ("a prévia foi recusada pelo navegador"), e a tela não finge que ela toca.

## Atualização deste master

Atualize este master quando mudar a arquitetura transversal do domínio, a propriedade de algum componente, a política de fallback ou o estado geral de conclusão. Requisitos granulares e cenários de teste pertencem ao satélite. Ao criar um novo satélite, linke-o neste master e também atualize a tabela de [documentos ativos no root](../README.md).

## Início da reprodução no iPhone: toque, segundo plano e diagnóstico

- **O iPhone só deixa um áudio começar por causa de um toque, e só por cerca de 1 segundo depois dele.** A faixa completa depende de uma resposta da rede (`/api/resolve`) antes de tocar, então o início automático pode ser recusado e nada se ouve até o próximo toque. Três medidas, em `AudioContext`:
  1. **Desbloqueio:** no toque numa faixa, o elemento de áudio do app toca 0,1 s de silêncio (`src/utils/audioUnlock.ts`). Um elemento que já tocou por causa de um toque pode começar a próxima faixa (prévia, download) sem outro toque. Os eventos desse clipe são ignorados.
  2. **Vigia de início:** depois de mandar tocar, se não sair som, a tela deixa de fingir que toca: em 6 s, ou em 1,5 s depois de o player do YouTube avisar que carregou o vídeo, o botão volta a ▶ com o aviso "Toque em ▶ para ouvir", e esse toque (que o iPhone aceita) inicia a faixa. Se o som começar depois, a tela volta a tocando sozinha.
  3. **Menos espera antes do toque ser usado:** `apiFetch` usa o token que já está em memória (`getSessionFast`) em vez de esperar a biblioteca de login, e as funções da Vercel rodam em São Paulo (`regions: ["gru1"]` em `vercel.json`), ao lado do banco (antes ficavam em Washington: cada chamada ao Supabase custava mais de 100 ms, e o `/api/resolve` faz várias).
  4. **Vídeo já conhecido antes do toque:** a tela pergunta ao cache compartilhado, em lote e sem gastar busca nem cota, quais faixas visíveis (e as 3 próximas da fila) já têm vídeo, e o aparelho guarda o que descobre. Tocar uma faixa que alguém já tocou, ou que você já tocou, começa no mesmo toque, sem esperar a rede. O que ninguém tocou ainda continua pedindo uma busca no toque (a primeira pessoa a tocá-la gasta uma unidade da cota; a mesma música com outro id reaproveita o vídeo). Contrato em [Contratos](../specs/current/music-integration-contracts.spec.md).
- **Segundo plano e tela de bloqueio:** no **navegador** do iPhone a faixa completa (player oculto do YouTube) continua tocando com a tela bloqueada e com o app minimizado (T04, 2026-10-25, Microsoft Edge, iPhone 11). No **app instalado na tela inicial (PWA)** ela pausa, e o play da tela de bloqueio não religa: é uma restrição do iOS a mídia de apps instalados, já documentada, e a decisão foi usar o navegador. Um áudio nativo (prévia de 30 s, downloads) é o que o iOS mais respeita em segundo plano. Se a faixa parar enquanto o app esteve fora, ao voltar a tela mostra ▶ com um aviso, em vez de parecer que toca. **Antes de chamar de regressão, confira em qual dos dois o problema aparece:** a tela cheia sem barra de endereço indica o PWA; o mesmo teste no navegador mostra se algo mudou de fato.
- **Diagnóstico:** Ajustes > "Diagnóstico de reprodução" lista, com a hora, o que aconteceu nas últimas reproduções (toque, vídeo resolvido em quantos ms, player carregado, começou a tocar, sem som, app em segundo plano e se a faixa avançou enquanto estava fora) e tem "Copiar". Serve para relatar uma faixa que não toca sem precisar do inspetor do Safari. `scripts/check-deploy.mjs` avisa se as funções não estiverem em `gru1`.
