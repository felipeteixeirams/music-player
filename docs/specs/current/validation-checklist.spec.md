# Spec: roteiro de validação em produção

## Objetivo

Registrar o que precisa ser validado, no aparelho do usuário e com o app em produção, antes de considerar o fluxo de música estável. Os testes automáticos (unitários, de contrato com serviços simulados e o smoke live) cobrem a lógica, mas não o que depende do celular, da rede e do YouTube: reprodução com a tela bloqueada, bloqueio de embed por IP, cota da API e desempenho percebido.

Este satélite pertence ao master [Integrações musicais](../../masters/music-integrations.md). Os requisitos de contrato e as decisões continuam em [Contratos, mappers e testes](music-integration-contracts.spec.md).

## Como usar

1. Os testes vão em **rodadas de dois**. Execute os dois da rodada, anote o resultado e só então siga para a próxima.
2. Marque cada teste: ✅ passou, ⚠️ passou com ressalva (descreva), ❌ falhou (descreva o que viu e, se possível, mande o texto do log) ou ⬜ pendente.
3. Uma falha vira item de trabalho antes da rodada seguinte se ela mudar o que se testa depois (ver "Se falhar" em cada teste).
4. Os resultados ficam na tabela "Registro" no fim deste documento, com data, aparelho e navegador.

## Pré-requisitos

- O deploy da `main` está verde na Vercel (um deploy com falha deixa a produção na versão anterior).
- `YOUTUBE_API_KEY` configurada em Production na Vercel, com redeploy feito depois de criá-la.
- Você está logado na Vercel no navegador (a proteção de deployment responde 302 a quem não está) ou a proteção foi desligada.
- Os valores abaixo (totais e primeiras faixas) vêm de playlists editoriais do Deezer e podem variar um pouco quando o Deezer as edita.

## Rodada 1: base do serviço e das coleções

### T01: rotas de API em produção

Abra, no navegador logado na Vercel:

| Endereço | Esperado |
| --- | --- |
| `/api/health` | `{"status":"ok", ...}` |
| `/api/feed` | `categories` com 5 coleções (`top-hits`, `classic-rock`, `alternative-pop`, `lofi-chill`, `synthwave`), cada uma com 15 faixas, `total` (cerca de 100, 100, 150, 92, 50) e `nextIndex` 15; `featured` preenchido |
| `/api/category?id=classic-rock&index=15` | 20 faixas, `nextIndex` 35, nenhuma repetida da página anterior |
| `/api/category?id=nao-existe` | 400 `Categoria desconhecida` |
| `/api/search?q=queen&index=20` | 20 faixas, `source` `deezer`, `total` maior que 100 |
| `/api/resolve?artist=Creed&title=One%20Last%20Breath&duration=238` | `videoIds` com até 3 ids de 11 caracteres |

Depois olhe o log de execução da Vercel: cada chamada deve ter deixado uma linha (`[Feed]`, `[Category]`, `[Search]`, `[Resolve]`), e o `[Resolve]` deve dizer `via official`.

Se falhar: `via web` com a chave configurada indica que a chave não chega à função (conferir Production e redeploy); 502 em `/api/feed` ou `/api/category` indica o Deezer fora do ar ou uma playlist removida.

### T02: fidelidade das coleções, "Ver tudo" e paginação

1. Na home, confira os 5 carrosséis e o conteúdo de cada um contra a descrição: Top Hits (músicas mais tocadas no Brasil), Classic Rock (AC/DC, Pink Floyd, Bowie, Beatles), Alternative & Indie (indie e alternativo de hoje), Lofi Chill (lo-fi para estudar), Synthwave & Retrowave (sintetizadores dos anos 80).
2. Toque em "Ver tudo" em cada carrossel e também em cada bloco da grade "Explorar tudo" da aba Buscar; confira que a lista mostra só aquela coleção (Synthwave não pode mostrar faixas de outras) e que "‹" no topo volta à tela de onde você veio.
3. Em uma coleção, role até o fim. As faixas devem aparecer em blocos e o botão "Carregar mais" deve sumir no fim; a linha sob o título diz o total da coleção (por exemplo "100 faixas").
4. Procure faixas repetidas na mesma lista.

Esperado: nenhuma coleção com faixa fora do tema, nenhuma repetida, contagens iguais ao `total` de T01, rolagem sem travar.

