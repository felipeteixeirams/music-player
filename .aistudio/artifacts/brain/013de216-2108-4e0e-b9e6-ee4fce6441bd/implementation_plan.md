# Especificação e Implementação de Playlists Inteligentes (Smart Playlists)

Criação da especificação documental (`docs/specs/current/smart-playlists.spec.md`) e implementação da funcionalidade de encomendas de playlists em linguagem natural, com tamanho configurável, validação de faixas musicais individuais existentes nas integrações do app (Deezer e iTunes), exclusão estrita de podcasts e de listas prontas, e salvamento direto na conta do usuário.

## Revisão do Usuário e Decisões Críticas

> [!IMPORTANT]
> **Decisões confirmadas e diretrizes de curadoria:**
> 1. **Faixas Musicais Individuais e Existentes**: Cada música da seleção deve ser uma faixa musical individual real e existente no catálogo das integrações do app (Deezer e reserva iTunes), apta para resolução completa de reprodução via YouTube engine.
> 2. **Exclusão Estrita de Podcasts**: O mecanismo rejeita qualquer conteúdo de podcast, feed RSS ou episódio falado; as buscas e validações são restritas a faixas musicais (`type=track` / `entity=song`).
> 3. **Exclusão Estrita de Listas Prontas**: O sistema nunca entrega uma playlist pré-fabricada de terceiros (como playlists editoriais do Deezer ou paradas públicas prontas). A montagem é sempre original e dinâmica, construída faixa a faixa, com regra de diversidade (máximo de 2 faixas por artista/álbum).
> 4. **Teto Máximo e Tamanhos**: Seleção entre 10, 15, 20 ou 25 faixas na interface, com limite máximo rígido de 30 faixas no backend.
> 5. **Pipeline de Validação Pré-Entrega**: Nenhuma playlist é apresentada ao usuário sem que todas as faixas tenham sido localizadas no catálogo e aprovadas pelo validador semântico de aderência ao pedido.

---

## 1. Visão Geral e Conceito Central

- **O que faz**: Permite ao usuário encomendar em linguagem natural uma seleção musical sob medida (ex.: *"Rock instrumental dos anos 70 para concentração"*, *"Pagode e samba acústico dos anos 90 para churrasco"*), definindo o número exato de músicas.
- **Diferencial de Curação**: A IA compreende a intenção, o ritmo, o gênero e a época, gerando termos de busca para faixas musicais individuais. O servidor localiza cada uma nas APIs do Deezer/iTunes, descarta qualquer resultado que seja podcast ou lista pronta, valida a fidelidade temática e entrega uma playlist inédita pronta para reprodução e salvamento.
- **Público e Valor**: Elimina o trabalho manual de buscar música por música ou se contentar com playlists genéricas de terceiros que muitas vezes contêm faixas indesejadas ou irrelevantes.

---

## 2. Experiência do Usuário e Design Visual

### Fluxos Principais

1. **Abertura na Biblioteca**:
   - Na tela da **Biblioteca**, ao lado de *"Nova Playlist"*, é adicionado o botão *"Criar com IA"*.
2. **Modal / Bottom Sheet de Encomenda**:
   - Campo de texto natural com sugestões inspiradoras (ex.: *"MPB suave dos anos 80"*, *"Hard rock anos 90 sem baladas"*, *"Eletrônica calma para programar"*).
   - Controle segmentado de tamanho: 10, 15, 20 ou 25 faixas.
   - Botão de ação *"Gerar Playlist"* na zona de conforto do polegar.
3. **Progresso Transparente**:
   - Feedback em 3 etapas claras:
     1. *"Analisando estilo, época e critérios..."*
     2. *"Buscando faixas individuais nas integrações musicais..."*
     3. *"Validando variedade e fidelidade ao pedido..."*
