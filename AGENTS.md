# Instruções para agentes

## Base documental

Este repositório mantém a documentação de domínio em uma hierarquia **root -> master -> satélite**. Antes de alterar um domínio documentado, comece pelo único ponto de entrada geral: [docs/README.md](docs/README.md). O root aponta para os masters; cada master direciona aos satélites ativos com o contexto e os critérios específicos.

Procedimento obrigatório:

1. Leia `docs/README.md` para localizar o master aplicável.
2. Leia o master e os satélites ativos que cobrem a tarefa.
3. Inspecione o código e `git status` antes de editar; documentação não substitui o estado real do workspace.
4. Se código e documentação divergirem, investigue e atualize o documento proprietário correto. Não crie uma segunda página de entrada em `docs/`.
5. Ao adicionar documentação, atualize o master e o root para manter a navegação root -> master -> satélite. Detalhe requisitos granulares em satélites; não sobrecarregue o root.

`docs/README.md` é a única entrada geral da base documental. Os masters e satélites são acessados por seus links e não devem ser tratados como índices globais. Instruções operacionais específicas deste repositório podem ser adicionadas aqui; contexto de domínio e especificações extensas pertencem à hierarquia de `docs/`.

## Branches e Pull Requests

Um branch existe para conduzir um único trabalho e deve ser mergeado e excluído ao final. Branch aberto ou abandonado por muito tempo é falta de controle.

- Não trabalhe direto na `main`: crie um branch a partir da `main` atualizada, com um objetivo só.
- Não crie branches auxiliares. Se o trabalho continuar, continue no mesmo branch em vez de abrir outro que o contenha.
- Só abra Pull Request quando o usuário pedir. O branch segue o PR até o merge.
- Depois do merge, o branch deve ser excluído do remoto. Se o ambiente não permitir a exclusão (o gateway Git de sessões na nuvem retorna 403), informe ao usuário quais branches sobraram e como apagá-los, em vez de contornar a restrição.
- Antes de encerrar o trabalho, liste os branches remotos (`git branch -r`) e relate qualquer um que tenha criado e que continue aberto.
- Para checar se um branch é seguro de apagar, compare com a `main` (`git rev-list --count origin/main..<branch>`) e confira se o PR dele foi mergeado.

## Dependências

O gerenciador é o npm, e `package-lock.json` é o único lockfile. `npm ci` deve funcionar sem `--force` nem `--legacy-peer-deps`. Antes de adicionar um pacote, confirme que algum código vai importá-lo; remova o que deixar de ser usado.

Decisão de 2026-10-25: os pacotes abaixo vieram do template do Google AI Studio, nunca foram importados no projeto e foram removidos. Não os adicione de novo sem uma necessidade concreta e registrada aqui.

| Pacote | Por que não é necessário |
| --- | --- |
| `@google/genai` | O app não chama a API Gemini. Busca, feed e reprodução usam Deezer, iTunes e YouTube. `GEMINI_API_KEY` no `.env.example` e a capacidade em `metadata.json` são sobras do template. |
| `dotenv` | Nenhum código lê `.env`. Em produção as variáveis vêm da Vercel (`YOUTUBE_API_KEY`) e, no AI Studio, dos Secrets da plataforma. |
| `motion` | Nenhuma animação usa a biblioteca; as transições são CSS/Tailwind. |
| `autoprefixer` | O Tailwind v4 roda pelo plugin do Vite (`@tailwindcss/vite`) e não há `postcss.config`. |

O player do YouTube é `src/utils/youtubeEngine.ts` (API de iframe do próprio YouTube, carregada de `https://www.youtube.com/iframe_api`); `react-player` e `youtube-video-element` saíram em 2026-10-27 porque recriavam o iframe a cada faixa, fora do toque. Não os adicione de novo.

`@vercel/node` é devDependency só pelos tipos (`VercelRequest`, `VercelResponse`). O `npm audit` aponta vulnerabilidades apenas nas dependências dele (ferramentas de build, fora do bundle das funções) e a correção sugerida (`npm audit fix --force`) faria downgrade para a v4: não aplique sem avaliar.

## Funções da Vercel

