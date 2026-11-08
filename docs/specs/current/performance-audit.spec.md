# Auditoria de desempenho (2026-11-08)

Pertence ao master [Integrações musicais e reprodução](../../masters/music-integrations.md). **Diagnóstico e plano, nada implementado.** Rótulos: ✅ medido nesta auditoria; 🔎 lido no código; 💭 estimativa ou hipótese, a confirmar no aparelho.

## Como foi medido e o que não foi

- Build de produção (`npm run build`), Chromium headless no ambiente de desenvolvimento (CPU de desktop), com as rotas simuladas dos testes e2e.
- Imagens medidas direto na API do Deezer (tamanhos de capa).
- **Não medido:** o iPhone 11 do usuário. Um iPhone executa JavaScript bem mais devagar que esse computador e carrega a rede com menos banda; por isso as tarefas longas abaixo, que deram zero neste ambiente, podem existir no aparelho. A medição no aparelho é a próxima etapa (ver "Medição no aparelho").

## Números medidos

| O que | Medido | Observação |
| --- | --- | --- |
| JavaScript carregado na abertura | 595 KB (bloco principal de 609 KB; 173 KB comprimido) | ✅ build. Um único bloco, sem divisão por tela |
| Primeira pintura (FCP) | 232 ms | ✅ desktop |
| Tarefas longas (> 50 ms) na abertura e em 6 s de reprodução | 0 | ✅ desktop; não representa o iPhone |
| Cabeçalho de cache do JS e do CSS na produção | `public, max-age=0, must-revalidate` (sem cache de longo prazo, embora o nome tenha hash) | ✅ `curl` na produção, 2026-11-08 |
| Revalidação do JS a cada abertura | 304 em 0,43 s (uma ida e volta, a partir do ambiente de teste) | ✅ produção |
| JS transferido (brotli) | 175,7 kB | ✅ produção |
| Capa de 500 px (a usada hoje nas listas) | 34,7 kB | ✅ Deezer |
| Capa de 250 px | 12,1 kB (−65%) | ✅ Deezer |
| Capa de 120 px | 4,0 kB | ✅ Deezer |
| Capa de 56 px | 1,6 kB | ✅ Deezer |

## Composição do JavaScript (fonte, sem minificar; é proporção, não tamanho final)

- `react-dom`: 36%. Necessário; não há o que tirar.
- `@supabase/auth-js`: 25%. Usado para ler e renovar a sessão; é a maior biblioteca do app.
- Código da aplicação: 34% (123 arquivos). Os maiores: `AudioContext` (62 kB), `App` (35 kB), `ExpandedPlayer` (24 kB), `PodcastsHome` (24 kB), `BackgroundLab` (21 kB).

## Achados (ordenados por impacto no aparelho)

### 1. Capas grandes nas listas (alto impacto em dados e tempo de imagem)
🔎 `api/_deezer.ts` usa `cover_big` (500 px) para toda faixa, inclusive nas miniaturas de 44 px das listas e nas faixas da Início. ✅ Um cartão de 15 faixas carrega cerca de 520 kB de capas em 500 px contra cerca de 180 kB em 250 px (e cerca de 60 kB em 120 px). A Início carrega 14 coleções de 15 faixas (`FEED_PAGE_SIZE = 15`), então o peso é maior ali.
- **Proposta:** `RemoteImage` recebe um tamanho (`thumb` para listas e miniaturas, `large` para o player e a página do álbum) e troca o caminho do Deezer (`/500x500-` por `/250x250-` ou `/120x120-`). O contrato da API não muda (o campo continua o mesmo e o tamanho vira uma escolha de exibição).
- **Atenção:** a rota `/api/media` (proxy de capas) aceita os mesmos hosts, então funciona igual; o cache do service worker e do aparelho guarda o tamanho antigo até expirar.