Se falhar: uma coleção fora do tema pede troca da playlist em `api/_categories.ts`; repetição ou páginas faltando indica defeito na paginação.

## Rodada 2: reprodução

### T03: faixa completa em várias coleções

Toque 5 ou 6 faixas de coleções diferentes, esperando 3 segundos em cada:

- a duração mostrada é a da música (não 0:30) e o tempo avança;
- o aviso amarelo "Faixa completa indisponível, tocando a prévia de 30s" não aparece;
- anote quais faixas tocaram só a prévia ou não tocaram, e quanto tempo levou até o som sair.

Depois confira no log de execução as linhas `[Resolve]` dessas faixas: `N vídeo(s)` com N maior que zero, e `via official`.

Se falhar: muitas faixas só com prévia indicam embeds bloqueados ou vídeo escolhido errado (ver T04 e a frente "qualidade da escolha do vídeo" em "Frentes em aberto"). Anote título e artista de cada caso para investigar o ranqueamento em `api/_youtubeSearch.ts`.

### T04: reprodução com a tela bloqueada e em segundo plano

Este é o maior risco do produto: o áudio completo vem de um player do YouTube oculto, e navegadores de celular costumam pausar esse tipo de conteúdo fora de primeiro plano.

1. Toque uma faixa completa e bloqueie a tela. A música continua? Aparecem os controles (título, capa, play/pausa, próxima) na tela de bloqueio ou na notificação?
2. Volte ao app. O tempo e o estado estão corretos?
3. Troque para outro aplicativo por 1 minuto e volte.
4. Repita com uma faixa que toque só a prévia (a prévia usa um `<audio>` comum, que se comporta diferente).
5. Se você usa o app instalado na tela inicial (PWA), repita nele e também no navegador.

Anote o aparelho, o sistema e o navegador. Esperado: o áudio continua com a tela bloqueada e os controles do sistema funcionam.

Resultado de 2026-10-25: no navegador funcionou; só o app instalado (PWA) pausa. A causa provável é a restrição do iOS a mídia de apps instalados, e não o player do YouTube (relatos externos citados na conversa; sem correção confirmada). Se falhar em outro aparelho: pausa em segundo plano é limitação do player do YouTube no celular. A alternativa é discutir a solução definitiva para o áudio completo (decisão em aberto do usuário) antes de investir em desempenho ou em playlists.

## Rodada 3: dados do usuário e busca

### T05: favoritos e Biblioteca

1. Curta uma faixa de uma coleção, uma da busca e uma do player expandido.
2. Recarregue a página e abra a Biblioteca (menu de seções) e depois "Músicas favoritas": as três devem estar lá, com capa, título e artista. Confira também "Artistas" e "Álbuns" (agrupam os favoritos; tocar numa linha abre as faixas, e "‹" volta) e que tocar na aba Biblioteca de novo volta ao menu.
3. Mude de coleção ou espere o feed mudar e confira que os favoritos continuam na Biblioteca.
4. Descurta uma e recarregue de novo.
5. Se você tinha favoritos de antes das últimas versões, confira se eles aparecem quando a faixa reaparece em uma lista.

Esperado: favoritos persistem entre recargas e não dependem do que o feed trouxe. "Downloads" lista as faixas baixadas (os downloads feitos antes desta versão só aparecem se a faixa também estiver nos favoritos).

Se falhar: favorito que some indica problema em `src/utils/likedTracks.ts` ou limpeza do armazenamento do navegador (conferir se o modo anônimo ou a limpeza de cache não está ativo).

### T06: busca paginada

1. Busque `queen` e role: devem vir 20 faixas por bloco (conferir "N de TOTAL faixas").
2. Busque com acento (`Beyoncé`), com erro de digitação (`metalica`), com um termo sem resultado (`xzqwvk`) e deixe o campo vazio.
3. Busque a mesma coisa duas vezes seguidas: a segunda deve recarregar do início.
4. Observe faixas com o mesmo título e artista em linhas diferentes (remasters e coletâneas); anote se isso confunde.

Esperado: resultados coerentes, mensagem clara quando não há nada, sem erro de console.

Se falhar: linhas parecidas que confundem justificam mostrar o álbum na linha da faixa.

## Rodada 4: offline e erros

### T07: download offline de prévia

