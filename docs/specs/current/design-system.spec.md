# Design system: tokens, materiais e fases

Satélite do master [Design system da interface](../../masters/design-system.md). Define o que é "igual ao Apple Music" para este app e em que ordem migrar as telas.

## Decisões de 2026-10-25

Tomadas com o padrão recomendado, pois o usuário pediu para estabelecer o design sem responder as três perguntas do discovery. Troque aqui se for outra a escolha.

| Decisão | Escolha | Alternativa |
| --- | --- | --- |
| Destaque | Vermelho `#fa243c` (substitui roxo e rosa) | Manter cor própria |
| Referência de material | Vidro fosco (blur com saturação) no estilo iOS 18; Liquid Glass fica para a fase 6 | Liquid Glass desde já |
| Tema | Escuro; claro implementado na fase 5 (segue o sistema, só no navegador) e chave manual em Ajustes | Validar o claro no app instalado |

## Tokens (implementados em `src/index.css`)

| Grupo | Token | Valor | Uso |
| --- | --- | --- | --- |
| Destaque | `accent`, `accent-pressed` | `#fa243c`, `#d91c32` | Aba ativa, botão principal, progresso |
| Fundo | `canvas`, `elevated`, `elevated-2` | `#000`, `#1c1c1e`, `#2c2c2e` | Tela, cartões e folhas, camada acima |
| Texto | `label`, `label-secondary`, `label-tertiary` | branco, 60%, 30% | Título, subtítulo, dica |
| Linha | `separator` | `rgb(84 84 88 / .5)` | Separador de lista e barras (0,5 px) |
| Preenchimento | `fill`, `fill-secondary`, `fill-tertiary` | cinza translúcido 36%, 32%, 24% | Botões e chips sem destaque |
| Raio | `radius-cover`, `radius-card`, `radius-sheet` | 8, 12, 20 px | Capas, cartões, folhas |
| Fonte | `font-sans`, `font-mono` | pilha do sistema | Todo o app; mono só para tempos |

Uso: `bg-accent`, `text-label-secondary`, `rounded-cover` etc.

## Materiais

| Material | Blur | Cor sobreposta | Onde |
| --- | --- | --- | --- |
| `material-ultrathin` | 12 px | `#1c1c1e` a 45% | Botões sobre capa, chips flutuantes |
| `material-thin` | 20 px | `#1c1c1e` a 60% | Mini player |
| `material-regular` | 30 px | `#1c1c1e` a 72% | Cabeçalho |
| `material-thick` | 40 px | `#1c1c1e` a 85% | Barra de abas |

Todos com `saturate(180%)`. Os valores são aproximações do sistema, não medidas da Apple: calibrar lado a lado num iPhone. Sem suporte a `backdrop-filter`, a cor sobe para 94% de opacidade. A refração real do Liquid Glass não existe no Safari; só dá para aproximar com brilho de borda.

## Tipografia

Títulos grandes 34/700 que encolhem ao rolar, seção 22/700, linha 17/400 com subtítulo 15 em `label-secondary`, rodapé 13, legenda 11-12. Tempos com `tabular-nums`.

## Componentes alvo

- **Cabeçalho:** `material-regular` e `hairline-bottom`, título grande que vira título pequeno ao rolar.
- **Barra de abas:** cápsula de `material-regular`, pílula `fill` atrás da aba ativa em `accent`, rótulos de 10 pt.
- **Mini player:** pílula flutuante acima da barra (`material-regular`, totalmente arredondada, 3,5 rem), capa redonda de 44 px, título e artista, tocar/pausar e avançar; sem barra de progresso.
- **Listas:** capa 56 px (`radius-cover`), título e subtítulo, duração à direita, separador recuado de 76 px; sem cartão com contorno.
- **Carrosséis e grade:** capas quadradas com `radius-cover` e sombra, título 15 e artista 13.
- **Player aberto:** fundo em gradiente com a cor dominante da capa, capa grande que diminui ao pausar, controles brancos grandes, progresso fino.

## Paridade de estrutura com o Apple Music (fase 7, a partir de 2026-10-25)

Comparação com capturas do Apple Music (iOS 26) no iPhone 11 mostrou que a diferença restante é de estrutura. Decisões aprovadas: os filtros de coleção saem do topo e a navegação por coleção vai para a aba Buscar; cache e instalação vão para um botão de ajustes no canto do título; o nome AuraStream deixa de aparecer no topo. Passos, um PR cada:

