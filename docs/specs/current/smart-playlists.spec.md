# Especificação: playlists inteligentes por encomenda em linguagem natural

Status: **implementada (2026-11-07)**. Pertence ao master [Integrações musicais e reprodução](../../masters/music-integrations.md). Rótulos de evidência: 🔎 lido no código deste repositório; 📖 fonte externa; 💭 hipótese ou estimativa, não medida.

## Objetivo

Permitir que uma pessoa registrada no app encomende uma playlist fornecendo uma descrição em **linguagem natural** (ex.: *"Rock clássico dos anos 70 para viagem"*, *"Música instrumental brasileira suave para concentração"*), escolhendo a **quantidade exata de faixas** (10 a 25 faixas, com teto máximo de 30 no backend). O sistema compreende a intenção, busca faixas musicais individuais nas integrações existentes (Deezer e reserva iTunes), exclui rigorosamente podcasts e listas prontas de terceiros, valida a conformidade da seleção e entrega uma playlist pronta para pré-escuta e salvamento na biblioteca da conta.

## Decisões do usuário (2026-11-07)

| # | Decisão |
| --- | --- |
| 1 | A encomenda é feita em **linguagem natural** livre digitada pelo usuário. |
| 2 | O usuário define o **tamanho da playlist** (opções 10, 15, 20 ou 25 faixas), com teto máximo rígido de 30 faixas no backend. |
| 3 | A montagem precisa ser **validada** para atestar que o pedido foi atendido antes de ser entregue ao usuário. |
| 4 | As faixas devem ser **músicas individuais reais e existentes** nas integrações do app (Deezer e iTunes), com metadados e prévias funcionais. |
| 5 | **Exclusão estrita de podcasts**: nenhum episódio, programa ou feed RSS pode entrar na playlist inteligente. |
| 6 | **Exclusão estrita de listas prontas**: nenhuma playlist pré-fabricada de terceiros (editoriais do Deezer ou paradas públicas) é entregue; a montagem é sempre original, faixa a faixa. |

## Revisão de 2026-11-08 (tela mais simples e destaque)

Decisões do usuário, aplicadas nesta versão:

| # | Decisão |
| --- | --- |
| 1 | Padrão de **10 faixas**; a folha não oferece outra quantidade. A busca roda em paralelo para ficar mais rápida sem trocar a escolha das faixas (INV-SMART-07). |
| 2 | Depois de gerar: lista com prévia de 30 s por faixa e remoção de faixas. |
| 3 | **"Adicionar 5 músicas"**, com o mesmo pedido, só antes de salvar. Nunca repete as faixas da lista nem as removidas (INV-SMART-06). |
| 4 | Nome editável antes de salvar, **único entre as playlists criadas pela própria pessoa**, comparando como foi digitado (INV-SMART-08). |
| 5 | Limite de 2 faixas por artista só em pedidos gerais; pedido sobre um artista não tem limite (INV-SMART-03). |
| 6 | Cartão "Criar playlist com IA" em "Escolhidos para você" e botão "Criar com IA" na Biblioteca, com a mesma folha (INV-SMART-09). |

Visual: os cartões de entrada (Início e Biblioteca) têm um fundo em aurora que se move devagar, com um brilho suave no ícone de faísca; com "reduzir movimento" ativado no aparelho, ficam parados (CSS em `src/index.css`).

Mudanças de tela: a entrada tem o campo de texto, três exemplos e um botão; o carregamento é uma linha só; o resultado tem um botão principal ("Salvar na Biblioteca") e o de adicionar 5. As três regras da versão anterior saíram da tela. Ao salvar, a playlist abre na Biblioteca.

## O que existe hoje (e o que isso impõe)

- 🔎 O app possui integração com o catálogo do **Deezer** e reserva do **iTunes** (`api/_catalog.ts`, `api/_deezer.ts`, `api/_itunes.ts`), ambos capazes de buscar faixas individuais com metadados canônicos `Track`.
- 🔎 As chamadas à API são protegidas por `guard` (`api/_guard.ts`), com política `POLICIES.catalog` exigindo origem do mesmo site e token de autenticação Supabase Auth (`apiFetch`).
- 🔎 Playlists pertencem à conta da pessoa (`PlaylistsContext.tsx`, `src/utils/playlists.ts`, `UserDataSnapshot` em `src/utils/userData.ts`): ao salvar, a playlist é inserida com `createNew` e preenchida com as faixas, sincronizando com a nuvem pelo `SyncAgent`.
- 🔎 O backend dispõe de servidor Express (`server.ts`) e funções serverless da Vercel (`api/`). O limite do plano Hobby é de 12 funções (`tests/vercel-functions.test.ts`), hoje contendo 10 com `api/smart-playlist.ts`.
- 🔎 O processamento de linguagem natural ocorre no servidor via SDK `@google/genai` usando o modelo `gemini-3.8-flash` e schema JSON estruturado (`responseSchema`), protegendo a chave `GEMINI_API_KEY`.

## Invariantes da funcionalidade (não quebre)

