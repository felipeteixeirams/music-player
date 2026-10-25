# Design system: tokens, materiais e fases

Satélite do master [Design system da interface](../../masters/design-system.md). Define o que é "igual ao Apple Music" para este app e em que ordem migrar as telas.

## Decisões de 2026-10-25

Tomadas com o padrão recomendado, pois o usuário pediu para estabelecer o design sem responder as três perguntas do discovery. Troque aqui se for outra a escolha.

| Decisão | Escolha | Alternativa |
| --- | --- | --- |
| Destaque | Vermelho `#fa243c` (substitui roxo e rosa) | Manter cor própria |
| Referência de material | Vidro fosco (blur com saturação) no estilo iOS 18; Liquid Glass fica para a fase 6 | Liquid Glass desde já |
| Tema | Escuro agora; tokens nomeados por função para aceitar o claro depois | Claro e escuro já |

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
- **Barra de abas:** `material-thick` e `hairline-top`, aba ativa em `accent`, rótulos de 10 pt.
- **Mini player:** flutuante acima da barra, `material-thin`, raio 12 px (`radius-card`), capa de 44 px com raio 6 px, sem borda; barra de progresso fina.
- **Listas:** capa 56 px (`radius-cover`), título e subtítulo, duração à direita, separador recuado de 76 px; sem cartão com contorno.
- **Carrosséis e grade:** capas quadradas com `radius-cover` e sombra, título 15 e artista 13.
- **Player aberto:** fundo em gradiente com a cor dominante da capa, capa grande que diminui ao pausar, controles brancos grandes, progresso fino.

## Fases (um PR por fase)

1. **Fundação** (feito): tokens, materiais, fonte do sistema.
2. **Barras** (feito em 2026-10-25): cabeçalho, filtros e busca, botão de instalar, abas, mini player (sem capa girando, controles de 44 px, progresso fino na base) e aviso de nova versão.
3. **Listas, carrosséis, categorias, rádio e destaque da home** (feito em 2026-10-25): linhas de 56 px sem cartão, com separador recuado e só título e artista; capas com `radius-cover`, sem borda e com sombra; cartões em `elevated`; faixa em reprodução em vermelho; títulos de seção em 22/700. Erros e avisos mantêm as cores semânticas (rosa e âmbar).
4. Player aberto com gradiente da capa (extrair a cor num `canvas`; as capas do Deezer podem exigir CORS, com cor neutra de reserva).
5. Modo claro, se decidido.
6. Extras do iOS 26: barra de abas que encolhe ao rolar e deslizar o mini player para trocar de faixa.

## Critérios de aceite

- Nenhuma tela migrada usa hex solto, `white/NN` avulso, `purple-*`, `pink-*` ou `backdrop-blur-*` isolado.
- Áreas seguras do iPhone 11 simuladas (48 px no topo, 34 px na base) sem sobreposição.
- Captura de tela do Chromium antes e depois de cada fase. A aprovação visual final é feita no aparelho: o Chromium sem cabeça não mostra o blur com fidelidade.