1. Toque o ícone de download em uma faixa. O aviso deve dizer "Prévia de 30s ... salva para ouvir offline".
2. Ative o modo avião e toque a faixa baixada. Deve tocar os 30s.
3. Tente baixar uma faixa que só toca pelo YouTube (sem prévia). Deve aparecer a explicação de que faixas completas do YouTube não podem ser baixadas.
4. Remova o download e confirme que o ícone volta ao estado normal.
5. Abra o gerenciador de cache do app e confira o espaço usado.

Esperado: a prévia toca offline, e o app nunca promete a música inteira offline.

Se falhar: erro ao baixar indica o proxy `/api/audio` (conferir o log) ou limite de armazenamento do navegador.

### T08: estados de erro e recuperação

1. Com o modo avião ligado, abra o app já aberto antes e tente abrir uma coleção que você ainda não abriu: deve aparecer a mensagem de erro com "Tentar de novo".
2. Desligue o modo avião e toque em "Tentar de novo": a lista deve carregar.
3. Abra o app do zero em modo avião: o feed deve mostrar o erro com "Tentar de novo" (e o indicador de offline).
4. Durante uma busca paginada, ligue o modo avião antes de rolar até o fim: o fim da lista deve mostrar o erro, sem perder as faixas já carregadas.

Esperado: nenhuma tela em branco, nenhum erro sem saída, e a recuperação funciona sem recarregar a página.

Se falhar: anote o que apareceu; telas travadas indicam defeito em `usePagedTracks` ou `LoadMoreSentinel`.

## Rodada 5: uso real

### T09: logs de uso e cota

Use o app normalmente por uns 30 minutos (buscar, tocar, trocar de coleção) e então exporte os logs de execução da Vercel (Logs, filtro pelo deploy de produção). Conte:

- linhas `[Resolve]` com `via official`, `via web` e `via web-after-official-failure`;
- linhas `[Resolve] ⚠️` com `0 vídeo(s)` (faixas que só tocam a prévia);
- linhas `[Feed] ⚠️`, `[Category] ⚠️`, `[Search] ⚠️` e `[YouTube] API oficial indisponível`;
- respostas 4xx e 5xx na aba de requisições.

Conte também respostas 403 e 429 (proteção das rotas): com uso normal não deve haver nenhuma; algumas indicam um script ou outro site chamando a API. Esperado: quase todas `via official`, poucas faixas sem vídeo, nenhum 5xx. A cota gratuita da API do YouTube é de cerca de 100 buscas por dia (`search.list` custa 100 unidades de 10.000): uma sessão longa pode esgotá-la, e o app cai na busca web não oficial.

Se falhar: `web-after-official-failure` em série indica cota esgotada. Se isso acontecer com uso normal, a frente "abuso e cota" sobe de prioridade.

### T10: desempenho percebido

1. Tempo até o primeiro som depois de tocar uma faixa (anote em segundos, em Wi-Fi e em dados móveis).
2. Rolagem de uma lista com 100 faixas: fluida ou com engasgos?
3. Aquecimento do aparelho e consumo de bateria durante 15 minutos de reprodução com o app aberto.
4. Abra o app com a rede lenta (limite de velocidade do navegador, se houver) e observe quando a home aparece.

Esperado: som em até 2 a 3 segundos, rolagem fluida, sem aquecimento anormal. (Desde 2026-10-25 a lista não renderiza de novo a cada tick do relógio e as linhas fora da tela não são desenhadas; confira o efeito numa coleção carregada até o fim, com música tocando.)

Se falhar: rolagem com engasgos indica a frente "desempenho da interface" (dividir o contexto de áudio e renderizar só as linhas visíveis).

## Rodada 6: uso cotidiano

### T11: controles de reprodução e fila

1. Próxima e anterior: tocam as faixas esperadas da lista de onde você partiu?
2. Toque uma faixa perto do fim da primeira página de uma coleção (a 13ª de 15 num carrossel, por exemplo) e deixe tocar: o app deve buscar a página seguinte sozinho e continuar, sem parar nem voltar ao início da lista. (Implementado em 2026-10-25; antes parava no fim do que estava carregado.)
3. Aleatório e repetir (uma, todas) funcionam?
4. Buscar no tempo (arrastar a barra de progresso) funciona nas faixas completas e nas prévias?
5. Volume e mudo.

