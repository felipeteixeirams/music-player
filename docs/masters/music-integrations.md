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

- A aba Rádio tem duas seções: "Ao vivo", com 25 rádios de verdade (`src/data/liveRadios.ts`, tocadas direto por `<audio>`, sem função da Vercel nem YouTube), e "Mix por gênero". O player de rádio esconde linha do tempo, aleatório, repetir e anterior.
- A aba Rádio lista estações curadas do Deezer por gênero (`/radio/genres` para as capas, `/radio/{id}/tracks` para os lotes de 40 faixas embaralhadas); a fila se renova sozinha e a faixa que não toca é pulada.
- Deezer API é a fonte de busca (`/search`) e das coleções da home (`/playlist/{id}/tracks`, uma playlist editorial por coleção em `api/_categories.ts`); tudo é paginado por `index`/`limit` e as faixas trazem duração real e `previewUrl` de 30s quando existir.
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
- `api/_audioProxy.ts`, `api/audio.ts`, `tests/api/audioProxy.test.ts`: cópia same-origin de prévias para o download offline; só HTTPS e hosts `*.dzcdn.net`, `*.mzstatic.com`, `*.itunes.apple.com`, até 4 MB, sem redirecionamentos.
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

Com dependências instaladas, execute `npm test` para os testes determinísticos. Execute `npm run test:integrations:live` separadamente quando houver acesso à rede; esse comando consulta serviços públicos e pode falhar por indisponibilidade externa.

## Atualização deste master

Atualize este master quando mudar a arquitetura transversal do domínio, a propriedade de algum componente, a política de fallback ou o estado geral de conclusão. Requisitos granulares e cenários de teste pertencem ao satélite. Ao criar um novo satélite, linke-o neste master e também atualize a tabela de [documentos ativos no root](../README.md).
