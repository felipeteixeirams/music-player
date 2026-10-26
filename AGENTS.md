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

`react-player` é usado só para YouTube: `src/components/youtubePlayer.ts` monta um player restrito a ele (importando `react-player/ReactPlayer` e `react-player/patterns`, exports não documentados) para o build não gerar chunks de hls.js, dash.js, Mux, Vimeo etc. Por isso `youtube-video-element` é dependência direta. Ao atualizar o `react-player`, revise esse arquivo e confira se `npm run build` continua sem esses chunks.

`@vercel/node` é devDependency só pelos tipos (`VercelRequest`, `VercelResponse`). O `npm audit` aponta vulnerabilidades apenas nas dependências dele (ferramentas de build, fora do bundle das funções) e a correção sugerida (`npm audit fix --force`) faria downgrade para a v4: não aplique sem avaliar.

## Funções da Vercel

Todo arquivo `.ts` em `api/` cujo nome não começa com `_` vira uma função serverless, e o plano Hobby aceita no máximo 12 por deploy; passar disso faz o deploy falhar. Por isso `api/` guarda só endpoints (hoje 7: `audio`, `category`, `feed`, `health`, `radio`, `resolve` e `search`), helpers levam o prefixo `_` e os testes ficam em `tests/` (os de `api/` em `tests/api/`). `tests/vercel-functions.test.ts` falha se um teste entrar em `api/` ou se o total passar de 12. Antes de criar um endpoint novo, avalie se ele cabe em uma rota existente.

## Interface em PWA no iPhone

O app roda em tela cheia (`viewport-fit=cover` e barra de status `black-translucent`), então o conteúdo chega até o recorte e o indicador de início do iPhone. Barras fixas ou fixadas ao topo e à base somam `var(--safe-top)` e `var(--safe-bottom)` (definidas em `src/index.css` a partir de `env(safe-area-inset-*)`, valendo 0 onde não há recorte) ao próprio espaçamento: o título grande e a faixa fixa sobre a barra de status (`TopBar`), a navegação inferior (cápsula flutuante com o mini player em pílula acima dela, num contêiner fixo em `bottom: max(0.5rem, calc(var(--safe-bottom) - 0.8rem))` (21 px da borda no iPhone 11, como no Apple Music) e com 21 px de margem lateral: `BottomNavBar`; ao rolar a página para baixo ela recolhe e, tocando música, vira uma linha só com o círculo da aba atual, o mini player e o círculo da busca), o aviso offline e o aviso de download. O conteúdo reserva `10rem + var(--safe-bottom)` no fim (`App`) e os avisos fixos da base (nova versão a 11rem, download a 10,5rem) ficam acima desse contêiner. Ao criar um elemento `fixed` ou `sticky` encostado em uma borda da tela, faça o mesmo. Para testar sem o aparelho, sobrescreva as variáveis no navegador (iPhone 11: 48px no topo e 34px na base).

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
- `vercel.json` responde 200 com HTML para qualquer arquivo inexistente. Um chunk com hash de um deploy anterior não dá 404: o navegador recebe HTML no lugar de JavaScript. `preloadYouTubePlayer` baixa o chunk do player no início da sessão por isso; ao criar outro `import()` dinâmico necessário para tocar, faça o mesmo.


## Login e variáveis do Supabase

O app é fechado por convite (Supabase Auth, código de 6 dígitos por e-mail digitado no próprio app, que funciona no PWA do iPhone; link mágico abriria o Safari e não o app instalado). O código vale 90 s, há espera de 60 s para reenviar e a tela responde igual para e-mail sem convite (`src/utils/loginCode.ts`; o modelo do e-mail está em `supabase/templates/magic-link.html` e é colado à mão no painel; os tempos precisam casar com os do painel). Detalhes em [docs/masters/accounts-and-data.md](docs/masters/accounts-and-data.md). A integração da Vercel prefixa as variáveis com `DATABASE_`: o cliente lê `DATABASE_VITE_SUPABASE_URL` e `DATABASE_VITE_SUPABASE_ANON_KEY` (ou `PUBLISHABLE_KEY`), por isso `vite.config.ts` usa `envPrefix: ['VITE_', 'DATABASE_VITE_']`. Esse prefixo é estreito de propósito: `DATABASE_SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_SUPABASE_JWT_SECRET` e as `DATABASE_POSTGRES_*` não podem entrar no bundle; não alargue o prefixo e confira com `grep` em `dist/` se mexer nisso. Chamadas às rotas `/api` pelo cliente usam `apiFetch` (`src/utils/apiFetch.ts`), que envia o login e, num 401, renova a sessão uma vez antes de deslogar. Nos testes de ponta a ponta o login aponta para um mock (`tests/e2e/supabaseMock.ts`) e o app é construído com `npm run build:e2e` (`.env.e2e`); `stubApi` já entra logado, e `stubApi(page, { signedIn: false })` mostra o login.

