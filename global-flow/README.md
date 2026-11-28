# Fluxo de implementação global

Pacote para aplicar o mesmo fluxo a todos os projetos. Está aqui, neste repositório, como fonte. Para valer em todos os projetos, ele precisa ser copiado para um repositório seu privado e instalado em cada máquina e no GitHub. Os passos abaixo são seus; nada disto roda sozinho.

## O que tem aqui

| Arquivo | Para quê | Onde vai |
| --- | --- | --- |
| `CORE.md` | Regras do fluxo, sem nada específico de projeto | Colado no início do `AGENTS.md` (ou `CLAUDE.md`) de cada projeto |
| `hooks/guard-push.py` | Bloqueia push para main/master e push forçado | `~/.claude/fluxo-global/guard-push.py` em cada máquina |
| `hooks/settings.snippet.json` | Ativa o hook acima | Mesclado no `~/.claude/settings.json` de cada máquina |
| `ci/flow-gate.yml` | Workflow reutilizável: reprova PR sem a seção do fluxo | Repositório privado do fluxo; cada projeto o chama |

## 1. Repositório privado do fluxo

1. Crie um repositório privado no GitHub (por exemplo, `fluxo-global`). Eu não consigo criar repositórios daqui.
2. Copie a pasta `global-flow/` para ele. Mantenha `ci/flow-gate.yml` em `.github/workflows/flow-gate.yml` nesse repositório, para ele poder ser chamado.
3. Na conta ou organização, ative o compartilhamento de workflows reutilizáveis com os seus repositórios, se o GitHub pedir.

## 2. Em cada máquina onde você usa Claude Code

```bash
mkdir -p ~/.claude/fluxo-global
cp global-flow/hooks/guard-push.py ~/.claude/fluxo-global/
```

Depois, mescle `global-flow/hooks/settings.snippet.json` em `~/.claude/settings.json`. Se o arquivo já tiver `hooks`, acrescente a entrada `PreToolUse` sem apagar as existentes.

Teste antes de confiar:

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"git push origin main"}}' | python3 ~/.claude/fluxo-global/guard-push.py
```

Deve imprimir um JSON com `"permissionDecision": "deny"`. Abra `/hooks` no Claude Code, ou reinicie a sessão, para o hook carregar.

Efeito de `"onFailure": "block"`: se o script quebrar ou não existir, todo `git push` é bloqueado. É intencional, porque um guarda que falha em silêncio não guarda nada. Se preferir o contrário, troque para `"continue"`.

## 3. Em cada projeto

1. Cole `CORE.md` no início do `AGENTS.md` (ou `CLAUDE.md`) do projeto, acima das regras específicas dele.
2. Crie `.github/workflows/flow.yml` no projeto:

```yaml
name: flow
on:
  pull_request:
    types: [opened, edited, synchronize, reopened]
jobs:
  gate:
    uses: felipeteixeirams/fluxo-global/.github/workflows/flow-gate.yml@main
```

3. Copie o checklist de `.github/pull_request_template.md` deste repositório, a seção "Fluxo de implementação".

Projetos criados a partir de um template de repositório herdam os itens 2 e 3 se o template já os tiver. Crie esse template depois de validar o fluxo em um projeto.

## 4. No GitHub (ação sua)

Em Settings > Rules > Rulesets, crie uma regra para a branch padrão com:
- **Require a pull request before merging**
- **Require status checks to pass**, exigindo o check do job `gate` (e o `checks` do CI de cada projeto)
- **Block force pushes**

Sem essa regra, o portão de CI apenas informa, e o fluxo fica dependendo de disciplina.

## Limites que você precisa saber

- **Sessões na nuvem** não leem a configuração da sua máquina. Nelas, vale só o que está no `AGENTS.md` do projeto e a regra do GitHub. Por isso o `CORE.md` precisa estar em cada projeto.
- **O número da revisão** (`P1 = 0, P2 = 0`) é digitado pelo autor. O portão garante que o campo foi preenchido; não prova que a revisão aconteceu. A revisão independente é o que dá o resultado real.
- **O hook só cobre `git push`**. Ele não impede `git commit` em branch errado nem apagar arquivos; isso fica com as regras de parada.
- **Teste de aparelho** continua sendo do usuário. Nenhuma ferramenta marca isso.
