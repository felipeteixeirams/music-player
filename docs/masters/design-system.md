# Master: design system da interface

## Propósito e autoridade

Este é o master do domínio de interface visual: tokens, materiais translúcidos, tipografia, componentes e movimento. O ponto de entrada global continua sendo [a base documental](../README.md). A especificação ativa é [Design system: tokens, materiais e fases](../specs/current/design-system.spec.md); ela é a fonte detalhada. Se este resumo divergir dela, confira o código (`src/index.css` e os componentes) e atualize os documentos.

## Estado

**Status: direção definida; fundação (fase 1), barras (fase 2) listas, carrosséis, categorias, rádio e destaque da home (fase 3), e player aberto e janelas de cache e instalação (fase 4) implementadas em 2026-10-25. O modo claro (fase 5) e os extras do iOS 26 (fase 6: barra de abas que recolhe e deslizar o mini player) foram implementados no mesmo dia; as fases 1 a 6 estão completas. A fase 7 (paridade de estrutura com o Apple Music, ver o satélite) está em andamento: título grande por aba, tela Buscar com grade de coleções e menu de ajustes, barra de abas em cápsula com mini player em pílula, Rádio em grade com arte e Biblioteca como menu de seções estão feitos; a fase 7 está completa.**

## Direção

O app segue a linguagem visual do Apple Music: fundo preto, texto branco com níveis de cinza translúcido, um destaque único (vermelho `#fa243c`), materiais de vidro fosco nas barras flutuantes, capas com cantos arredondados e sombra, listas limpas com separador fino e sem cartões com contorno. Só reproduzimos padrões; logo, nome, ícones SF Symbols e a fonte SF Pro não são usados como arquivos (no iPhone a pilha `-apple-system` já renderiza a fonte do sistema).

## Código proprietário

- `src/index.css`: tokens (`@theme static`), materiais (`.material-ultrathin|thin|regular|thick`) e linhas finas (`.hairline-top|bottom`).
- `index.html`: sem fontes da web.
- Telas e componentes em `src/components/` e `src/App.tsx`: migrados conforme o satélite.
- `src/components/StationTile.tsx`, `src/utils/stationArt.ts`, `src/components/LibraryScreen.tsx` e `src/utils/library.ts`: a Rádio em grade e a Biblioteca em seções.
- `src/utils/scrollChrome.ts` e `src/hooks/useScrollChrome.ts`: regras de recolher a barra de abas e de deslizar o mini player.
- `src/utils/coverColor.ts` e `src/hooks/useCoverColor.ts`: cor dominante da capa para o fundo do player aberto.

## Decisões a manter

1. Cor, transparência e raio vêm de tokens (as cores são redefinidas por esquema nas variáveis `--color-*` de `src/index.css`, nunca por variável intermediária, e `.theme-dark` força o escuro numa área); telas novas não usam hex solto nem `white/NN` avulso.
2. Cada superfície translúcida usa um dos quatro materiais, nunca `backdrop-blur-*` isolado.
3. Toda superfície com material precisa de cor opaca de reserva, para não perder legibilidade onde `backdrop-filter` não existe.
4. Áreas seguras do iPhone continuam obrigatórias (ver `AGENTS.md`).
5. A tela de login (`LoginScreen`) usa `theme-dark`, material e tokens como as demais, com um fundo de fumaça em WebGL (`SmokeyBackground`) na cor de destaque. O fundo para com o componente, limita-se a 30 quadros por segundo em baixa resolução, desenha um quadro parado sob "reduzir movimento" e, sem WebGL, fica só o brilho em CSS. Não o reutilize em telas de uso contínuo: é um fundo de tela de entrada.
- **INV-UI-02:** o app não oferece download de faixa: sem botão nas listas e sem a seção "Downloads" na Biblioteca. O áudio completo vem do player do YouTube, que não entrega arquivo (e baixá-lo fere os termos); a única coisa que o botão guardava era a prévia de 30 s, o que enganava. O caminho para offline de verdade seria arquivos de áudio próprios do usuário (ver o registro de decisões de fontes de áudio).
- **INV-UI-03:** o que a função antiga deixou no aparelho (o áudio guardado e as listas de downloads de todas as pessoas do aparelho) é removido uma vez, ao abrir o app (`purgeLegacyDownloads`); favoritos, playlists e histórico não são tocados.

## Invariantes da interface (não quebre)

- **INV-UI-01:** carrosséis e listas não mostram o total de faixas (o "100 faixas" era o tamanho da playlist do catálogo, sem sentido para quem ouve); só o que está carregado é mostrado, e o resto chega pela rolagem.
- **INV-UI-04:** Ajustes > Aparência (Automático, Claro, Escuro) é escolha do aparelho (`aurastream_appearance` em `localStorage`, `src/utils/appearance.ts`). Automático segue o sistema só no navegador (no app instalado fica escuro); Claro e Escuro valem em qualquer modo. A classe `scheme-light` em `<html>` é aplicada antes da primeira pintura (script em `index.html`). No app instalado em Claro, a faixa sobre a barra de status (`.status-strip`) fica preta, pois o iOS fixa o texto dela em branco (hipótese: conferir no aparelho).

## Atualização deste master

Atualize ao mudar a direção visual, o conjunto de tokens ou o estado das fases. Detalhes e critérios pertencem ao satélite.