Todo arquivo `.ts` em `api/` cujo nome não começa com `_` vira uma função serverless, e o plano Hobby aceita no máximo 12 por deploy; passar disso faz o deploy falhar. Por isso `api/` guarda só endpoints (hoje 8: `audio`, `category`, `feed`, `health`, `radio`, `report`, `resolve` e `search`), helpers levam o prefixo `_` e os testes ficam em `tests/` (os de `api/` em `tests/api/`). `tests/vercel-functions.test.ts` falha se um teste entrar em `api/` ou se o total passar de 12. Antes de criar um endpoint novo, avalie se ele cabe em uma rota existente.

## Interface em PWA no iPhone

O app roda em tela cheia (`viewport-fit=cover` e barra de status `black-translucent`), então o conteúdo chega até o recorte e o indicador de início do iPhone. Barras fixas ou fixadas ao topo e à base somam `var(--safe-top)` e `var(--safe-bottom)` (definidas em `src/index.css` a partir de `env(safe-area-inset-*)`, valendo 0 onde não há recorte) ao próprio espaçamento: o título grande e a faixa fixa sobre a barra de status (`TopBar`), a navegação inferior (cápsula flutuante com o mini player em pílula acima dela, num contêiner fixo em `bottom: max(0.5rem, calc(var(--safe-bottom) - 0.8rem))` (21 px da borda no iPhone 11, como no Apple Music) e com 21 px de margem lateral: `BottomNavBar`; ao rolar a página para baixo ela recolhe e, tocando música, vira uma linha só com o círculo da aba atual, o mini player e o círculo da busca), o aviso offline. O conteúdo reserva `10rem + var(--safe-bottom)` no fim (`App`) e o aviso fixo da base (nova versão a 11rem) fica acima desse contêiner. Ao criar um elemento `fixed` ou `sticky` encostado em uma borda da tela, faça o mesmo. Para testar sem o aparelho, sobrescreva as variáveis no navegador (iPhone 11: 48px no topo e 34px na base).

## Testes e integração contínua

- `npm test`: unitários e de handlers (`*.test.ts` em `src/` e `tests/`, com `node:test`). `npm run test:e2e`: ponta a ponta com o Playwright (`tests/e2e/*.spec.ts`), contra o app construído e servido pelo `server.ts`. O sufixo importa: `.test.ts` é do `npm test` e `.spec.ts` é do Playwright, e um não enxerga o outro.
- Os testes de ponta a ponta nunca tocam a Deezer, o YouTube nem a internet: `stubApi` (`tests/e2e/fixtures.ts`) responde todas as rotas `/api/*`. Por isso `playwright.config.ts` usa `serviceWorkers: 'block'`: o service worker do app faz as requisições por conta própria e `page.route` não as vê, o que fazia os testes receberem dados reais. Ao criar uma rota nova, acrescente a resposta dela em `stubApi`.
- `tests/e2e/api.spec.ts` é a exceção: chama as rotas reais, só para o que não precisa de terceiros (proteção das rotas, validação de parâmetros, `health`, `version.json`).
- Toda mudança de comportamento visível (navegação, abas, listas, favoritos, Rádio, ajustes) deve ganhar ou atualizar um teste de ponta a ponta. Antes de abrir um PR rode `npm run lint`, `npm test` e `npm run test:e2e`; localmente o Playwright usa os navegadores já instalados (`CHROMIUM_PATH` aponta para outro executável, se preciso).
- `.github/workflows/ci.yml` roda tipos, testes, build e ponta a ponta em todo PR e em todo push na `main`, e guarda o relatório do Playwright quando falha. Para o merge exigir o resultado, ative em Settings > Branches a regra "Require status checks to pass" com o job `checks`.

## Proteção das rotas públicas

Toda rota de `api/` (menos `health`) passa por `await guard(req, res, POLICIES.<tipo>)` de `api/_guard.ts`, e o `server.ts` aplica a mesma regra em um middleware de `/api`. A regra tem três partes, nesta ordem (as baratas primeiro, para uma enxurrada não chegar ao Supabase): login (`Authorization: Bearer` verificado em `api/_auth.ts` consultando `/auth/v1/user` do Supabase, com a confirmação lembrada por 1 minuto; sem as variáveis o login fica desligado localmente e, na Vercel, a rota recusa com 503 em vez de abrir), e as duas abaixo: só páginas do próprio site (`Sec-Fetch-Site: same-origin`, ou `Origin`/`Referer` com o mesmo host nos navegadores antigos) e um limite de requisições por endereço por minuto (`resolve` 40, `audio` 30, demais 120). O objetivo é proteger a cota diária da YouTube Data API (cada busca de vídeo custa 100 das 10.000 unidades) e a banda; o limite é contado na memória de cada instância e os cabeçalhos podem ser forjados por um script, então isto não substitui o firewall da Vercel contra um ataque distribuído. Ao criar uma rota nova: use `guard` (ou `guardUser`, quando precisar saber quem chama) e uma política (crie uma em `POLICIES` se o custo for diferente), limite o tamanho das entradas e só ponha `Cache-Control` em respostas bem-sucedidas (falha não se cacheia); resposta que depende do usuário (`resolve`, por causa da cota) leva `private, no-store`. Uma chamada sem objeto `headers` (teste unitário, chamada interna) não passa pelo guard.

