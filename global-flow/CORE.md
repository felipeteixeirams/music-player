# Fluxo de implementação (núcleo global)

Vale para todo projeto. As regras específicas de cada repositório ficam no `AGENTS.md` (ou `CLAUDE.md`) dele, ao lado deste bloco, e não o substituem.

Base: estudo dos frameworks Fabro, heliohq/ship e OpenHands, e o estudo arXiv 2611.05094 sobre fluxo com spec em portões. A lição que mais pesou: controle que é só instrução é seguido pelo mesmo modelo que executa a tarefa, e o estudo mediu que falha. Cada portão, por isso, tem um verificador fora do agente: o CI, um revisor com contexto limpo ou o usuário. Nenhum portão se declara sozinho.

## Âmbito

- **Fluxo completo:** mudança de comportamento, de contrato de API, de schema ou de dados; qualquer código que toque uma regra documentada. Na dúvida, completo.
- **Fluxo leve** (lint, testes e a razão escrita no PR): texto, documentação sem regra, estilo visual sem comportamento.

## Fases (cada uma gera um artefato e tem um portão)

1. **Spec.** Objetivo, critérios de aceite numerados (AC1, AC2…), regras que a mudança toca e a lista exata de arquivos a alterar. Artefato: seção "Fluxo de implementação" na descrição do PR. Portão: decisão de domínio vai ao usuário como pergunta, com contexto, alternativas e recomendação.
2. **Testes antes do código.** Um teste por AC. Rodar e registrar que os testes novos **falham** antes da mudança. Portão: falha registrada.
3. **Implementação.** Só nos arquivos da lista da spec. Arquivo fora da lista: parar e reportar. Commits pequenos.
4. **Verificação por ferramenta.** Lint, testes e CI verdes. O agente cita a saída ou o link da execução. "Passou" sem saída não vale. Portão: CI verde.
5. **Revisão independente.** Um subagente novo, com contexto limpo, recebe só a spec, o diff e um checklist fechado. Não recebe a conversa de implementação. Saída: achados com arquivo:linha em P1, P2 ou P3. Portão: zero P1 e zero P2. No máximo duas rodadas de correção; depois, parar e reportar. Re-revisar só a parte corrigida.
6. **Verificação humana.** Quando a mudança afeta experiência real (dispositivo, login, layout, dados do usuário), a descrição diz o que foi testado e o que não foi. Quem marca "testado" é o usuário. O agente nunca marca.
7. **Entrega.** PR só quando o usuário pedir. Depois de aberto, o CI é o portão: no máximo três tentativas de correção, depois parar e reportar.

## Regras de parada (sem exceção)

- Arquivo fora da spec.
- Teste anterior que falha sem explicação.
- Achado P1 na revisão.
- Resposta ambígua do usuário: não é aprovação.
- Pedido de apagar arquivo ou dado: confirmação explícita antes.
- Push direto para a branch padrão, ou push forçado: bloqueado (ver `hooks/`).
- Conflito com uma regra documentada do projeto.

Ao parar, registrar o motivo. Não reescrever o registro para parecer aprovado.

## Modelos por fase (recomendação)

- Spec e revisão: o modelo de maior capacidade.
- Implementação: o modelo intermediário.
- Tarefas mecânicas (texto de PR, datas, conferência de links): o modelo mais leve.
- O revisor, quando possível, não é o mesmo modelo que implementou.

## Quanto cada controle vale

| Controle | Quem verifica | Força |
| --- | --- | --- |
| Este texto | o próprio agente | fraca: só instrução |
| Checklist no template de PR | revisor humano | média |
| Revisão com contexto limpo | subagente separado | média, depende do checklist |
| Hook de push (`hooks/`) | ferramenta local, fora do agente | forte nas máquinas com o hook instalado |
| Workflow de portão (`ci/flow-gate.yml`) exigido no ruleset | GitHub | forte, quando exigido na branch padrão |

Sem o ruleset exigindo o portão de CI, o fluxo depende de disciplina. Não vender como garantia.
