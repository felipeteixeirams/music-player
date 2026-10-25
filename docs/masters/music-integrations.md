# Master: integrações musicais e reprodução

## Propósito e autoridade

Este é o master do domínio de busca musical, normalização de faixas e reprodução de áudio. Ele resume o estado conhecido e direciona para a especificação granular ativa. O ponto de entrada global continua sendo [a base documental](../README.md); este master não substitui nem duplica esse índice.

A especificação ativa é [Contratos, mappers e testes](../specs/current/music-integration-contracts.spec.md). Ela é a fonte detalhada para requisitos, decisões a implementar, testes e critérios de aceite. Se este resumo divergir dela, confira o código e atualize os documentos; não escolha uma interpretação silenciosamente.

## Estado

**Status: busca, feed e prévia de 30s migrados para Deezer e validados em navegador headless; áudio completo (YouTube) e reserva iTunes ainda não implementados.**

Já existem correções parciais de normalização de IDs Piped/YouTube, remoção do player concorrente no painel expandido, testes determinísticos dos handlers e um smoke test contra os serviços reais. Ainda faltam contratos de integração tipados, mappers runtime, unificação dos clients das rotas e teste de playback no navegador.

Os testes HTTP simulam respostas dos provedores e validam parsing, fallback e contratos dentro do processo. O smoke executado em 2026-10-24 encontrou busca via `pipedapi.ducks.party`, mas não obteve stream Piped direto para a primeira faixa; o fallback passou na verificação oEmbed do YouTube. Isso comprova a busca e que o vídeo é incorporável, não que áudio tocou. Não afirmar que reprodução está garantida sem teste real no navegador.

## Direção aprovada (2026-10-25)

A verificação de 2026-10-25 mostrou as integrações atuais degradadas: o parser InnerTube extrai 0 faixas, a maioria das instâncias Piped está fora do ar e nenhum stream direto Piped funcionou. A direção aprovada para uso pessoal, gratuito e somente áudio é: catálogo e metadados via **Deezer** (reserva **iTunes**), áudio padrão por **preview de 30s**, e áudio completo por **YouTube oculto**, mantido provisoriamente até o usuário decidir a solução definitiva. Piped e InnerTube saem do caminho de produção. Diagnóstico completo, fatos confirmados, limites e critérios de aceite estão no [satélite](../specs/current/music-integration-contracts.spec.md#decisão-troca-de-provedores-aprovada-em-2026-10-25). **Implementado (2026-10-25):** `api/_deezer.ts` (mapper puro + client, usado por `api/search.ts`, `api/feed.ts` e `server.ts`), tipo `AudioSource` com `previewUrl` e `youtubeId` opcionais, e prioridade de playback offline -> prévia -> Piped/YouTube em `AudioContext`. Busca, feed e prévia foram validados (testes determinísticos, smoke live com Metallica, Creed e Bon Jovi, e reprodução em Chromium headless com `currentTime` avançando). **Pendente:** reserva iTunes, resolução de áudio completo via YouTube para faixas Deezer (exige buscar o vídeo por artista + título), exibição de erros de reprodução na UI e remoção do código Piped de stream, hoje sem uso para faixas Deezer. As seções abaixo ainda descrevem a arquitetura anterior onde indicado.

## Domínio coberto

O fluxo abrangido por este master é:

```text
YouTube Music InnerTube / Piped
  -> client e validação do payload externo
  -> mapper para Track canônico
  -> API de busca ou feed
  -> UI, fila e AudioContext
  -> cache offline / stream local / resolução Piped
  -> fallback headless YouTube
```

Serviços atuais:

- Deezer API é a fonte de busca e feed (`/search`, `/chart/{genre}/tracks`); faixas trazem duração real e `previewUrl` de 30s quando existir.
- O áudio padrão é a prévia, tocada por `HTMLAudioElement` (engine `native`). Faixa sem prévia nem outra fonte mostra erro em `pipedStatus.error`, ainda não exibido na UI.
- Instâncias Piped continuam apenas na rota `/api/streams/:id`, hoje inativa para faixas Deezer (sem `youtubeId`) e com bloqueio do YouTube observado.
- YouTube InnerTube/Piped de busca foram removidos das rotas e do `server.ts`.
- O `HeadlessPlayerFallback` só é acionado para faixas com `youtubeId`.

## Código proprietário

- `src/types/music.ts`: formato interno atual de `Track` e `AudioSource`.
- `src/utils/youtubeId.ts`: normalização de IDs para URLs e IDs simples.
- `api/_deezer.ts`: mapper e client Deezer compartilhados; `api/search.ts`, `api/feed.ts` e `server.ts` só tratam HTTP/cache.
- `api/deezer.test.ts`: testes do mapper sem rede.
- `api/streams/[id].ts` e `server.ts`: resolução Piped duplicada e contrato de resposta de stream.
- `src/utils/audioEngine.ts`: chamada client-side à resolução e utilitários de engine.
- `src/context/AudioContext.tsx`: prioridade offline, stream, engine ativa e controles de playback.
- `src/components/HeadlessPlayerFallback.tsx`: playback YouTube de fallback.
- `src/components/ExpandedPlayer.tsx`: UI expandida; não deve iniciar uma engine paralela.
- `src/App.tsx`: consumo de `/api/feed` e `/api/search`.
- `src/utils/audioEngine.test.ts`: testes existentes de utilitários e IDs.
- `api/integrations.test.ts`: testes de integração dos handlers Vercel e do cliente de streams, com respostas HTTP simuladas.
- `api/integrations.live.test.ts`: smoke test opt-in que busca três artistas no Deezer e confirma `audio/*` no preview (leitura de 1 byte).
- `package.json`: `npm test` executa a suíte via `tsx --test`.

A especificação ativa contém o mapa mais completo dos arquivos e os detalhes conhecidos; consulte-a antes de mudar qualquer contrato.

## Decisões de arquitetura a manter

1. `Track` é o formato canônico entre providers, UI, fila, favoritos e player.
2. Payload de terceiro começa como `unknown`, passa por validação e mapper, e não atravessa a fronteira de integração como `any`/DTO externo.
3. Origem dos metadados (YouTube Music/Piped) deve ser distinta da fonte/engine de reprodução (offline, URL local, stream Piped, fallback YouTube).
4. Mappers são puros, testáveis sem rede e únicos para cada formato de integração.
5. Rotas Express e Vercel reutilizam a mesma lógica de clients/mappers sempre que compatível com o bundling; rotas permanecem responsáveis por HTTP/cache e adaptação de entrada/saída.
6. A ordem de playback deve ser explícita: cache offline, fonte local válida, resolver Piped e fallback YouTube; erros precisam refletir estado observável, não só log.
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
