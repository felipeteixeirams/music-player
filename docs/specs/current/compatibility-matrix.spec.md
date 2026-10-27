# Especificação: matriz de compatibilidade (o que funciona, onde)

## Para que serve

Responder em segundos "isto é regressão ou é um limite conhecido?". Cada linha é uma capacidade do app; cada coluna, um ambiente. Uma célula só vira ✅ ou ❌ com **evidência** (data, aparelho, versão do app e o item do [roteiro de validação](validation-checklist.spec.md) ou o teste automático). Sem evidência, fica "não testado". O que foi suposto e não medido não entra aqui.

Legenda: ✅ funciona · ⚠️ funciona com ressalva (ver observação) · ❌ não funciona · ⬜ não testado.

Colunas de aparelho: **Navegador** é uma aba do Safari ou do Edge no iPhone (tem barra de endereço); **App instalado** é o ícone na tela inicial (PWA, tela cheia, sem barra de endereço). O relatório de Ajustes > Diagnóstico de reprodução abre com a versão e o modo (`APP INSTALADO (PWA)` ou `NAVEGADOR`) para que isso nunca precise ser perguntado. **Chromium (teste automático)** é o Playwright do CI: prova a lógica, não o comportamento do iOS.

## Reprodução

| Capacidade | Chromium (teste automático) | iPhone, navegador | iPhone, app instalado | Observações e evidência |
| --- | --- | --- | --- | --- |
| Faixa completa segue tocando com o app minimizado e a tela bloqueada | — | ✅ (Edge) | ❌ | T04, 2026-10-25, iPhone 11. No app instalado o iOS pausa o áudio e o play da tela de bloqueio não religa: decisão de usar pelo navegador. Safari não testado. |
| Controles do sistema (tela de bloqueio) com a faixa completa | — | ⬜ | ❌ | T04 registrou que o play da tela de bloqueio não religa no app instalado; o navegador não foi testado para os controles. |
| Prévia de 30 s segue tocando em segundo plano | — | ⬜ | ⬜ | T04 passo 4 não foi feito. |
| Faixa completa começa no primeiro toque | ✅ (`tests/e2e/prefetch.spec.ts`, vídeo conhecido) | ⬜ | ⚠️ | 2026-10-26, relato do usuário, depois do PR #52: o aviso "O iPhone não deixou a música começar sozinha" apareceu e o ▶ foi preciso. Antes das mudanças de início (PRs #52 e #54) a faixa nova esperava a rede no toque. Rever depois do #54. 2026-10-27, Edge no iPhone (navegador), faixa nova: ficou em 0:00 e o aviso apareceu, o mesmo do app instalado. No WebKit do ambiente de desenvolvimento o player do YouTube só carrega 1,7 a 3,5 s depois do toque mesmo com a busca em 50 ms (o vídeo não toca lá: o YouTube responde "indisponível" ao ambiente, então o som não é verificável fora do aparelho). Hipótese (não verificada): o iOS só deixa o iframe começar sozinho se ele nasceu perto do toque; o `react-player` recriava o iframe depois da busca. Correção: iframe criado no toque e reaproveitado, prévia imediata e tentativas silenciosas (INV-PLAY-07 a 09); a linha continua ⚠️ até ser testada no aparelho. 2026-10-27, app instalado, iOS 18.7 (versão 86104349e387): faixa com player ainda carregando no toque falhou (6 s sem som) e o ▶ iniciou em 794 ms; a faixa seguinte, com vídeo conhecido e player já pronto, começou sozinha em 1,5 s. Hipótese em teste: o iOS aceita o início quando a chamada ao player sai dentro do toque (INV-PLAY-10). |
| Faixa com vídeo já conhecido começa sem esperar a rede | ✅ (`tests/e2e/prefetch.spec.ts`) | ⬜ | ⬜ | Entrou no PR #54; falta medir no aparelho (Diagnóstico: "começou a tocar … ms depois do toque"). |
| Prévia de 30 s começa no primeiro toque | ✅ (`tests/e2e/playback.spec.ts`) | ⬜ | ⬜ | Depende do desbloqueio do elemento de áudio (PR #52). |
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