- **INV-SMART-01:** toda faixa de uma playlist inteligente é uma música individual existente e verificada no catálogo (Deezer ou iTunes) com previewUrl e metadados reais.
- **INV-SMART-02:** conteúdos do tipo podcast, episódios falados ou playlists pré-fabricadas de terceiros são estritamente excluídos da curadoria e dos resultados.
- **INV-SMART-03:** a lista gerada respeita o teto solicitado ($\le 30$, padrão de 10). Para pedidos gerais, garante diversidade com no máximo 2 faixas do mesmo artista; um pedido sobre um artista específico (o modelo devolve `artistFocus`) não tem esse limite, para que "as melhores músicas de um artista" sejam possíveis. Origem do limite: evitar que um pedido genérico vire uma lista de um artista só (decisão do usuário, 2026-11-08, opção 2).
- **INV-SMART-04:** a montagem passa obrigatoriamente pelo motor de validação de conformidade com o pedido antes de ser entregue ao usuário.
- **INV-SMART-05:** a playlist inteligente salva pelo usuário utiliza o pipeline padrão de `UserDataSnapshot`, persistindo em `PlaylistsContext` e sincronizando com o Supabase.
- **INV-SMART-06:** "Adicionar 5 músicas" nunca repete as faixas já na lista nem as removidas nesta tela: a exclusão vale por id e por título e artista (`resolveAndValidateCandidates`, campo `exclude`).
- **INV-SMART-07:** as buscas do catálogo para montar a lista rodam em paralelo (até 4 ao mesmo tempo, sem a busca de álbuns e playlists) e o resultado segue a ordem dos candidatos, como numa busca por vez.
- **INV-SMART-08:** o nome da playlist é único entre as playlists criadas pela própria pessoa, comparando como foi digitado (sem ignorar maiúsculas; espaços nas pontas não contam). Playlists de outras pessoas não entram na conta (`isPlaylistNameTaken`).
- **INV-SMART-09:** o cartão "Criar playlist com IA" em "Escolhidos para você" e o botão "Criar com IA" na Biblioteca abrem a mesma folha, montada no próprio pedido.
- **INV-SMART-10:** o padrão é de 10 faixas; a folha não oferece outra quantidade (a ampliação adiciona 5).

## Arquitetura e Contrato de API

### Endpoint: `POST /api/smart-playlist`

Guarda: `guardUser` com `POLICIES.catalog`.

Entrada:
```typescript
interface SmartPlaylistRequest {
  prompt: string;      // Texto livre do usuário (máx. 300 caracteres)
  targetCount: number; // 10, 15, 20 ou 25 (limite backend: 30)
}
```

Saída de sucesso (200 OK):
```typescript
interface SmartPlaylistResponse {
  title: string;
  description: string;
  prompt: string;
  tracks: Track[];
  validation: {
    passed: boolean;
    criteriaMet: string[];
    confidenceScore: number;
    varietyScore: number;
    deliveredCount: number;
  };
}
```

Respostas de erro:
- `400`: Prompt vazio ou `targetCount` inválido (`targetCount < 5` ou `targetCount > 30`).
- `401`: Usuário não autenticado.
- `429`: Limite de taxa excedido.
- `502`: Falha nos serviços externos de IA ou catálogo musical.

## Motor de Curação e Validação (`api/_smartPlaylist.ts`)

1. **Interpretação e Curação**: Gemini 3.8 Flash analisa o prompt e produz:
   - Título criativo e descrição adequada.
   - Critérios extraídos (estilo, época, ritmo, clima).
   - Lista expandida de candidatos musicais (quantidade $N = \text{targetCount} + 6$) com artista e título sugerido.
2. **Resolução de Catálogo**:
   - Cada candidato é pesquisado estritamente por faixa musical (`type=track` no Deezer, `entity=song` no iTunes).
   - Rejeição imediata de itens com `kind: 'podcast'`, sem áudio ou pertencentes a playlists pré-fabricadas.
   - Desduplicação por id e por normalização de título + artista.
   - Aplicação da regra antimonopólio: no máximo 2 faixas do mesmo artista na seleção final.
3. **Validação de Conformidade**:
   - O motor valida que o número final atende ao `targetCount` ($\pm 10\%$).
   - O checklist de conformidade é montado com base nos critérios declarados e nas faixas efetivamente resolvidas.
   - Apenas se `passed === true` o resultado é retornado.

## Interface do Usuário

- **Gatilho**: Na tela de Biblioteca (`LibraryScreen`), ao lado do botão de criar playlist comum, exibe-se a ação *"Criar com IA"* com ícone `Sparkles`.
- **Folha de Encomenda (`SmartPlaylistSheet`)**:
  - Campo de texto natural para inserção do prompt com exemplos tocáveis em estilo Apple Music.
  - Seletor de tamanho com botões segmentados: 10, 15, 20 e 25 faixas.
  - Indicador de etapas durante a montagem ("Interpretando pedido...", "Localizando faixas no catálogo...", "Validando critérios...").
- **Visualização de Entrega**:
  - Título da playlist gerada e resumo de validação visual.
  - Lista de faixas com suporte a tocar prévia (30s) e botão para trocar ou remover faixas.
  - Botão de confirmação *"Salvar na Biblioteca"*, adicionando a lista a `PlaylistsContext` e emitindo evento de persistência na conta.
