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
- `api/integrations.test.ts` invoca os handlers Vercel de busca, feed e stream com `fetch` simulado; também verifica o consumo da resposta de stream por `fetchPipedAudioStream`.
- `api/integrations.live.test.ts` contém um smoke test opt-in que consulta busca/stream reais e verifica um byte de áudio direto ou a resposta oEmbed do fallback.
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

1. **Preparar validação**: identificar a ferramenta de teste adotada pelo projeto; instalar dependências conforme lockfile (`bun.lock`) ou configurar um script Node compatível. Não misturar alterações de gerenciador de pacotes sem justificativa.
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
- Feed mantém as chaves `trending`, `rock`, `pop`, `lofi`, `featured` e cada item passa pelo mesmo contrato de Track.
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
- `api/integrations.test.ts`: cobertura de integração com HTTP mockado para busca, feed e resolução.
- `api/integrations.live.test.ts`: smoke externo condicionado por `RUN_LIVE_INTEGRATION_TESTS=1`.
- `src/context/AudioContext.tsx`: prioridade offline, resolução Piped, fallback e estado playback.
- `src/components/HeadlessPlayerFallback.tsx`: player ReactPlayer para fallback YouTube.
- `src/components/ExpandedPlayer.tsx`: artwork do player expandido; não deve hospedar engine paralela.
- `src/App.tsx`: consumidores HTTP do feed e da busca.
- `api/feed.ts`, `api/search.ts`, `api/streams/[id].ts`: endpoints serverless, atualmente com parsing/integração próprios.
- `server.ts`: servidor Express local, também contém clients, parsing e cache Piped.
- `package.json`, `bun.lock`, `tsconfig.json`: scripts/dependências e configuração; `npm test` roda `tsx --test`. No ambiente usado para a validação, as dependências precisaram ser instaladas sem lockfile npm e com `--legacy-peer-deps` por conflito entre esbuild e o peer opcional do Vite.

## Observações para o próximo agente

- Comece verificando `git status` e preserve todas as alterações existentes; este spec não autoriza descartar trabalho do usuário.
- Reabra os arquivos antes de editar, pois o estado pode ter avançado desde a criação deste documento.
- Não considerar o trabalho anterior completo: os testes atuais simulam provedores e não substituem contratos/mappers compartilhados, smoke test real ou validação de playback no navegador.
- Não alegar reprodução garantida com base em testes unitários, no smoke oEmbed ou na resolução da API isoladamente. Serviços públicos podem ficar indisponíveis, mudar payload, bloquear tráfego, limitar taxa ou devolver URLs expiradas.
- Priorizar a cadeia reproduzível e observável de ponta a ponta, mantendo testes sem rede e deixando o smoke test externo como evidência complementar.
