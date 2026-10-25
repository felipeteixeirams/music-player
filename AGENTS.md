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

Todo arquivo `.ts` em `api/` cujo nome não começa com `_` vira uma função serverless, e o plano Hobby aceita no máximo 12 por deploy; passar disso faz o deploy falhar. Por isso `api/` guarda só endpoints (hoje 8: `audio`, `category`, `feed`, `health`, `radio`, `resolve`, `search` e `streams/[id]`), helpers levam o prefixo `_` e os testes ficam em `tests/` (os de `api/` em `tests/api/`). `tests/vercel-functions.test.ts` falha se um teste entrar em `api/` ou se o total passar de 12. Antes de criar um endpoint novo, avalie se ele cabe em uma rota existente.

## Interface em PWA no iPhone

O app roda em tela cheia (`viewport-fit=cover` e barra de status `black-translucent`), então o conteúdo chega até o recorte e o indicador de início do iPhone. Barras fixas ou fixadas ao topo e à base somam `var(--safe-top)` e `var(--safe-bottom)` (definidas em `src/index.css` a partir de `env(safe-area-inset-*)`, valendo 0 onde não há recorte) ao próprio espaçamento: o cabeçalho, a navegação inferior, o mini player (acima da navegação, que tem 4,25rem mais a área segura), o aviso offline e o aviso de download. Ao criar um elemento `fixed` ou `sticky` encostado em uma borda da tela, faça o mesmo. Para testar sem o aparelho, sobrescreva as variáveis no navegador (iPhone 11: 48px no topo e 34px na base).

## Atualização do app e compatibilidade da API

Um deploy novo não reinicia as sessões abertas: um PWA aberto (no iPhone costuma voltar do segundo plano sem recarregar) segue com o código antigo até recarregar. Por isso:

- Mudanças nas respostas de `api/` devem ser compatíveis com o cliente anterior: acrescente campos, não renomeie nem remova. Para quebrar um contrato, publique primeiro uma versão que aceite os dois formatos e só depois remova o antigo.
- `vite.config.ts` grava `version.json` no build e define `__APP_VERSION__`. `UpdateBanner` compara os dois quando o app volta ao primeiro plano (e a cada 10 minutos) e oferece "Atualizar"; nunca recarrega sozinho para não cortar a música. `public/sw.js` não intercepta `/version.json`.
- `vercel.json` responde 200 com HTML para qualquer arquivo inexistente. Um chunk com hash de um deploy anterior não dá 404: o navegador recebe HTML no lugar de JavaScript. `preloadYouTubePlayer` baixa o chunk do player no início da sessão por isso; ao criar outro `import()` dinâmico necessário para tocar, faça o mesmo.