1. **Cabeçalho com título grande e tela Buscar** (feito): título de 34/700 por aba ("Início", "Rádio", "Biblioteca", "Buscar"; numa coleção, o nome dela com "‹ aba de origem" acima), botão de ajustes (`SettingsMenu`: cache local e instalar o app), faixa fixa de `material-regular` só sobre a barra de status. Na aba Buscar o campo é uma pílula sempre visível, com o seletor "Músicas online" / "Já carregadas", e, sem texto digitado, a grade "Explorar tudo" (`CategoryTiles`: Rádio e as coleções (14), com a capa da primeira faixa em duotone sobre a cor do bloco). Saem a barra de marca, os filtros (chips) e a "Explorar Categorias" da home; o modelo de navegação é só aba mais coleção aberta.
2. **Barra de abas em cápsula e mini player em pílula** (feito em 2026-10-25): a barra é uma cápsula flutuante de `material-regular` (16 px de margem lateral, 0,5 rem acima da área segura, 4 rem de altura) com uma pílula `fill` atrás da aba ativa, ícone preenchido e rótulo em vermelho; o mini player é uma pílula de 3,5 rem solta acima dela, sem barra de progresso (o progresso fica no player aberto). Ao rolar para baixo a cápsula encolhe (3,5 rem, só ícones) e, com música tocando, vira uma linha única: círculo da aba atual (toque mostra a navegação), mini player e círculo da busca. `BottomNavBar` recebe o mini player e o aviso de reprodução e é dono do contêiner fixo. A pílula atrás da aba ativa é um único elemento que desliza até a aba escolhida (`translateX` de múltiplos da própria largura, pois as 4 colunas são iguais) em 450 ms com a curva `cubic-bezier(0.3, 1.25, 0.5, 1)`, que passa cerca de 3 px do destino e assenta, como a seleção do Apple Music; o ícone e o rótulo trocam de cor e o ícone cresce 10% em 300 ms. Com "reduzir movimento" ligado no sistema a pílula muda de lugar sem animar (verificado: 27 px, 78, 154, 194, 210, 208, 207 ao longo de 700 ms; com reduzir movimento, 207 desde o primeiro quadro).
3. **Rádio, Biblioteca e acabamentos** (feito em 2026-10-25): a Rádio é uma grade de 3 colunas de quadrados (`StationTile`, raio de 20 px): as estações de mix com a imagem do Deezer e as ao vivo, que não têm logo, com as iniciais (`stationInitials`, que ignora frequências como "102.9") sobre uma cor fixa por estação (`stationColor`); a tocando ganha anel vermelho e a etiqueta TOCANDO. A Biblioteca é um menu de seções (`LibraryScreen`): Músicas favoritas, Downloads, Artistas e Álbuns (os dois últimos agrupam os favoritos, `src/utils/library.ts`), com título grande e "‹" para voltar; tocar na aba Biblioteca de novo volta ao menu. Os downloads passaram a guardar os metadados da faixa (`aurastream_offline_track_meta`) para a tela Downloads; os feitos antes só aparecem se a faixa estiver nos favoritos. Os raios `radius-cover` e `radius-card` subiram para 10 e 14 px, e a aba ativa já tinha ícone preenchido (passo 2).

Fora do alcance: ícones SF Symbols, artes e fotos do Apple Music e a refração do Liquid Glass.

## Calibragem com medidas do Apple Music (2026-10-25)

Medida em capturas do Apple Music (iOS 26, tema escuro, iPhone 11, 828×1792 px) e conferida no nosso app com as mesmas dimensões:

| Item | Apple Music | AuraStream depois da calibragem |
| --- | --- | --- |
| Fundo | `#000000` | `#000000` |
| Separador de linhas | `#2a2a2b` | `#2a2a2c` (`rgb(84 84 88 / .5)` sobre o preto) |
| Destaque (tema escuro) | `#e6434e` nos ícones, `#eb4854` na aba ativa | `#eb4854` (tema claro: `#fa233b`) |
| Vidro da cápsula e do mini player sobre o preto | `#202020` | `#202021` (cinza neutro `64 64 66` com 50% de opacidade no material regular) |
| Pílula da aba ativa (escura, abaixo do vidro) | `#0a0a0a` | `#0b0b0b` (`--color-tab-active`, preto a 65%; no claro, preto a 7%) |
| Cápsula | 62 pt de altura, 21 pt de margem lateral, 21 pt da borda de baixo | 62 pt, 21 px, 21 px (`max(0.5rem, safe-bottom - 0.8rem)`) |
| Mini player | 48 pt de altura, 8 pt de espaço até a cápsula | 48 px, 8 px |
| Blocos da Rádio | raio de 17,5 pt | `--radius-tile` de 17,5 px |
| Blocos da Buscar | raio de 13,5 pt | `--radius-card` de 14 px |
| Texto das linhas da Biblioteca | cerca de 17 pt | 17 px |

