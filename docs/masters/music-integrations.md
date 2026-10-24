# Master: integrações musicais e reprodução

## Propósito e autoridade

Este é o master do domínio de busca musical, normalização de faixas e reprodução de áudio. Ele resume o estado conhecido e direciona para a especificação granular ativa. O ponto de entrada global continua sendo [a base documental](../README.md); este master não substitui nem duplica esse índice.

A especificação ativa é [Contratos, mappers e testes](../specs/current/music-integration-contracts.spec.md). Ela é a fonte detalhada para requisitos, decisões a implementar, testes e critérios de aceite. Se este resumo divergir dela, confira o código e atualize os documentos; não escolha uma interpretação silenciosamente.

## Estado

**Status: especificação em andamento; implementação incompleta.**

Já existem correções parciais de normalização de IDs Piped/YouTube e remoção do player concorrente no painel expandido. Ainda faltam contratos de integração tipados, mappers runtime, unificação dos clients das rotas e testes cobrindo a cadeia completa até o resolvedor/player.

Não afirmar que reprodução está garantida apenas porque um payload foi mapeado ou um teste unitário passou. É necessário validar o fluxo no código e, como evidência complementar, fazer smoke test externo quando os serviços estiverem disponíveis.

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

Serviços atuais observados:

- YouTube Music InnerTube é tentado primeiro para feed e busca.
- Instâncias públicas Piped são fallback de busca e também tentativas de resolução do stream de áudio.
- Busca e feed retornam faixas baseadas em YouTube video ID; o áudio direto pode ser obtido separadamente pela rota `/api/streams/:id`.
- Em falha de stream direto, o cliente ativa `HeadlessPlayerFallback`.

## Código proprietário

- `src/types/music.ts`: formato interno atual de `Track` e `AudioSource`.
- `src/utils/youtubeId.ts`: normalização de IDs para URLs e IDs simples.
- `api/search.ts`, `api/feed.ts` e `server.ts`: busca, parsing e fallback duplicados entre serverless e servidor local.
- `api/streams/[id].ts` e `server.ts`: resolução Piped duplicada e contrato de resposta de stream.
- `src/utils/audioEngine.ts`: chamada client-side à resolução e utilitários de engine.
- `src/context/AudioContext.tsx`: prioridade offline, stream, engine ativa e controles de playback.
- `src/components/HeadlessPlayerFallback.tsx`: playback YouTube de fallback.
- `src/components/ExpandedPlayer.tsx`: UI expandida; não deve iniciar uma engine paralela.
- `src/App.tsx`: consumo de `/api/feed` e `/api/search`.
- `src/utils/audioEngine.test.ts`: testes existentes de utilitários e IDs.

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

## Atualização deste master

Atualize este master quando mudar a arquitetura transversal do domínio, a propriedade de algum componente, a política de fallback ou o estado geral de conclusão. Requisitos granulares e cenários de teste pertencem ao satélite. Ao criar um novo satélite, linke-o neste master e também atualize a tabela de [documentos ativos no root](../README.md).