## Dados por usuário no aparelho

Favoritos, playlists e escolhas de versão são da conta: leia e grave sempre pelo `storage` de `useAuth()` (chaves sufixadas pelo id do usuário), nunca por `localStorage` direto, e chame `emitUserDataChanged()` depois de salvar para a sincronização enviar a mudança; para reagir a dados vindos da conta, escute `onUserDataApplied` e releia o armazenamento. Dado novo que deva seguir o usuário entre aparelhos entra em `UserDataSnapshot` (`src/utils/userData.ts`), no diff, no cliente REST e numa migração SQL; o que é do aparelho (cache de início, limite de cache) fica em `localStorage` puro. A lista de downloads offline é por usuário no aparelho (`offlineManager` recebe o `storage` de `useAuth()`), mas não sincroniza com a conta; o arquivo de áudio é compartilhado e só some quando ninguém do aparelho o lista. Nos testes e2e `stubApi` cria um usuário novo por teste (cada um com a própria conta no mock), para testes em paralelo não compartilharem dados.

## Cache de vídeos e cota por usuário

`/api/resolve` passa pelo cache compartilhado (`video_cache`) e pela cota diária (`consume_resolve`) antes de gastar uma busca do YouTube; as regras ficam em `api/_resolveEndpoint.ts`, usadas pela função da Vercel e pelo `server.ts`. O servidor fala com o banco com `DATABASE_SUPABASE_SERVICE_ROLE_KEY` (só variável de ambiente do servidor; nunca em variável com prefixo `VITE_`/`DATABASE_VITE_`, nunca no repositório). Sem ela a rota funciona como antes (sem cache nem limite). Ao mudar o contrato da rota, só acrescente campos (clientes antigos continuam abertos). Migrações novas entram como `0003_*.sql` etc. e o teste de `tests/db/` carrega todas em ordem.

## Histórico de reprodução

O histórico não passa pelo `UserDataSnapshot`: só cresce, então cada reprodução entra numa fila de envio (`recordPlay` em `src/utils/playHistory.ts`) e `PlayHistorySync` a envia e lê a lista da conta. Quem conta a reprodução é `PlayedCounter`, alimentado pelo relógio do player em `AudioContext` (nos dois caminhos: áudio nativo e player oculto); mexer em como o relógio chega lá exige conferir o histórico nos testes e2e (`tests/e2e/history.spec.ts` usa faixas de 4 s com áudio de verdade, silencioso, via `stubApi(page, { shortTracks: true })`). Chamadas REST ao Supabase com o token do usuário usam `createRestCaller` (`src/utils/supabaseRest.ts`).

## Falhas de login: 401 e 503

`api/_auth.ts` separa o que é do usuário (401: sem token, sessão inválida) do que é do servidor (503: login não configurado, chave pública recusada, Supabase fora do ar). Mantenha essa separação: o cliente (`apiFetch`) encerra a sessão só num 401, então um erro de configuração que virasse 401 deslogaria todo mundo. Toda recusa vai para o log com `[Auth] <status> <código> (<detalhe>) <método> <caminho>` e nunca com token, chave ou e-mail; ao criar um novo tipo de recusa, dê um `code` e um `detail`, e um teste em `tests/api/auth.test.ts`.

## Verificação da configuração

A configuração de que o app depende é verificada por `api/_config.ts` ao iniciar (log `[Config] …`), em `/api/health` (`?deep=1` consulta o Supabase), no CI (`scripts/check-bundle.mjs`: segredos de mentira não podem ir ao `dist/`) e depois de cada deploy de produção (`.github/workflows/post-deploy.yml` -> `scripts/check-deploy.mjs`). A resposta de `/api/health` é pública: só ids e níveis, nunca nomes de variáveis nem valores; os nomes vão só para o log. Ao criar uma variável de ambiente, declare-a em `.env.example` e em `DOCUMENTED_VARS` de `tests/config.test.ts` (o teste reprova variável não declarada); se algo depender dela, acrescente a verificação e a linha da tabela em [docs/masters/accounts-and-data.md](docs/masters/accounts-and-data.md).
