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
