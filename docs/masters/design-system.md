# Master: design system da interface

## Propósito e autoridade

Este é o master do domínio de interface visual: tokens, materiais translúcidos, tipografia, componentes e movimento. O ponto de entrada global continua sendo [a base documental](../README.md). A especificação ativa é [Design system: tokens, materiais e fases](../specs/current/design-system.spec.md); ela é a fonte detalhada. Se este resumo divergir dela, confira o código (`src/index.css` e os componentes) e atualize os documentos.

## Estado

**Status: direção definida; fundação (fase 1), barras (fase 2) listas, carrosséis, categorias, rádio e destaque da home (fase 3), e player aberto e janelas de cache e instalação (fase 4) implementadas em 2026-10-25. Faltam o modo claro (fase 5, se decidido) e os extras do iOS 26 (fase 6).**

## Direção

O app segue a linguagem visual do Apple Music: fundo preto, texto branco com níveis de cinza translúcido, um destaque único (vermelho `#fa243c`), materiais de vidro fosco nas barras flutuantes, capas com cantos arredondados e sombra, listas limpas com separador fino e sem cartões com contorno. Só reproduzimos padrões; logo, nome, ícones SF Symbols e a fonte SF Pro não são usados como arquivos (no iPhone a pilha `-apple-system` já renderiza a fonte do sistema).

## Código proprietário

- `src/index.css`: tokens (`@theme static`), materiais (`.material-ultrathin|thin|regular|thick`) e linhas finas (`.hairline-top|bottom`).
- `index.html`: sem fontes da web.
- Telas e componentes em `src/components/` e `src/App.tsx`: migrados conforme o satélite.
- `src/utils/coverColor.ts` e `src/hooks/useCoverColor.ts`: cor dominante da capa para o fundo do player aberto.

## Decisões a manter

1. Cor, transparência e raio vêm de tokens; telas novas não usam hex solto nem `white/NN` avulso.
2. Cada superfície translúcida usa um dos quatro materiais, nunca `backdrop-blur-*` isolado.
3. Toda superfície com material precisa de cor opaca de reserva, para não perder legibilidade onde `backdrop-filter` não existe.
4. Áreas seguras do iPhone continuam obrigatórias (ver `AGENTS.md`).

## Atualização deste master

Atualize ao mudar a direção visual, o conjunto de tokens ou o estado das fases. Detalhes e critérios pertencem ao satélite.