4. **Entrega e Validação Visível**:
   - Título personalizado e resumo temático.
   - Checklist de validação visível:
     - `✓ Faixas musicais verificadas no catálogo`
     - `✓ Podcasts e listas prontas excluídos`
     - `✓ Critérios de estilo e ritmo atendidos`
     - `✓ Variedade artística garantida`
   - Lista completa com prévias de áudio (30s) tocáveis imediatamente.
   - Ação primária: *"Salvar na Biblioteca"* (adiciona a `PlaylistsContext` e sincroniza com o Supabase).

### Ergonomia e Identidade Visual (Apple Music / PWA)

- **Cores e Materiais**: Fundos escuros `#000000`/`#0a0a0c`, cartões `#16161a` com bordas sutis `border-white/10`, tipografia *Plus Jakarta Sans* e números tabulares.
- **Sem poluição visual (Zero-Pill)**: Metadados limpos com separadores tipográficos (`·`), sem badges coloridos ou gráficos artificiais.
- **Respeito ao iPhone PWA**: Respiro para barra de início (`var(--safe-bottom)`), alvos de toque $\ge 44\text{px}$.

---

## 3. Decisões de Produto e Trade-Offs

- **Decisão 1: Busca Estrita de Faixas Individuais (`type=track`)**:
  - *Abordagem*: O resolvedor de catálogo consulta explicitamente a API de faixas da Deezer (`/search/track`) e, como reserva, o iTunes com `entity=song`.
  - *Por que*: Garante que nenhum podcast (`entity=podcast`, `type=podcast`) e nenhuma playlist pronta (`type=playlist`) entre na consulta ou na montagem.
- **Decisão 2: Algoritmo de Montagem Original e Antimonopólio de Artista**:
  - *Abordagem*: O validador impõe um teto de no máximo 2 faixas do mesmo artista em uma playlist de 15 a 25 músicas, e impede que mais de 3 faixas venham do mesmo álbum.
  - *Por que*: Evita que a lista pareça uma cópia disfarçada de um álbum específico ou de uma coletânea comercial pronta.
- **Decisão 3: Curação e Validação no Servidor via `gemini-3.8-flash`**:
  - *Abordagem*: O prompt do usuário é interpretado pelo Gemini 3.8 Flash no backend. O modelo gera uma lista de candidatos com metadados (artista, música, ano aproximado, motivo da escolha). O backend busca e afere no catálogo cada item. Se um item falhar ou for podcast/duplicata, é substituído imediatamente por uma faixa reserva antes de responder à requisição.
  - *Por que*: Protege a cota do YouTube, não expõe segredos ao navegador e garante que 100% das faixas exibidas funcionem.
- **Decisão 4: Cota e Limites de Requisição**:
  - *Abordagem*: Proteção via `api/_guard.ts` com limite de 10 requisições por minuto por usuário autenticado.

---

## 4. Arquitetura Técnica e Estratégia de Dados

### Diagrama do Pipeline de Curação e Validação

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CLIENTE PWA (Biblioteca)                        │
│                                                                        │
│  [Criar com IA] ──> Digita prompt + Escolhe Qtd (10 a 25)              │
│                           ▲                                            │
│                           │ POST /api/smart-playlist                   │
│                           ▼                                            │
└───────────────────────────┬────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  SERVIDOR BACKEND (/api/smart-playlist)                │
│                                                                        │
│  1. Guard & Auth Check (login obrigatório via token Supabase)          │
│                                                                        │
│  2. Curação Semântica (Gemini 3.8 Flash via @google/genai):            │
│     - Extrai intenção, gênero, época, ritmo e artistas de referência   │
│     - Gera N candidatos musicais com query exata: "artista - faixa"    │
│                                                                        │
│  3. Resolução no Catálogo Musical (Deezer / iTunes):                   │
│     - Consulta restrita a FAIXAS (type=track, entity=song)             │
│     - Filtro negativo: rejeita podcasts, audiobooks e playlists        │
│     - Obtém Track completa: id, title, artist, album, cover, preview   │
│                                                                        │
│  4. Motor de Validação e Montagem Original:                            │
│     - Checagem 1: Nenhuma faixa duplicada                              │
│     - Checagem 2: Diversidade (máx 2 faixas por artista)               │
│     - Checagem 3: Conformidade com o prompt inicial                    │
│     - Checagem 4: Total de faixas bate exatamente o targetCount        │
│     - Se faltar faixa: rodada de substituição automática               │
│                                                                        │
│  5. Entrega: Payload com tracks[] resolvidas e validation report       │
└───────────────────────────┬────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      PERSISTÊNCIA NA CONTA                             │
│                                                                        │
│  - Usuário confere a lista, ouve prévias de 30s                        │
│  - Ao clicar "Salvar na Biblioteca", insere em PlaylistsContext        │
│  - UserDataSnapshot sincroniza via Supabase (UserDataSync)             │
└────────────────────────────────────────────────────────────────────────┘
```

### Contrato de Dados da API (`/api/smart-playlist`)

```typescript
// Requisição POST /api/smart-playlist
interface SmartPlaylistRequest {
  prompt: string;        // Texto livre do usuário
  targetCount: number;   // 10, 15, 20 ou 25 (teto backend: 30)
}