As opacidades dos quatro materiais (`--ma-ultrathin|thin|regular|thick`) são 0,32, 0,42, 0,50 e 0,60 no escuro e 0,45, 0,60, 0,72 e 0,85 no claro. O desfoque, a saturação e o brilho de borda do Liquid Glass não saem de uma captura plana e seguem como aproximação: ajustar olhando o vidro sobre conteúdo colorido no aparelho.

## Fases (um PR por fase)

1. **Fundação** (feito): tokens, materiais, fonte do sistema.
2. **Barras** (feito em 2026-10-25): cabeçalho, filtros e busca, botão de instalar, abas, mini player (sem capa girando, controles de 44 px, progresso fino na base) e aviso de nova versão.
3. **Listas, carrosséis, categorias, rádio e destaque da home** (feito em 2026-10-25): linhas de 56 px sem cartão, com separador recuado e só título e artista; capas com `radius-cover`, sem borda e com sombra; cartões em `elevated`; faixa em reprodução em vermelho; títulos de seção em 22/700. Erros e avisos mantêm as cores semânticas (rosa e âmbar).
4. **Player aberto e janelas** (feito em 2026-10-25): fundo em gradiente com a cor dominante da capa (`useCoverColor`: amostra a capa num `canvas` de 24 px, escurece para manter o texto branco legível e cai para um cinza neutro se a capa não permitir leitura por CORS); capa com `radius-card` que encolhe a 86% ao pausar; progresso e volume brancos e finos; controles sem círculo colorido; janelas de cache e instalação em `material-thick`. O visualizador deixou de se chamar "Espectrograma Web Audio API / LIVE STREAMING": é uma animação decorativa e o texto diz isso.
5. **Modo claro** (feito em 2026-10-25): os tokens de cor valem para os dois esquemas (valores do iOS: fundo branco, `#f2f2f7` nos cartões, texto preto com níveis translúcidos, materiais claros). Segue o sistema e vale só no navegador: no app instalado (`display-mode: standalone`) fica sempre escuro, porque a barra de status do iPhone nesse modo tem texto branco fixo (`black-translucent`) e ficaria ilegível sobre um cabeçalho claro (não verificado no aparelho). O player aberto usa `.theme-dark` e é escuro nos dois esquemas. Há chave manual em Ajustes > Aparência (Automático/Claro/Escuro, INV-UI-04); em Claro no app instalado a faixa sobre a barra de status fica preta (não verificado no aparelho). Erros e avisos mantêm cores semânticas (rosa e âmbar).
6. **Extras do iOS 26** (feito em 2026-10-25): a barra de abas recolhe para só os ícones (4,25 rem para 3 rem, mais a área segura) ao rolar a página para baixo e volta ao rolar para cima, ao chegar perto do topo (até 48 px) ou ao tocar numa aba; o mini player acompanha a altura. Arrastar o mini player para a esquerda avança e para a direita volta (mínimo de 60 px, mais horizontal que vertical); numa rádio ao vivo não há nenhum dos dois e numa estação de mix só há o avanço. A lógica pura está em `src/utils/scrollChrome.ts` (`nextCompact`, `swipeAction`) e o efeito em `src/hooks/useScrollChrome.ts`. A Liquid Glass de verdade (refração) segue fora: o Safari não a suporta.
7. **Aparência por escolha** (feito em 2026-10-28, PR #70): Ajustes > Aparência (Automático, Claro, Escuro), `INV-UI-04`. Falta validar o claro no app instalado (T16).
8. **Home dinâmica** (feito em 2026-10-28, PR #71): 14 coleções, prateleira "Tocadas recentemente" e feed com 30 min de cache, `INV-UI-05` (T17).
9. **Artistas e álbuns** (feito em 2026-10-28, PRs #72 e #73): artistas na busca, página do artista (mais tocadas, álbuns, semelhantes) e página do álbum, `INV-UI-06` (T18).

## Critérios de aceite

- Nenhuma tela migrada usa hex solto, `white/NN` avulso, `purple-*`, `pink-*` ou `backdrop-blur-*` isolado.
- Áreas seguras do iPhone 11 simuladas (48 px no topo, 34 px na base) sem sobreposição.
- Captura de tela do Chromium antes e depois de cada fase. A aprovação visual final é feita no aparelho: o Chromium sem cabeça não mostra o blur com fidelidade.