Esperado: tudo funciona e a fila continua além da primeira página. Só não continua em listas sem origem paginada (Biblioteca, Mix das coleções e a busca no catálogo local), que acabam no fim do que mostram.

### T12: instalação como app (PWA) e atualização

1. Instale o app na tela inicial e abra por lá.
2. Abra sem rede: a casca do app deve abrir (a música depende de rede, exceto as prévias baixadas).
3. Depois de um novo deploy, abra o app instalado: ele carrega a versão nova? Ou fica preso na antiga?
4. Limpe o cache pelo gerenciador do app: os favoritos devem ser tratados como descrito na tela.

Esperado: instalação funciona e a atualização chega sem precisar reinstalar.

Se falhar: versão antiga persistente indica a política de cache do service worker (`public/sw.js`).

### T13: rádio ao vivo, mix por gênero e menu

1. Na aba Rádio, toque uma rádio da seção "Ao vivo": começa a tocar, o player não mostra linha do tempo, aleatório, repetir nem anterior, e o mini player indica transmissão ao vivo.
2. Toque um "Mix por gênero": a fila segue sozinha, sem parar ao fim do primeiro lote de faixas.
3. Se alguma faixa do mix não tocar, o app pula para a próxima em vez de travar.
4. Na Rádio, as estações são quadrados em grade de 3 colunas (as de mix com a imagem do Deezer, as ao vivo com iniciais sobre uma cor); a que está tocando ganha um anel vermelho e a etiqueta TOCANDO. Menu inferior: Início, Rádio, Biblioteca e Buscar. O item destacado acompanha a tela em que você está, inclusive depois de abrir uma coleção ou uma busca.
5. Em iPhone com recorte (PWA instalado): o título grande e o menu não ficam colados na borda e o texto da barra de status continua legível ao rolar.
6. Botão de ajustes (engrenagem no canto do título): abre "Gerenciar cache local" e o botão de instalar o app.

Esperado: rádio ao vivo toca sem controles de playlist, mix é contínuo, menu coerente.

Se falhar: anote o nome da rádio. Uma transmissão fora do ar pede troca da URL em `src/data/liveRadios.ts`.

## Frentes em aberto (fora dos testes)

Priorizadas, sujeitas ao resultado das rodadas acima:

1. Reprodução com a tela bloqueada (T04): pode mudar a arquitetura do áudio completo.
2. Qualidade da escolha do vídeo: ranqueamento pode escolher versão errada; opções: mostrar o álbum, deixar o usuário escolher entre os candidatos, registrar nos logs as faixas sem vídeo.
3. Abuso e cota: rotas públicas e cota de cerca de 100 buscas por dia.
4. Feed com a última versão guardada no aparelho e com reserva se o Deezer cair.
5. Playlists criadas pelo usuário.

## Testes automáticos que já passam

`npm test` (135 testes, 6 ignorados que dependem de rede) e `npm run test:e2e` (13 testes de ponta a ponta no Chromium com as rotas simuladas), `npm run lint`, `npm run build` e `npm run test:integrations:live` (4 smoke: prévias do Deezer, resolução de vídeos, iTunes e as playlists das coleções). A integração contínua (`.github/workflows/ci.yml`) roda tipos, testes, build e ponta a ponta em todo PR e na `main`.

## Registro

| Teste | Data | Aparelho e navegador | Resultado | Observações |
| --- | --- | --- | --- | --- |
| T01 | | | ⬜ | |
| T02 | | | ⬜ | |
| T03 | | | ⬜ | |
| T04 | 2026-10-25 | iPhone 11, Microsoft Edge (navegador) e app instalado (PWA) | ⚠️ | No navegador: a faixa completa continua tocando com a tela bloqueada e com o app minimizado. No app instalado na tela inicial: o áudio para ao bloquear, e o play da tela de bloqueio não religa. Decisão: usar pelo navegador; o texto do modal de instalação avisa. Não testado: prévia de 30s no PWA, nem troca de aplicativo por 1 minuto. |
| T05 | | | ⬜ | |
| T06 | | | ⬜ | |
| T07 | | | ⬜ | |
| T08 | | | ⬜ | |
| T09 | | | ⬜ | |
| T10 | | | ⬜ | |
| T11 | | | ⬜ | |
| T12 | | | ⬜ | |
| T13 | | | ⬜ | |