// Resposta 200 OK
interface SmartPlaylistResponse {
  title: string;
  description: string;
  prompt: string;
  tracks: Track[];       // Faixas reais com id de catálogo, cover e previewUrl
  validation: {
    passed: boolean;
    criteriaMet: string[];
    confidenceScore: number;
    varietyScore: number;
    excludedTypes: string[]; // ["podcasts", "curated_playlists", "audiobooks"]
    deliveredCount: number;
  };
}
```

### Especificação Documental e Novos Invariantes

Arquivo criado em `docs/specs/current/smart-playlists.spec.md`, referenciado em `docs/masters/music-integrations.md` e `docs/README.md`:

- `INV-SMART-01`: Todas as faixas entregues são músicas individuais existentes no catálogo (Deezer ou iTunes).
- `INV-SMART-02`: Conteúdos do tipo podcast, episódios falados ou playlists pré-montadas de terceiros são estritamente excluídos.
- `INV-SMART-03`: A lista gerada garante diversidade, limitando a no máximo 2 faixas do mesmo artista.
- `INV-SMART-04`: O validador de conformidade atesta que o tema e tamanho pedidos foram atendidos antes da entrega ao usuário.
- `INV-SMART-05`: O salvamento da playlist gerada utiliza o pipeline padrão de `UserDataSnapshot`, garantindo sincronização imediata na conta Supabase.

---

## 5. Plano de Execução em Fases

1. **Fase 1: Especificação Documental e Governança**:
   - Criar `docs/specs/current/smart-playlists.spec.md` com os invariantes e regras.
   - Atualizar `docs/masters/music-integrations.md` e `docs/README.md`.
   - Atualizar `tests/docs.test.ts` para verificar os novos invariantes e links.
2. **Fase 2: Backend, Integração Gemini e Motor de Validação**:
   - Implementar helper `api/_smartPlaylist.ts` e endpoint `api/smart-playlist.ts`.
   - Configurar prompt estruturado do `gemini-3.8-flash` via `@google/genai` (server-side com `GEMINI_API_KEY`).
   - Implementar busca estrita de faixas (`type=track`), exclusão de podcasts e algoritmo de validação/substituição.
   - Criar testes automatizados em `tests/api/smart-playlist.test.ts`.
3. **Fase 3: Interface do Usuário (Biblioteca)**:
   - Adicionar o botão *"Criar com IA"* na tela de Biblioteca (`LibraryScreen`).
   - Construir o modal/sheet de encomenda com seletor de faixas (10 a 25) e exemplos de prompt.
   - Desenvolver visualização de progresso e tela de resultado com prévias e botão de salvar.
   - Integrar com `PlaylistsContext` e `useAuth().storage`.
4. **Fase 4: Verificação Completa e Testes**:
   - Adicionar teste de ponta a ponta no Playwright (`tests/e2e/smart-playlist.spec.ts`) com mock em `stubApi`.
   - Executar bateria completa: `npm test`, `npm run lint` e `npm run test:e2e`.