## Desempenho: estado que muda várias vezes por segundo

`useAudio()` não traz o relógio da reprodução: posição e duração ficam em `usePlaybackTime()` (contexto separado), porque cada componente que lê `useAudio()` renderiza de novo quando o valor do contexto muda e o relógio muda cerca de 4 vezes por segundo. Só quem mostra o tempo (`ExpandedPlayer`) deve usá-lo. O valor de `useAudio()` é memoizado: ao incluir um campo novo, ele precisa ser estável (`useMemo`/`useCallback`) e entrar na lista de dependências, senão a lista de 100 faixas volta a renderizar a cada tick. Callbacks que precisam do tempo atual leem `currentTimeRef`/`durationRef`, e os controles da tela de bloqueio chamam `mediaActionsRef`. As linhas de `TrackList` usam `content-visibility: auto`, então o navegador não monta o que está fora da tela.

## Atualização do app e compatibilidade da API

Um deploy novo não reinicia as sessões abertas: um PWA aberto (no iPhone costuma voltar do segundo plano sem recarregar) segue com o código antigo até recarregar. Por isso:

- Mudanças nas respostas de `api/` devem ser compatíveis com o cliente anterior: acrescente campos, não renomeie nem remova. Para quebrar um contrato, publique primeiro uma versão que aceite os dois formatos e só depois remova o antigo.
- `vite.config.ts` grava `version.json` no build e define `__APP_VERSION__`. `UpdateBanner` compara os dois quando o app volta ao primeiro plano (e a cada 10 minutos) e oferece "Atualizar"; nunca recarrega sozinho para não cortar a música. `public/sw.js` não intercepta `/version.json`.
- `vercel.json` responde 200 com HTML para qualquer arquivo inexistente. Um chunk com hash de um deploy anterior não dá 404: o navegador recebe HTML no lugar de JavaScript. o player do YouTube não é mais um chunk (é um script do YouTube, baixado por `youtubeEngine.preload()` na abertura do app); ao criar outro `import()` dinâmico necessário para tocar, faça um pré-carregamento parecido.


## Login e variáveis do Supabase

O app é fechado por convite (Supabase Auth, código de 6 dígitos por e-mail digitado no próprio app, que funciona no PWA do iPhone; link mágico abriria o Safari e não o app instalado). O código vale 90 s, há espera de 60 s para reenviar e a tela responde igual para e-mail sem convite (`src/utils/loginCode.ts`; o modelo do e-mail está em `supabase/templates/magic-link.html` e é colado à mão no painel; os tempos precisam casar com os do painel). Detalhes em [docs/masters/accounts-and-data.md](docs/masters/accounts-and-data.md). A integração da Vercel prefixa as variáveis com `DATABASE_`: o cliente lê `DATABASE_VITE_SUPABASE_URL` e `DATABASE_VITE_SUPABASE_ANON_KEY` (ou `PUBLISHABLE_KEY`), por isso `vite.config.ts` usa `envPrefix: ['VITE_', 'DATABASE_VITE_']`. Esse prefixo é estreito de propósito: `DATABASE_SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_SUPABASE_JWT_SECRET` e as `DATABASE_POSTGRES_*` não podem entrar no bundle; não alargue o prefixo e confira com `grep` em `dist/` se mexer nisso. Chamadas às rotas `/api` pelo cliente usam `apiFetch` (`src/utils/apiFetch.ts`), que envia o login e, num 401, renova a sessão uma vez antes de deslogar. Nos testes de ponta a ponta o login aponta para um mock (`tests/e2e/supabaseMock.ts`) e o app é construído com `npm run build:e2e` (`.env.e2e`); `stubApi` já entra logado, e `stubApi(page, { signedIn: false })` mostra o login.

