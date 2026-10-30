# Descoberta de funcionalidades

Pesquisa de 2026-10-29 e 2026-10-30, a pedido do usuário: que funcionalidades de um player de música em streaming o app poderia ter para melhorar desempenho, disponibilidade, uso offline, experiência e novidades, dadas as restrições reais do projeto. Este documento é do master [Integrações musicais](../../masters/music-integrations.md) e **não decide nada sozinho**: lista ideias com a evidência de cada uma, e as decisões entram no registro no fim, com data.

## Como ler a evidência

| Marca | Significa |
| --- | --- |
| ✅ medido | Chamado ou verificado por mim em 2026-10-29/30, do ambiente de desenvolvimento (cloud, sai por um proxy). Pode diferir da rede do usuário. |
| 🔎 código | Conferido no repositório (busca no código, build). |
| 📖 fonte | Lido em uma página (link na seção "Fontes"). Quando a fonte é de 2019 a 2023, vale conferir se ainda é verdade. |
| 💭 hipótese | Suposição ou memória, sem prova. Precisa de teste no aparelho antes de virar decisão. |

## Restrições estruturais (o que molda tudo)

- **A faixa completa vem do player oculto do YouTube** (iframe). Ele não permite crossfade, sem pausa entre faixas, equalizador, escolha de qualidade nem download (ver [Fontes de áudio e decisões](audio-sources-decisions.spec.md)). O que depende disso fica fora de qualquer ideia abaixo.
- **O app instalado no iPhone (PWA) não toca o YouTube com a tela bloqueada**; o áudio nativo (rádios, podcasts, prévias) toca. 📖 Relatos de 2019 a 2021 dizem ainda que o JavaScript de uma página em segundo plano no iOS pode parar de rodar, a ponto de um `onended` não disparar com a tela bloqueada ([WebKit 198277](https://bugs.webkit.org/show_bug.cgi?id=198277), [relato no DEV](https://dev.to/prototyp/what-we-learned-about-pwas-and-audio-playback-50eh)). 💭 Se isso ainda vale, afeta timer de soneca e "próximo episódio sozinho" com a tela bloqueada. Precisa de teste (T28 passo 7).
- **Vercel Hobby:** 9 de 12 funções usadas 🔎; cron só uma vez por dia, com precisão de até uma hora 📖 ([Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing), página de janeiro de 2026; versões antigas diziam 2 crons por conta). Banda de 100 GB por mês é dado de terceiro, a conferir.
- **A cota do YouTube** (100 buscas por dia no projeto) continua sendo o gargalo de qualquer ideia que precise de vídeo novo.
- **App fechado por convite**, 3 a 5 pessoas: nada que exija escala ou moderação.

## O que o app já tem (não repetir)

🔎 Favoritos, playlists e fila reordenável com sincronização por conta; letras sincronizadas (lrclib); histórico e mixes personalizados; rádios (ao vivo e por gênero); podcasts com busca, retomar, velocidade e seguir; painel de administrador; capas pelo proxy; "Não é esta música"; início do app offline com a última cópia salva; cache local gerenciável.

**Confirmado ausente** (busca no código em 2026-10-30): tocar a seguir / adicionar à fila, timer de soneca, compartilhar (`navigator.share`), sugestões ao digitar, wake lock, equalizador, crossfade.

## Catálogo de ideias

Valor e esforço são estimativas minhas (A alto, M médio, B baixo).

| ID | Ideia | Categoria | Valor | Esforço | Evidência | Principal risco |
| --- | --- | --- | --- | --- | --- | --- |
| D01 | **Tocar a seguir e Adicionar à fila** no menu de cada faixa | Experiência | A | B | 🔎 ausente; a fila reordenável (INV-UI-12) já existe | Nenhum técnico; decidir onde fica o menu na lista |
| D02 | **Timer de soneca** (15 min, 30 min, 1 h, fim do episódio) | Experiência | A | B | 🔎 ausente | 💭 JavaScript parado em segundo plano no iOS (ver acima): o timer pode não disparar com a tela bloqueada. Mitigar conferindo a hora a cada evento de mídia e ao voltar ao primeiro plano; testar no aparelho |
| D03 | **Sugestões ao digitar na busca** (Deezer `search/autocomplete`) | Experiência | M | B | ✅ responde com faixas, álbuns, artistas e playlists numa chamada, paginada (`next`); as chaves `podcasts` e `radios` existem e vieram vazias na amostra | Limite de taxa do Deezer não medido (os cabeçalhos da resposta não trouxeram contagem); resposta pode ser cacheada no CDN |
| D04 | **Compartilhar** faixa, playlist ou programa (Web Share) | Experiência | M | B | 📖 Web Share existe no Safari do iOS desde cerca de 2019; o comportamento no app instalado não foi confirmado | 💭 Um link para o próprio domínio do app tende a abrir no Safari, não no app instalado (as fontes tratam de apps nativos; o caso do PWA não foi confirmado). Quem recebe precisa ser convidado |
| D05 | **Resumo de escuta** (artistas e podcasts mais ouvidos, minutos, na semana ou no mês) | Experiência | M | M | 🔎 o histórico guarda só as 500 últimas reproduções (limite no banco) | Um resumo mensal exige contadores à parte (tabela nova e migração) |
| D06 | **Rádio de um artista** ("iniciar rádio a partir deste artista") | Descoberta | A | B | ✅ `artist/{id}/radio` do Deezer devolve faixas; `track/{id}/radio` **não existe** (erro 600) | Reaproveita a fila de rádio já existente (`refillRadio`); faixas novas gastam cota de vídeo como qualquer outra |
| D07 | **Reprodução automática ao fim da lista** (continuar com faixas parecidas) | Experiência | M | B | Depende de D06 | O mesmo de D06 |
| D08 | **Em alta**: paradas de faixas e de podcasts | Descoberta | M | B | ✅ Deezer `chart/0/tracks`, `chart/0/podcasts` e `editorial/0/charts` respondem (a amostra de podcasts veio em inglês: a parada é global); `editorial/0/releases` veio vazio. ✅ A parada de podcasts do iTunes do Brasil (`itunes.apple.com/br/rss/toppodcasts`) responde; o endereço mais novo da Apple (`rss.marketingtools.apple.com`) não foi alcançado do ambiente de desenvolvimento | Escolher a fonte brasileira (iTunes) para podcasts; a parada de faixas do Deezer é global |
| D09 | **Letras mais certas e mais estáveis**: usar `lrclib /api/get` com a duração, em vez do primeiro resultado da busca | Qualidade | M | B | ✅ para "One Last Breath" (Creed, 6 min) a busca devolveu um registro de 240 s e o `get` com a duração devolveu o de 356 s; ✅ o lrclib respondeu uma vez "servidor ocupado" (HTTP 503) e funcionou na tentativa seguinte. 🔎 hoje o app pega o primeiro resultado com letra sincronizada e tem 4 s de tempo limite | Letra de outra versão da música tocando no tempo errado; falhar em silêncio quando o serviço está ocupado |
| D10 | **Aviso de episódio novo** nos programas seguidos | Podcasts | A | M | 🔎 posição e programas seguidos já estão na conta (etapa 2). Verificar os feeds ao abrir o app resolve sem servidor | É a etapa 3 já combinada; o aviso só aparece com o app aberto |
| D11 | **Notificação push** de episódio novo | Podcasts | M | A | 📖 Web Push funciona em apps da tela inicial no iOS 16.4 ou mais novo, só depois de instalado e com um toque do usuário; relatos de assinaturas que somem sem motivo ([MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados)); a situação na UE não foi confirmada. 📖 O cron do Hobby roda no máximo uma vez por dia | Precisa de uma função nova (10 de 12), chaves VAPID, tabela de assinaturas e agendamento diário. O selo no ícone (Badging, 📖 iOS 16.4, só tela inicial) também exige permissão de notificação |
| D12 | **Podcast offline** (baixar o episódio) | Offline | M | A | ✅ o servidor do "Despertar Zen" **não manda cabeçalhos CORS**, então o navegador não consegue ler o arquivo para guardá-lo; passar pelo nosso servidor não cabe na Vercel gratuita | Só funcionaria para programas cujo host libere CORS; não é confiável |
| D13 | **Música offline** | Offline | A | — | Extração e download do YouTube estão descartados (termos, ver decisões); só com arquivos próprios no Supabase Storage (item aberto das decisões) | Depende de decisão do usuário sobre arquivos próprios |
| D14 | **Capítulos e transcrição de podcast** (`podcast:chapters`, `podcast:transcript`) | Podcasts | B | M | 📖 são parte do namespace Podcasting 2.0 ([especificação](https://github.com/Podcastindex-org/podcast-namespace)). ✅ o feed do "Despertar Zen" declara o namespace mas **não usa nenhuma dessas tags** | Valor baixo para o programa de teste; depende de cada feed |
| D15 | **Playlists compartilhadas** entre as pessoas do grupo | Social | M | M | Combina com o app por convite; 🔎 hoje playlist é de uma pessoa só (RLS por usuário) | Tabela de compartilhamento e regras de acesso novas |
| D16 | **Terminar a reserva do iTunes para o feed** (se o Deezer cair) | Disponibilidade | M | M | 🔎 já listado como pendente nas decisões; a busca já tem reserva iTunes | O feed por coleções tem mais estrutura no Deezer do que no iTunes |
| D17 | **Dividir o JavaScript** (carregar sob demanda painel de administrador, podcasts, player aberto) | Desempenho | B | M | ✅ o build gera um arquivo só: 537 kB, 153 kB comprimido, mais 63 kB de CSS (11 kB comprimido); o build avisa que passa de 500 kB | Ganho no primeiro carregamento não foi medido no aparelho; hoje o app é aberto como PWA, já em cache |
| D18 | **Sessão de áudio** (`navigator.audioSession.type = "playback"`) | Reprodução | B | B | 📖 iOS 17 ou mais novo: o áudio da página toca mesmo com o botão de silêncio ligado ([WebKit 237322](https://auto-bugs.webkit.org/show_bug.cgi?id=237322)); as fontes divergem sobre o padrão | 💭 O YouTube oculto e o `<audio>` podem já se comportar bem; testar no aparelho com o botão de silêncio antes de mexer |
| D20 | **Seguir artistas e "novos lançamentos"** (algo como o Release Radar) | Descoberta | A | M | ✅ Deezer `artist/{id}/albums` devolve os álbuns com `release_date` e tipo (Creed: 12 álbuns, o mais novo de 2025-09-23). 🔎 hoje a Biblioteca só agrupa artistas a partir das faixas favoritas; não existe "seguir artista" | Precisa de uma tabela de artistas seguidos e migração (como os podcasts); a checagem de lançamentos pode rodar ao abrir o app, sem servidor |
| D21 | **Ocultar e adiar** uma faixa ou artista dos mixes ("não quero ouvir isto") | Descoberta | M | B | 📖 o Spotify tem Ocultar e Adiar 30 dias ([resumo de terceiros](https://m.gsmarena.com/spotify_announces_a_ton_of_new_features_to_make_using_its_app_easier-news-67682.php)). 🔎 os mixes saem do histórico (`personalMixes.ts`), sem filtro de exclusão | Uma lista pequena por conta (campo novo no snapshot) |
| D22 | **Organizar playlists**: reordenar faixas, ordenar (A a Z, mais novas), capa própria, fixar no topo | Experiência | M | M | 📖 o Spotify oferece Adicionar, Ordenar e Editar no topo da playlist. 🔎 a sincronização já guarda a posição de cada faixa (`playlistTrackUpserts` com `position`), mas a tela da playlist não tem como reordenar (pedido do usuário, ainda pendente) | Capa própria exige guardar imagem (Supabase Storage); o resto é só interface |
| D19 | **Manter a tela acesa** (Wake Lock) | Reprodução | B | B | 📖 suportado no Safari do iOS 16.4, mas relatos de 2023 dizem que **não funciona em apps da tela inicial** | Não resolve o problema real (tela bloqueada) e não vale o esforço |

### Descartado por restrição (já documentado)

Crossfade, sem pausa entre faixas e equalizador com o player do YouTube no iPhone; volume pelo app, escolha de qualidade e "economia de dados" (decisão do usuário); "ouvir junto" em tempo real (esforço alto para 3 a 5 pessoas).

## Comparativo com os apps de referência

O que Spotify e Apple Music oferecem e se cabe aqui. As fontes sobre o Apple Music são páginas de baixa qualidade, com detalhes conflitantes; só o que o Spotify publicou na própria sala de imprensa é firme.

| Recurso nos apps de referência | Fonte | Cabe aqui? |
| --- | --- | --- |
| Timer de soneca, controles da fila, Smart Shuffle (misturar com faixas sugeridas) | 📖 [Spotify](https://newsroom.spotify.com/tag/sleep-timer) e [resumo](https://m.gsmarena.com/spotify_announces_a_ton_of_new_features_to_make_using_its_app_easier-news-67682.php) | Soneca e fila sim (D02, D01). Smart Shuffle seria D06 e D07 |
| Adicionar, ordenar e editar playlists, capa própria | 📖 mesmas fontes | Sim, em parte (D22) |
| Colaborar em playlists e Blend (misturar gostos de duas pessoas) | 📖 mesmas fontes | Colaborar sim (D15); Blend combinaria com o grupo pequeno, mas não foi avaliado |
| Ocultar e adiar recomendação | 📖 mesmas fontes | Sim (D21) |
| Crossfade, equalizador | 📖 listados em blog de terceiros | Não: o player do YouTube não permite (ver restrições) |
| Release Radar, daylist, carro | Não encontrei detalhes confiáveis nas buscas | Release Radar sim, como D20; os outros não foram avaliados |
| Replay (resumo do ano), transições automáticas (Automix), tradução de letras | 📖 só em páginas de baixa qualidade sobre o Apple Music | Replay como D05; Automix não cabe (mesma restrição do crossfade); tradução 💭 sem evidência para avaliar |

## Ordem sugerida

1. **Experiência, em PRs pequenos:** D01, depois D03 e D09. D02 junto de um teste no aparelho (ver risco).
2. **Descoberta:** D06 (com D07 por cima), depois D08. Depois D20 (artistas seguidos e lançamentos, com migração) e D21.
3. **Podcasts:** D10 (etapa 3 combinada). D11 só se o grupo sentir falta de notificação, porque custa uma função nova, chaves e agendamento.
4. **Dados e social:** D22 (reordenar playlist, já pedido), D05 e D15, se o grupo quiser.
5. **Segurar até haver decisão ou teste:** D12 e D13 (offline), D17 (desempenho), D18 (sessão de áudio).

## O que testar no aparelho antes de decidir

- **Segundo plano:** com um episódio tocando no app instalado e a tela bloqueada por 2 minutos, o próximo episódio começa sozinho? (decide D02 e a confiança em `onended`). Já está no T28, passo 7.
- **Botão de silêncio:** a música e o podcast tocam com o botão lateral de silêncio ligado? (decide D18).
- **Link compartilhado:** tocar num link do domínio do app, recebido por mensagem, abre o app instalado ou o Safari? (decide D04).

## Fontes e medições

| O quê | Resultado | Data |
| --- | --- | --- |
| Deezer `search/autocomplete?q=cree` e `q=monja` | Responde `tracks`, `albums`, `artists`, `playlists`, `podcasts`, `radios`, `total` e `next` | 2026-10-30 |
| Deezer `artist/1783/radio` e `track/3135556/radio` | O primeiro devolve faixas; o segundo, erro 600 "Unknown path components" | 2026-10-30 |
| Deezer `chart/0/tracks`, `chart/0/podcasts`, `editorial/0/charts`, `editorial/0/releases`, `genre` | Os três primeiros e `genre` respondem; `releases` vazio | 2026-10-30 |
| iTunes `itunes.apple.com/br/rss/toppodcasts/limit=3/json` | Responde com os programas mais ouvidos no Brasil | 2026-10-30 |
| `rss.applemarketingtools.com` (redireciona para `rss.marketingtools.apple.com`) | Não alcançado do ambiente de desenvolvimento | 2026-10-30 |
| iTunes `lookup?id=517962&entity=podcastEpisode` | Zero episódios: o iTunes serve para achar o programa, não os episódios (por isso o feed RSS) | 2026-10-29 |
| Feed do "Despertar Zen" | Declara `xmlns:podcast` e `xmlns:psc`, sem nenhuma tag `<podcast:...>` nos itens | 2026-10-29 |
| Arquivo `.mp3` do programa (cloudfront) | Responde `accept-ranges: bytes` e 206 a um pedido de faixa; sem `access-control-allow-origin` | 2026-10-30 |
| lrclib `get` e `search` para "One Last Breath" | `get` com duração 358 devolveu o registro de 356 s; `search` devolveu primeiro um de 240 s; uma resposta 503 "ServerOverloaded" na primeira tentativa | 2026-10-30 |
| Build (`npm run build`) | `index-*.js` 536,94 kB (153 kB com gzip), `index-*.css` 62,86 kB (11 kB com gzip) | 2026-10-30 |
| Web Push em apps da tela inicial do iOS | 16.4 ou mais novo, só depois de instalado, com gesto do usuário; relatos de instabilidade: [MagicBell](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [Pushpad](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications), [WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados) | 2026-10-30 |
| Badging em apps da tela inicial | iOS 16.4, só tela inicial, o selo só aparece com permissão de notificação: [WebKit](https://webkit.org/blog/14112/badging-for-home-screen-web-apps/) | 2026-10-30 |
| Wake Lock, Web Share e Media Session no iOS | Wake Lock: Safari 16.4, sem suporte em apps da tela inicial segundo fontes de 2023; Web Share: desde cerca de 2019; Media Session: iOS 15: [firt.dev](https://firt.dev/notes/pwa-ios/) | 2026-10-30 |
| Áudio e JavaScript em segundo plano num PWA do iOS | Relatos de que o áudio e os eventos param com o app fora do primeiro plano: [WebKit 198277](https://bugs.webkit.org/show_bug.cgi?id=198277), [DEV](https://dev.to/prototyp/what-we-learned-about-pwas-and-audio-playback-50eh), [Apple Developer Forums](https://developer.apple.com/forums/thread/762582) (2019 a 2021) | 2026-10-30 |
| `navigator.audioSession` | iOS 17 ou mais novo; `type = "playback"` evita que o botão de silêncio mude o áudio: [WebKit 237322](https://auto-bugs.webkit.org/show_bug.cgi?id=237322) | 2026-10-30 |
| Deezer `artist/1783/albums?limit=3` | 12 álbuns no total, com `release_date` e `record_type` | 2026-10-30 |
| Spotify e Apple Music: lista de recursos | Spotify: [novidades de maio de 2025](https://m.gsmarena.com/spotify_announces_a_ton_of_new_features_to_make_using_its_app_easier-news-67682.php) e [sala de imprensa](https://newsroom.spotify.com/tag/sleep-timer); Apple Music: só páginas de baixa qualidade | 2026-10-30 |
| Cron na Vercel Hobby | Uma vez por dia, precisão de até uma hora: [Vercel](https://vercel.com/docs/cron-jobs/usage-and-pricing) | 2026-10-30 |
| Links do domínio do app e apps da tela inicial | Nada específico encontrado sobre PWA; as fontes tratam de Universal Links de apps nativos: [Apple](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content.md) | 2026-10-30 |

## Registro de decisões

Nenhuma ideia deste documento foi decidida ainda. Ao decidir uma, anote aqui a data, a decisão e o PR, e ponha o id (`Dnn`) no PR e na documentação do que for implementado.

| Data | ID | Decisão | PR |
| --- | --- | --- | --- |
| — | — | — | — |
