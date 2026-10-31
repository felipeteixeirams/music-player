# Menu de Contexto do Artista e Álbum no Player Expandido

Implementação de uma folha de ações inferior (Action Sheet / Bottom Sheet) no estilo nativo iOS / Apple Music acionada ao tocar no nome do artista no player expandido, fornecendo atalhos rápidos para navegar até a página do artista ou até o álbum da faixa em reprodução.

## Revisão do Usuário e Decisões Críticas

> [!IMPORTANT]
> **Decisões confirmadas com o usuário**:
> 1. **Apresentação Visual**: Folha inferior deslizante (*Bottom Sheet*) no estilo iOS com cantos arredondados (`rounded-t-3xl`), desfoque de fundo (*backdrop-blur*), barra de arraste (*grab handle*) e linhas de toque amplas e ergonômicas.
> 2. **Comportamento de Navegação**: Ao selecionar o atalho do Artista ou do Álbum, o player expandido é minimizado automaticamente (`toggleExpanded(false)`), e a aplicação navega diretamente para a tela de destino correspondente.

---

## 1. Visão Geral e Conceito

- **O que faz**: Permite ao usuário, durante a reprodução no player expandido, tocar diretamente sobre o nome do artista para abrir um menu elegante com duas opções contextuais:
  - **Ver Artista**: Atalho com foto/ícone do artista, nome e subtítulo "Artista", levando à sua página completa com discografia e faixas populares.
  - **Ver Álbum**: Atalho com capa do álbum, título e subtítulo "Álbum", levando diretamente à tela do álbum recém-redesenhada.
- **Público e Valor**: Usuários que estão ouvindo uma música e querem explorar mais obras do mesmo artista ou ouvir o álbum completo imediatamente, sem precisar fechar o player e pesquisar manualmente.

---

## 2. Experiência do Usuário e Design Visual

### Fluxo de Interação
1. No player expandido (`ExpandedPlayer`), o nome do artista exibe um cursor interativo e feedback de toque sutil (`active:opacity-60`).
2. Ao tocar no nome do artista:
   - A folha inferior desliza suavemente a partir da base com animação fluida e desfoque escuro no fundo (`bg-black/50 backdrop-blur-sm`).
   - A folha apresenta um puxador de arraste central (*drag handle*), seguido pelas duas linhas de ação:
     - **Linha do Artista**: Avatar circular, nome do artista em destaque, subtítulo "Artista" e chevron indicador de navegação.
     - **Linha do Álbum**: Capa do álbum quadrada com cantos arredondados (`rounded-lg`), nome do álbum, subtítulo "Álbum" e chevron indicador.
   - Um botão de fechar ou o toque no fundo escuro descarta a folha.
3. Ao tocar em uma das opções:
   - A folha se fecha, o player expandido recolhe para o mini player na barra inferior sem interromper o áudio, e a tela do artista ou do álbum abre imediatamente na visualização principal.

### Estilo e Alinhamento com o Design System (Apple Music)
- **Superfície**: `material-regular` com desfoque e borda sutil de separador (`border-t border-separator/40`).
- **Ergonomia e Área de Toque**: Linhas com altura mínima de 60px para toque seguro com uma mão.
- **Compatibilidade com iPhones e PWAs**: Espaçamento inferior respeita a barra de início (`var(--safe-bottom)`).

---

## 3. Decisões de Produto e Arquitetura

### Decisão 1: Resolução Direta e Fallback Inteligente de Artista/Álbum
- **Abordagem**:
  - Para o artista: Se o ID já for conhecido ou ao buscar pelo nome via `fetchArtistSearch(track.artist)`, navega instantaneamente para a página do artista.
  - Para o álbum: Se `track.album` for informado (e não for genérico como "Single"), localiza o álbum via busca rápida e abre o `AlbumScreen`. Se não houver álbum separado, oferece a navegação pelo catálogo do artista.
- **Por quê**: Garante que qualquer música (mesmo vindas de rádios ou mixes automáticos) consiga abrir o artista e álbum correspondentes com consistência.

### Decisão 2: Minimização Suave sem Corte de Áudio
- **Abordagem**: O clique chama `toggleExpanded(false)` antes da troca de rota/tela, permitindo que a navegação ocorra de forma contínua enquanto o áudio permanece tocando.

---

## 4. Arquitetura Técnica e Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────┐
│                    ExpandedPlayer                           │
│                                                             │
│                 [ Capa do Álbum ]                           │
│                                                             │
│                 Título da Música                            │
│                 Nome do Artista  ───[ Toque ]───┐           │
│                                                 │           │
└─────────────────────────────────────────────────┼───────────┘
                                                  │
┌─────────────────────────────────────────────────▼───────────┐
│              ArtistAlbumActionSheet (iOS Style)             │
│                       ── grab handle ──                     │
│                                                             │
│   (Avatar)   Nome do Artista                     ›          │
│              Artista                                        │
│                                                             │
│   [ Capa ]   Nome do Álbum                       ›          │
│              Álbum                                          │
│                                                             │
│   [                     Fechar                    ]         │
└───────────────────────┬─────────────────────────────────────┘
                        │ Ao tocar em uma opção:
                        │ 1. toggleExpanded(false)
                        │ 2. onNavigateToArtist() ou onNavigateToAlbum()
                        ▼
┌─────────────────────────────────────────────────────────────┐
│             ArtistScreen / AlbumScreen                      │
│            (Com o áudio tocando continuamente)              │
└─────────────────────────────────────────────────────────────┘
```

### Arquivos Impactados:
1. `src/components/ArtistAlbumActionSheet.tsx`:
   - Novo componente de folha inferior modal no estilo Apple Music com atalhos para Artista e Álbum.
2. `src/components/ExpandedPlayer.tsx`:
   - Conectar o clique no nome do artista para abrir a nova folha de ações.
   - Aceitar callbacks de navegação `onNavigateToArtist` e `onNavigateToAlbum`.
3. `src/App.tsx`:
   - Passar as funções de navegação para `<ExpandedPlayer />` para que ele possa abrir diretamente o artista e o álbum selecionados.

---

## Plano de Verificação

1. **Compilação e Linter**: Executar `npm run lint` e `compile_applet` para garantir TypeScript rigoroso e sem erros.
2. **Testes Unitários**: Rodar `npm test` para assegurar que nenhum contrato foi quebrado.
3. **Validação Visual e Funcional**:
   - Abrir o player expandido com uma música tocando.
   - Tocar no nome do artista e conferir a abertura da folha inferior com capa e avatar.
   - Testar o atalho "Artista" e validar que o player recolhe e abre a tela do artista.
   - Testar o atalho "Álbum" e validar que o player recolhe e abre o álbum correspondente.
   - Testar fechar a folha sem selecionar opção (toque no fundo escuro ou botão Fechar).