## Dados por usuário no aparelho

Favoritos, playlists e escolhas de versão são da conta: leia e grave sempre pelo `storage` de `useAuth()` (chaves sufixadas pelo id do usuário), nunca por `localStorage` direto, e chame `emitUserDataChanged()` depois de salvar para a sincronização enviar a mudança; para reagir a dados vindos da conta, escute `onUserDataApplied` e releia o armazenamento. Dado novo que deva seguir o usuário entre aparelhos entra em `UserDataSnapshot` (`src/utils/userData.ts`), no diff, no cliente REST e numa migração SQL; o que é do aparelho (cache de início, limite de cache) fica em `localStorage` puro. Nos testes e2e `stubApi` cria um usuário novo por teste (cada um com a própria conta no mock), para testes em paralelo não compartilharem dados.

## Cache de vídeos e cota por usuário

`/api/resolve` passa pelo cache compartilhado (`video_cache`) e pela cota diária (`consume_resolve`) antes de gastar uma busca do YouTube; as regras ficam em `api/_resolveEndpoint.ts`, usadas pela função da Vercel e pelo `server.ts`. O servidor fala com o banco com `DATABASE_SUPABASE_SERVICE_ROLE_KEY` (só variável de ambiente do servidor; nunca em variável com prefixo `VITE_`/`DATABASE_VITE_`, nunca no repositório). Sem ela a rota funciona como antes (sem cache nem limite). Ao mudar o contrato da rota, só acrescente campos (clientes antigos continuam abertos). Migrações novas entram como `0003_*.sql` etc. e o teste de `tests/db/` carrega todas em ordem.

## Histórico de reprodução

O histórico não passa pelo `UserDataSnapshot`: só cresce, então cada reprodução entra numa fila de envio (`recordPlay` em `src/utils/playHistory.ts`) e `PlayHistorySync` a envia e lê a lista da conta. Quem conta a reprodução é `PlayedCounter`, alimentado pelo relógio do player em `AudioContext` (nos dois caminhos: áudio nativo e player oculto); mexer em como o relógio chega lá exige conferir o histórico nos testes e2e (`tests/e2e/history.spec.ts` usa faixas de 4 s com áudio de verdade, silencioso, via `stubApi(page, { shortTracks: true })`). Chamadas REST ao Supabase com o token do usuário usam `createRestCaller` (`src/utils/supabaseRest.ts`).

## Rastreabilidade dos logs

Toda linha de log escrita durante um pedido começa com `rid=` (o pedido), `sid=` (a sessão do app no aparelho), `uid=` (o id da conta, depois do login) e `route=` (`api/_trace.ts`; o `guard` inicia o rastro e `installTraceLogging` põe a etiqueta em `console.log/info/warn/error`). O app gera `sid` (uma abertura) e `rid` (um pedido) em `src/utils/trace.ts` e os envia em `X-Session-Id` e `X-Request-Id` pelo `apiFetch`, que também registra `[Net] <status> rid=… sid=…` quando uma chamada falha; o servidor devolve `X-Request-Id`. Erros que o app não tratou (`window.onerror`, promessas rejeitadas e a `ErrorBoundary`) vão para `POST /api/report` (sem exigir login: o erro pode estar na tela de login) e viram `[Client] kind=… v=… mode=pwa|browser ua=… msg=… stack=… recent=…`, com o fim do log de reprodução. O código da sessão aparece na tela de erro e no relatório de Ajustes > Diagnóstico: com ele se acha tudo no log da Vercel (`sid=<código>`). Nunca ponha e-mail, token ou chave num log (`scrub`); o id da conta inteiro é aceito (decisão do usuário, 2026-10-28). Ao criar uma rota, use `guard` (já inicia o rastro) e não crie outro formato de linha. Detalhes e invariantes (`INV-OBS-01` a `03`) em [docs/masters/accounts-and-data.md](docs/masters/accounts-and-data.md).

## Falhas de login: 401 e 503

`api/_auth.ts` separa o que é do usuário (401: sem token, sessão inválida) do que é do servidor (503: login não configurado, chave pública recusada, Supabase fora do ar). Mantenha essa separação: o cliente (`apiFetch`) encerra a sessão só num 401, então um erro de configuração que virasse 401 deslogaria todo mundo. Toda recusa vai para o log com `[Auth] <status> <código> (<detalhe>) <método> <caminho>` e nunca com token, chave ou e-mail; ao criar um novo tipo de recusa, dê um `code` e um `detail`, e um teste em `tests/api/auth.test.ts`.

