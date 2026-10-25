# Base documental

Este arquivo é o **único ponto de entrada** da documentação do repositório para agentes. Comece aqui, selecione o master relacionado à tarefa e siga os links dele até os satélites necessários. Não trate a busca textual por arquivos em `docs/` como substituta desta navegação.

## Hierarquia

```text
docs/README.md (root: entrada única)
  -> docs/masters/*.md (visão consolidada por domínio)
       -> docs/specs/current/*.md (especificações ativas e granulares)
       -> docs/specs/archive/*.md (decisões e especificações substituídas, se houver)
```

- **Root**: este arquivo. Mantém o mapa da documentação, as regras de navegação e o estado de cada master. Deve continuar sendo a única página de entrada geral dentro de `docs/`.
- **Master**: documento de domínio em `docs/masters/`. Explica contexto, componentes envolvidos, contratos atuais, decisões e links para os satélites do domínio. Não duplica especificações detalhadas.
- **Satélite**: documento específico em `docs/specs/current/` enquanto estiver vigente. Registra requisitos, plano, decisões e critérios verificáveis. Especificações substituídas podem ser movidas para `docs/specs/archive/` com o master atualizado.

Masters e satélites são documentos navegáveis por links, não pontos de entrada globais. Um agente deve chegar até eles por este root e pelo master aplicável.

## Como navegar

1. Identifique o domínio da tarefa nesta lista de masters.
2. Leia o master inteiro para entender o estado e os limites do domínio.
3. Abra os satélites indicados pelo master. Para implementação, leia todos os satélites ativos que definem o comportamento tocado.
4. Confira o código real e o estado do workspace antes de agir; a documentação orienta, mas não substitui validação no código.
5. Se a tarefa não tiver master, use o código e as instruções do repositório, e proponha/adote um novo master somente quando houver um domínio documental coerente. Não crie um índice concorrente.

## Masters

| Domínio | Master | Satélites ativos | Estado |
| --- | --- | --- | --- |
| Integrações musicais e reprodução | [Integrações musicais](masters/music-integrations.md) | [Contratos, mappers e testes](specs/current/music-integration-contracts.spec.md) | Busca (Deezer + reserva iTunes), coleções fiéis e paginadas, prévia e faixa completa via YouTube (2026-10-25); pendentes: reserva do feed e remoção do código Piped. |

## Regras de manutenção

- Todo novo domínio documental deve ser registrado neste root e possuir um master em `docs/masters/` antes de ganhar satélites, salvo uma exceção temporária explicitamente justificada.
- Todo satélite ativo deve ser ligado pelo master do seu domínio; todo master deve ser ligado por este root.
- Manter links relativos e verificar destinos ao mover documentos.
- Ao substituir um satélite, não apagar o contexto histórico: atualizar o master e arquivar o documento antigo em `docs/specs/archive/` quando apropriado.
- Não criar outro `README.md`, `index.md`, catálogo ou arquivo de navegação geral sob `docs/`. Páginas de master/satélite podem ter títulos e sumários locais, mas não devem se apresentar como entrada geral.
- Evitar copiar o mesmo requisito em várias camadas. O root indexa, o master sintetiza e direciona, e o satélite detalha e define critérios de aceite.
- `AGENTS.md` na raiz explica aos agentes que esta hierarquia existe e deve ser seguida; as instruções detalhadas da base permanecem aqui.