### 2. Telas que quase ninguém usa entram no carregamento inicial (médio impacto)
🔎 Tudo é importado de forma estática em `App`, `SettingsMenu`, `LibraryScreen` e `LoginScreen`. Exemplos:
- `LoginScreen` e o fundo de WebGL (`SmokeyBackground`): só para quem não está logado, mas o código carrega para todos.
- Dentro de Ajustes: `AdminPanel`, `BackgroundLab`, `CacheSettingsModal`, `PlaybackDiagnostics`. Só o administrador ou quem abre o menu usa.
- `SmartPlaylistSheet` (só ao criar com IA), `RadioView`, `PodcastsHome` e `PodcastScreen` (abertas pelo usuário).
- **Proposta:** `React.lazy` + `Suspense` para esses componentes. Estimativa 💭: 15 a 20% do código da aplicação sai do carregamento inicial. Medir depois.
- **Risco a tratar:** um PWA aberto antes de um deploy que troca o nome dos blocos, ao abrir uma dessas telas, pede um bloco que não existe mais, e a Vercel responde com HTML no lugar de JavaScript (AGENTS.md, "Atualização do app"). Solução: tentar de novo uma vez e, se falhar, mostrar "Atualizar" (o `UpdateBanner` já existe).

### 3. Re-renderização a cada 250 ms com a tela fechada (baixo a médio impacto)
🔎 `ExpandedPlayer` chama `usePlaybackTime()` antes do `if (!isExpanded || !currentTrack) return null`. Com o player fechado ele continua re-renderizando 4 vezes por segundo durante a reprodução, executando todo o corpo da função.
- **Proposta:** separar em um invólucro que só checa `isExpanded` e `currentTrack` e, quando aberto, renderiza o componente que assina o relógio. Mudança pequena e de comportamento idêntico.

### 4. `@supabase/auth-js` é grande para o que o app usa (médio a alto impacto, alto esforço)
🔎 O app usa a biblioteca só para `GoTrueClient` (login por código e renovação da sessão). Todos os dados já passam por chamadas REST com o token (`createRestCaller`).
- **Proposta:** avaliar uma camada mínima própria (ler a sessão guardada e renová-la com um `POST` ao endpoint de token), com testes de renovação, expiração e sair. **Não fazer sem testes**: é a parte de segurança da entrada, e o `AGENTS.md` exige que um 401 não deslogue por erro de configuração.
- Decisão do usuário antes: aceita o risco de manter um código próprio de autenticação?

### 5. Dependências de produção que não são do cliente (baixo impacto)
🔎 `express` está em `dependencies`, mas só `server.ts` (desenvolvimento e testes e2e) usa. `@google/genai` está em `dependencies`, mas só `api/_smartPlaylist.ts` usa (no servidor da Vercel). Mover `express` para `devDependencies` reduz a instalação em produção; não muda o bundle do navegador.

## O que já está bem feito (manter)

- 🔎 O valor de `useAudio()` é memoizado, e o relógio tem contexto próprio (`usePlaybackTime`), como o AGENTS pede.
- 🔎 As linhas de `TrackList` usam `content-visibility: auto`.
- 🔎 Pré-busca em lote do vídeo (`prefetchResolved`) e pré-resolução em tempo ocioso: tocar uma faixa conhecida não espera a rede.
- 🔎 Sem fontes web nem bibliotecas de animação no cliente; as animações são CSS.
- 🔎 O polling do player (250 ms) é o necessário para a barra de progresso.

## Reavaliação: como deixar o impacto no uso em zero (2026-11-08)

Critério: uma melhora só entra se o app continuar igual ou ficar mais rápido, sem texto novo de espera, sem pedir atualização e sem perder qualidade visível. A primeira versão do plano não cumpria isso em três pontos, e uma medição nova mudou a ordem.