## Verificação da configuração

A configuração de que o app depende é verificada por `api/_config.ts` ao iniciar (log `[Config] …`), em `/api/health` (`?deep=1` consulta o Supabase), no CI (`scripts/check-bundle.mjs`: segredos de mentira não podem ir ao `dist/`) e depois de cada deploy de produção (`.github/workflows/post-deploy.yml` -> `scripts/check-deploy.mjs`). A resposta de `/api/health` é pública: só ids e níveis, nunca nomes de variáveis nem valores; os nomes vão só para o log. Ao criar uma variável de ambiente, declare-a em `.env.example` e em `DOCUMENTED_VARS` de `tests/config.test.ts` (o teste reprova variável não declarada); se algo depender dela, acrescente a verificação e a linha da tabela em [docs/masters/accounts-and-data.md](docs/masters/accounts-and-data.md).

## Início da reprodução (toque, segundo plano)

No iPhone um áudio só começa por causa de um toque e logo depois dele: nada que fique entre o toque e o `play()` pode esperar a rede sem um plano. Mantenha: o desbloqueio do elemento de áudio no toque (`unlockAudioElement` em `playTrack`), o vigia de início (`expectPlayback`/`playbackStarted`/`engineReady` em `AudioContext`: a tela não pode mostrar "tocando" sem som) e o `apiFetch` sem esperas no caminho do toque (token em memória; não chame `getSession()` ali). As funções da Vercel ficam em `gru1` (`vercel.json`), perto do banco: não mude a região sem medir o `/api/resolve`. Todo toque que inicia música (faixa, rádio, rádio ao vivo, ▶) chama `primeInTap` em `AudioContext` (desbloqueia o áudio e cria o player antes de qualquer espera de rede); um caminho novo de início precisa fazer o mesmo. O player oculto do YouTube é criado assim que o app abre (`youtubeEngine.preload()` e `prime('abertura')` em `App`, sem espera: um toque 1 s depois da abertura chegou antes dos 2 s antigos e falhou, relatório de 2026-10-28) ou, se ainda não existir, no toque (`youtubeEngine.prime()`), para estar pronto quando o toque chegar, e é um só pela sessão: as faixas seguintes entram nele por `loadVideoById`, sem novo iframe. Faixa de vídeo ainda desconhecido: sem prévia como ponte (decisão do usuário, 2026-10-28). O botão de reproduzir mostra carregamento (`PlaybackIcon`: anel animado, sem texto, `aria-busy`) de `isBuffering` até o som começar de verdade (`playbackStarted`) ou o vigia desistir, e a faixa completa começa pelo player do YouTube, que tenta de novo sozinho (nada de botão: INV-PLAY-07 a 11). A prévia só toca quando não há faixa completa (sem vídeo, cota do dia acabada) ou ela falhou. Evidência do aparelho (2026-10-27, app instalado, relatório do Diagnóstico): a faixa começou sozinha quando o vídeo já era conhecido e o player já estava pronto no toque (`loadVideoById` dentro do toque); falhou quando o player ainda carregava ou a busca passava de ~1 s.  A tentativa de liberar o player com um vídeo-reserva mudo no toque (`unlock`, PR #58) foi retirada (2026-10-28). Prévia tocando ao lado do player (PRs #56 a #62) também foi retirada: a cada tentativa de iniciar um vídeo que o iOS recusava, o som da prévia era tirado. Faixa completa = player oculto do YouTube: no navegador do iPhone ela segue tocando com a tela bloqueada (T04), no app instalado (PWA) o iOS a pausa. Ao investigar "parou em segundo plano" ou "não toca no primeiro toque", primeiro descubra se é o PWA ou o navegador (o PWA não tem barra de endereço). O que acontece em cada início vai para `logPlayback` (Ajustes > Diagnóstico); ao mexer nesse fluxo, registre os novos passos ali. Detalhes em [docs/masters/music-integrations.md](docs/masters/music-integrations.md).

## Prévia do Deezer vence em 15 minutos

O link de prévia do Deezer é assinado (`hdnea=exp=…`) e para de funcionar cerca de 15 minutos depois de a lista ser feita, enquanto o feed fica em cache por horas (CDN e aparelho). Por isso `playPreview` renova o link antes de tocar um vencido (`GET /api/search?preview=deezer-<id>`, INV-PREV-01 a 03). Ao criar um caminho que toque uma prévia, passe por ele (ou por `isPreviewStale`) em vez de usar `track.sources.previewUrl` direto. `apiFetch` não espera a biblioteca de sessão mais de 2,5 s (ela pode travar no iOS depois do app ficar fora) e nunca encerra a sessão por demora, só por um 401 do servidor.

## Vídeo conhecido antes do toque

Tocar uma faixa não deve esperar a rede quando o vídeo já é conhecido: `resolveFullTrack` responde na hora com o que o aparelho guarda (`ResolvedStore`) e `prefetchResolved` (carrosséis, listas e a fila) pergunta em lote ao cache compartilhado (`POST /api/resolve` com `lookup`, que nunca busca nem gasta cota). Ao criar uma lista ou carrossel de faixas novo, chame `prefetchResolved`; ao mexer no cache do servidor, mantenha as duas chaves (id do catálogo e música, `cacheKeysFor`) e a denúncia que limpa as duas. A única coisa que gasta busca do YouTube é a resolução de uma faixa que ninguém tocou: no toque, ou antes dele pela pré-resolução (`warmResolve`, `GET /api/resolve?warm=1`, `src/utils/warmResolve.ts`), que procura em tempo ocioso o vídeo das 2 próximas da fila e das 2 primeiras de cada cartão personalizado. Ela divide o mesmo total diário dos toques, mas só até `dailyLimit - WARM_RESERVE` (a parte restante fica para os toques; INV-PLAY-14); ao criar um novo ponto de pré-resolução, passe por `warmResolve` e não por `resolveFullTrack`.

## Cota do YouTube esgotada: disjuntor

Quando a cota diária da YouTube Data API acaba, o primeiro erro `quotaExceeded` abre um disjuntor (`api/_youtubeBreaker.ts`, tabela `service_state` da migração `0003`, compartilhado entre as instâncias): a busca oficial para até a meia-noite do Pacífico, e as buscas seguintes vão direto à busca web (`via web-api-suspended`). A pré-resolução fica desligada enquanto isso e a resposta de `/api/resolve` traz `youtube: 'suspended'`. Ele nunca impede a busca e falha aberto (sem banco ou sem a tabela vale só na instância). Ao tratar um novo tipo de falha da reprodução ou da busca, acrescente a linha ao "Mapa de falhas da reprodução" do [master de integrações](docs/masters/music-integrations.md) (INV-PLAY-15). A migração `0003_service_state.sql` é aplicada à mão no painel do Supabase (SQL Editor), como as anteriores.

## Triagem: relato de problema ou "regressão"

Antes de dizer que algo regrediu (ou que "não tem como resolver"), nesta ordem:

1. **Ambiente:** é o app instalado (PWA, sem barra de endereço) ou o navegador? Qual versão do app? O relatório de Ajustes > Diagnóstico de reprodução abre com isso (versão, `APP INSTALADO (PWA)` ou `NAVEGADOR`, sistema e navegador): peça-o inteiro.
2. **Matriz:** a linha da [matriz de compatibilidade](docs/specs/current/compatibility-matrix.spec.md) para essa capacidade e esse ambiente diz ✅, ❌ ou ⬜? ❌ já conhecido é limite, não regressão; ✅ que agora falha é regressão, e o PR suspeito entra na observação da linha.
3. **Roteiro e histórico:** o item do [roteiro de validação](docs/specs/current/validation-checklist.spec.md) tem resultado registrado? O que mudou nos arquivos da capacidade desde então (`git log -- <arquivos>`)?
4. **Evidência antes de afirmar:** não escreva "o iPhone sempre faz X" ou "não há como evitar" sem uma linha da matriz ou um teste que o prove; diga "hipótese" quando for suposição. Ao confirmar ou desmentir algo no aparelho, atualize a matriz no mesmo dia.
5. **Regra dos invariantes:** cada master lista invariantes (`INV-…`) e `tests/docs.test.ts` exige um teste que cite cada um. Ao criar ou mudar uma regra que não pode quebrar, dê-lhe um id no master e ponha o id no título do teste que a garante.
