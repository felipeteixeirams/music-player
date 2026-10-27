# Especificação: matriz de compatibilidade (o que funciona, onde)

## Para que serve

Responder em segundos "isto é regressão ou é um limite conhecido?". Cada linha é uma capacidade do app; cada coluna, um ambiente. Uma célula só vira ✅ ou ❌ com **evidência** (data, aparelho, versão do app e o item do [roteiro de validação](validation-checklist.spec.md) ou o teste automático). Sem evidência, fica "não testado". O que foi suposto e não medido não entra aqui.

Legenda: ✅ funciona · ⚠️ funciona com ressalva (ver observação) · ❌ não funciona · ⬜ não testado.

Colunas de aparelho: **Navegador** é uma aba do Safari ou do Edge no iPhone (tem barra de endereço); **App instalado** é o ícone na tela inicial (PWA, tela cheia, sem barra de endereço). O relatório de Ajustes > Diagnóstico de reprodução abre com a versão e o modo (`APP INSTALADO (PWA)` ou `NAVEGADOR`) para que isso nunca precise ser perguntado. **Chromium (teste automático)** é o Playwright do CI: prova a lógica, não o comportamento do iOS.

## Reprodução

| Capacidade | Chromium (teste automático) | iPhone, navegador | iPhone, app instalado | Observações e evidência |
| --- | --- | --- | --- | --- |
| Faixa completa segue tocando com o app minimizado e a tela bloqueada | — | ✅ (Edge) | ❌ | T04, 2026-10-25, iPhone 11. No app instalado o iOS pausa o áudio e o play da tela de bloqueio não religa: decisão de usar pelo navegador. Safari não testado. |
| Rádio ao vivo (áudio nativo `<audio>`, sem YouTube) segue tocando com a tela bloqueada | — | ⬜ | ✅ | 2026-10-27, relato do usuário, app instalado, iOS 18.7: as rádios FM de São Paulo tocaram em segundo plano. As rádios por estilo (faixas do YouTube) não tocaram. Conclusão: o áudio nativo sobrevive no app instalado; o que o iOS pausa é o player do YouTube. O relatório do Diagnóstico não foi colado. As emissoras "Mais rádios ao vivo" (por estilo, do diretório) usam o mesmo caminho, mas ainda não foram ouvidas no aparelho. 2026-10-28, versão 7c75a4f2c1b7: "Rádio Globo" (áudio do navegador) avançou 7 s com o app em segundo plano; as faixas do YouTube pararam de novo ("a faixa parou enquanto o app estava fora"), duas vezes. |
| Controles do sistema (tela de bloqueio) com a faixa completa | — | ⬜ | ❌ | T04 registrou que o play da tela de bloqueio não religa no app instalado; o navegador não foi testado para os controles. |
| Prévia de 30 s segue tocando em segundo plano | — | ⬜ | ⬜ | T04 passo 4 não foi feito. |
| Faixa completa começa no primeiro toque | ✅ (`tests/e2e/prefetch.spec.ts`, vídeo conhecido) | ⬜ | ⚠️ | 2026-10-26, relato do usuário, depois do PR #52: o aviso "O iPhone não deixou a música começar sozinha" apareceu e o ▶ foi preciso. Antes das mudanças de início (PRs #52 e #54) a faixa nova esperava a rede no toque. Rever depois do #54. 2026-10-27, Edge no iPhone (navegador), faixa nova: ficou em 0:00 e o aviso apareceu, o mesmo do app instalado. No WebKit do ambiente de desenvolvimento o player do YouTube só carrega 1,7 a 3,5 s depois do toque mesmo com a busca em 50 ms (o vídeo não toca lá: o YouTube responde "indisponível" ao ambiente, então o som não é verificável fora do aparelho). Hipótese (não verificada): o iOS só deixa o iframe começar sozinho se ele nasceu perto do toque; o `react-player` recriava o iframe depois da busca. Correção: iframe criado no toque e reaproveitado, prévia imediata e tentativas silenciosas (INV-PLAY-07 a 09); a linha continua ⚠️ até ser testada no aparelho. 2026-10-27, app instalado, iOS 18.7 (versão 86104349e387): faixa com player ainda carregando no toque falhou (6 s sem som) e o ▶ iniciou em 794 ms; a faixa seguinte, com vídeo conhecido e player já pronto, começou sozinha em 1,5 s. Hipótese em teste: o iOS aceita o início quando a chamada ao player sai dentro do toque (INV-PLAY-10). 2026-10-28, app instalado, iOS 18.7 (versão 23b1407281c6, PR #58): faixa já conhecida começou sozinha em 3,6 s depois de duas tentativas; faixas novas não tocaram nem a prévia (nenhum "começou a tocar (áudio do navegador)" no relatório, só o aviso de 6 s) e o ▶ iniciou a faixa completa. A única diferença desde o relatório em que a prévia tocava (versão ed6b5056d7c4) era o vídeo-reserva mudo no toque, retirado depois. Rádio FM ao vivo (áudio nativo) tocou em segundo plano. **2026-10-28, app instalado, iOS 18.7, versão 1fb536dadd54 (tudo do #56 ao #65 na `main`):** quatro faixas de vídeo já conhecido começaram sozinhas no primeiro toque, em 1,6 a 2,5 s (com o player já pronto desde a abertura). Uma faixa nova ("Welcome To The Jungle") tocou a prévia em 1,7 s (link vencido renovado) e, 3 s depois, a faixa completa assumiu sozinha ("faixa completa assumiu no lugar da prévia"): um caso, sem tocar de novo. Isso sustenta a hipótese de que o player pronto antes do toque é o que faz o iOS aceitar o início; n = 5 faixas, uma sessão. |
| Faixa com vídeo já conhecido começa sem esperar a rede | ✅ (`tests/e2e/prefetch.spec.ts`) | ⬜ | ⬜ | Entrou no PR #54; falta medir no aparelho (Diagnóstico: "começou a tocar … ms depois do toque"). |
| Prévia de 30 s começa no primeiro toque | ✅ (`tests/e2e/playback.spec.ts`) | ⬜ | ⬜ | Depende do desbloqueio do elemento de áudio (PR #52). 2026-10-28, app instalado, versão 7c75a4f2c1b7: "Frantic" começou a prévia em 419 ms; "Iris" foi recusada com `NotSupportedError`. Causa provável: o link de prévia do Deezer vence em ~15 minutos (medido na API: `exp` = agora + 0,25 h) e o feed fica em cache por horas. Corrigido com renovação do link (INV-PREV-01 a 03); falta confirmar no aparelho. 2026-10-28, app instalado, versão af7065795696 (com o PR #61): a renovação do link vencido funcionou ("o link da prévia tinha vencido: pedi um novo" e a prévia começou em 0,8 a 1,2 s). Novo problema medido: com o player do YouTube sendo chamado ao lado, a prévia parava cerca de 0,5 s depois de cada ▶ ("áudio do navegador pausou (app visível, em 2 s)"). Corrigido neste ramo (INV-PLAY-13: o player é chamado uma vez só enquanto a prévia toca); falta confirmar no aparelho. 2026-10-28, versão 1fb536dadd54: a prévia de uma faixa nova começou em 1,7 s com o link renovado e sem ficar presa (uma pausa 1 s depois foi a troca para a faixa completa). |
| A tela não mostra "tocando" quando não sai som | ✅ (`tests/e2e/playback.spec.ts`) | ⬜ | ✅ | 2026-10-26: o aviso e o ▶ apareceram no app instalado (captura do usuário). |

## Conta, dados e sincronização

| Capacidade | Chromium (teste automático) | iPhone, navegador | iPhone, app instalado | Observações e evidência |
| --- | --- | --- | --- | --- |
| Entrar com o código por e-mail | ✅ (`tests/e2e/login.spec.ts`, Supabase simulado) | ⬜ | ✅ | 2026-10-26, relato do usuário: "o código chegou, consegui entrar" (envio por SMTP do Gmail). O modo exato (navegador ou instalado) não foi informado: confirmar. |
| Favoritos e playlists só da conta, em dois aparelhos | ✅ (`tests/e2e/sync.spec.ts`) | ⬜ | ⬜ | Falta testar com dois aparelhos reais e duas contas. |
| Dois usuários no mesmo aparelho não se misturam | ✅ (`tests/e2e/sync.spec.ts`, `downloads.spec.ts`, `history.spec.ts`) | ⬜ | ⬜ | |
| Download offline de prévia | ✅ (`tests/e2e/downloads.spec.ts`) | ⬜ | ⬜ | |
| Histórico "Reproduzidas recentemente" | ✅ (`tests/e2e/history.spec.ts`) | ⬜ | ⬜ | |

## Como manter

1. Ao testar no aparelho um item do roteiro, atualize a linha daqui **no mesmo dia**: data, aparelho, versão do app (a primeira linha do Diagnóstico) e o T-item. Mudou de ✅ para ❌ depois de uma alteração do código: é regressão; registre o PR suspeito na observação.
2. Mudança que mexe numa capacidade da tabela cita a linha no PR e diz o que foi (ou não foi) testado em iPhone.
3. Capacidade nova entra como linha, com ⬜ nas colunas que ninguém testou.
4. Nada de ✅ por "deveria funcionar": o teste automático vale só na coluna Chromium.
