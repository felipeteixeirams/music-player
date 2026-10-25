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