| # | Achado | Reavaliação | Abordagem de impacto zero |
| --- | --- | --- | --- |
| A | **Novo, medido:** o JS e o CSS saem da Vercel com `max-age=0, must-revalidate`; o navegador revalida os dois a cada abertura (304 em 0,43 s) | Maior ganho para quem volta ao app, e nenhum risco | `headers` no `vercel.json`: `/assets/(.*)` com `public, max-age=31536000, immutable`. Os arquivos têm hash no nome e nunca mudam; `index.html`, `sw.js` e `version.json` seguem sem cache. A abertura deixa de esperar essa ida e volta. |
| B | O app é deployado várias vezes por dia e cada deploy muda o bloco único de 610 kB | Quem abre depois de um deploy baixa tudo de novo (175 kB com brotli), mesmo que só 1 linha tenha mudado | `build.rollupOptions.output.manualChunks` separando `react`/`react-dom`, `@supabase/auth-js` e `lucide-react` em blocos próprios. O código é o mesmo e roda igual; com o cache longo de A, um deploy passa a baixar só o bloco da aplicação. Reduz também o risco de bloco antigo ausente, porque os blocos de biblioteca mudam pouco. |
| 1 | Capas de 500 px nas listas | Confirmado (34,7 kB contra 12,1 kB em 250 px). Trocar por um tamanho fixo menor poderia deixar a miniatura mais borrada no iPhone (tela 3x) | `srcset` + `sizes` em `RemoteImage`: o navegador escolhe o **menor tamanho que ainda cobre** a largura exibida vezes a densidade da tela (56, 120, 250, 500 px do Deezer). Em uma linha de 44 px a 3x são 132 px, então escolhe 250 px; nada fica mais borrado do que hoje. O player e a página do álbum seguem em 500 px. Mais `decoding="async"` e `<link rel="preconnect">` para o CDN de capas. |
| 2 | Telas que pouca gente usa no bloco inicial | **Rebaixado.** O ganho estimado (20 a 50 ms de execução no iPhone, 💭) é pequeno perto do risco (primeira abertura de uma tela com espera; bloco ausente depois de um deploy). Com A e B, quem volta não baixa nada disso de novo | Só se a medição no aparelho mostrar que o tempo de execução do JS pesa. Nesse caso: `React.lazy` **com pré-carregamento em tempo ocioso** logo depois da Início aparecer (como o AGENTS pede para `import()` dinâmico), para a tela já estar no aparelho quando o toque chegar, mais uma tentativa de novo e o aviso de atualização se o bloco faltar. `LoginScreen` fica de fora: quem não está logado precisa dele na hora. |
| 3 | `ExpandedPlayer` re-renderiza 4 vezes por segundo fechado | Mantido | Invólucro que só checa `isExpanded` e `currentTrack` e renderiza o componente com o relógio apenas quando aberto. Comportamento idêntico. |
| 4 | `@supabase/auth-js` é o maior bloco de biblioteca | **Descartado como troca.** Com A e B ele é baixado uma vez e fica em cache por meses; o que resta é o tempo de execução, pequeno. Trocar por código próprio põe em risco a parte de segurança da entrada (um 401 não pode deslogar por engano) por um ganho que A e B já entregam | Não substituir. Reavaliar só se a medição no aparelho apontar a execução desse bloco. |
| 5 | `express` em `dependencies` | Mantido, sem efeito no navegador | Mover para `devDependencies` (só `server.ts` o usa). |
| 6 | Sem medida no aparelho | A lacuna que decide o resto | Linha no Diagnóstico com tarefas longas e o tempo até a Início, para provar no iPhone que nada piorou e orientar o item 2. |
| 7 | Nada impede o app de crescer de novo | Risco de voltar ao ponto de partida | Orçamento no CI (`scripts/check-bundle.mjs`): falha se o bloco da aplicação passar de um limite, para um aumento ser decisão consciente. |

Também sem custo para o uso, e a confirmar: `<link rel="preconnect" href="https://www.youtube.com">` (o script do player é pedido na abertura; economiza a conexão segura antes do toque, o que ajuda o primeiro toque; 💭 100 a 300 ms em rede móvel, não medido).

### Ordem

1. **A** e **B** (configuração, sem mudar código de tela).
2. **1** (capas por tamanho, com `srcset`), **3** e **5**.
3. **6** e **7** (medir e travar).
4. **2** e **4** só se a medição no aparelho pedir.

## Medição no aparelho (passo 4)

Antes de implementar 2 e 3, medir no iPhone com o próprio Diagnóstico: registrar tarefas longas (`PerformanceObserver` de `longtask`) e o tempo até a Início aparecer, e mostrar essas linhas no relatório. Assim o aparelho confirma a diferença sem depender de ferramenta de desenvolvedor. Proposta de linha: `tarefas longas: N (total X ms, maior Y ms) desde a abertura`.

## Decisões para o usuário

1. Aprova a ordem acima (A e B primeiro: só configuração)?
2. Confirma que as telas sob demanda (item 2) e a troca do `auth-js` (item 4) ficam de fora até a medição no aparelho pedir?
