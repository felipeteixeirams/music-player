# Especificação: fontes de áudio, descobertas e decisões (2026-10-25 a 2026-10-28)

## Para que serve

Guardar o que se descobriu e o que se decidiu sobre **de onde vem o áudio** e **por que ele para em segundo plano no iPhone**, para que nenhuma investigação seja refeita. Cada afirmação aqui vem com a sua origem, em uma destas categorias:

- **Medido**: observado no aparelho do usuário, no ambiente de desenvolvimento ou na API real, com data.
- **Documentado**: dito por uma fonte oficial citada com link.
- **Hipótese**: suposição ainda não provada. Não vira regra sem evidência (ver a [triagem no AGENTS.md](../../../AGENTS.md)).
- **De memória**: conhecimento geral que não foi conferido nesta sessão; confirmar antes de decidir com base nele.

O estado de cada capacidade por ambiente está na [matriz de compatibilidade](compatibility-matrix.spec.md); os contratos e invariantes do código, no [master de integrações](../../masters/music-integrations.md). Este satélite registra o **porquê** das escolhas e o que ficou em aberto.

## O problema

O usuário quer tocar uma música e bloquear a tela, com a música seguindo, e quer que o primeiro toque numa faixa a faça tocar, sem precisar de um segundo toque. O app é pessoal, para o usuário e mais duas pessoas, e o objetivo é áudio (não vídeo), com economia de banda e de cota.

## O que foi medido

### No aparelho do usuário (iPhone 11 e iOS 18.7)

| Data | Ambiente / versão | O que se viu |
| --- | --- | --- |
| 2026-10-25 | Edge (navegador) e app instalado (T04) | No navegador a faixa completa seguiu tocando com a tela bloqueada. No app instalado o áudio parou e o play da tela de bloqueio não religou. Entre a falha (21:42 UTC) e o sucesso (21:54 UTC) não houve deploy de código de reprodução: a diferença foi o ambiente, não uma correção. |
| 2026-10-27 | App instalado, `86104349e387` | Faixa com player ainda carregando no toque: 6 s sem som, e o ▶ iniciou em 794 ms. A faixa seguinte, com vídeo conhecido e player já pronto, começou sozinha em 1,5 s. |
| 2026-10-27 | App instalado | As rádios FM ao vivo (áudio nativo `<audio>`) tocaram em segundo plano com a tela bloqueada. As rádios por estilo feitas de faixas do YouTube não tocaram. |
| 2026-10-28 | App instalado, `23b1407281c6` (PR #58) | Nenhuma faixa nova começou a prévia. A faixa de vídeo já conhecido começou sozinha em 3,6 s depois de duas tentativas. Uma rádio ao vivo avançou 11 s com o app fora. |
| 2026-10-28 | App instalado, `af7065795696` (com o PR #61) | A renovação do link vencido funcionou (prévia em 0,8 a 1,2 s). Com a prévia tocando e o player do YouTube sendo chamado ao lado, a prévia parava cerca de 0,5 s depois de cada ▶, três vezes seguidas (`áudio do navegador pausou (app visível, em 2 s)`). Duas "recusas" `AbortError` por toques em sequência rápida. |
| 2026-10-28 | App instalado, `7c75a4f2c1b7` | "Iris": prévia recusada com `NotSupportedError`. "Frantic": prévia em 419 ms. Uma busca de vídeo sem resposta por cerca de 90 s. As faixas do YouTube pararam em segundo plano duas vezes. A "Rádio Globo" (áudio nativo) avançou 7 s com o app fora. |

### No ambiente de desenvolvimento e nas APIs reais

- **Link de prévia do Deezer** (2026-10-28, API real): o `hdnea=exp=…` vence cerca de 15 minutos depois da consulta (`exp` igual a agora mais 0,25 h). O feed fica em cache por horas (CDN e aparelho): uma lista aberta há mais de 15 minutos traz links mortos.
- **WebKit do ambiente** (2026-10-27): o player do YouTube só carrega de 1,7 a 3,5 s depois do toque, mesmo com a busca do vídeo em 50 ms. O som real não é verificável ali (o YouTube responde "vídeo indisponível" ao ambiente), então o que foi provado são tempos e ordem de chamadas, não áudio.
- **Radio Browser** (2026-10-28, API real): 13 dos 14 estilos testados trouxeram de 2 a 12 emissoras com HTTPS, MP3 ou AAC, em 250 a 900 ms (hip hop com filtro de Brasil veio vazio e passou a buscar no mundo todo).
- **Teste isolado de extração** (2026-10-28, fora do projeto, sem a chave do YouTube, vídeo público "Me at the zoo", nada foi baixado): `@distube/ytdl-core` 4.16.12 foi barrado em 0,4 s com "Sign in to confirm you're not a bot" (e avisou que estava desatualizado). `yt-dlp` 2026.10.26 obteve o endereço de um áudio M4A, mas o endereço traz `ip=` do ambiente que o pediu e vale 6 h. Limite do teste: o ambiente sai por um proxy, que não é o IP da Vercel.

## Hipóteses e o que aconteceu com elas

| Hipótese | Estado |
| --- | --- |
| O iOS só deixa o iframe do YouTube começar sozinho se ele nascer dentro do toque. | **Não sustentada sozinha**: no app instalado o iframe criado no toque ainda foi bloqueado. |
| O início funciona quando a chamada ao player sai dentro do toque e o player já está pronto. | **Sustentada por um caso** (faixa conhecida, 2026-10-27). Por isso o player passa a ser criado em repouso. Não provada. |
| Um vídeo-reserva mudo tocado no toque libera o player (PR #58). | **Retirada**: coincidiu com faixas novas deixarem de tocar a prévia. A causa real pode ter sido o link de prévia vencido (próxima linha); não dá para separar as duas sem o aparelho. |
| Parte das prévias que não tocavam era link vencido. | **Sustentada**: validade de 15 minutos medida, `NotSupportedError` no aparelho. Corrigida no PR #61, já na `main` (renovação do link). Falta confirmar no aparelho. |
| A biblioteca de sessão pode travar no iOS depois de o app ficar fora e segurar a busca do vídeo. | **Hipótese** (uma busca sem resposta por cerca de 90 s). Mitigada no PR #61, já na `main` (espera máxima de 2,5 s, sem deslogar por demora). |
| Cada chamada para iniciar um vídeo que o iOS recusa tira o som da prévia que toca ao lado. | **Inferência sustentada pelo relatório** (pausas sem ação do usuário, com o app visível, logo depois das chamadas ao player), não medição do áudio do iOS. Tratada no PR #62, já na `main` (INV-PLAY-13): com a prévia tocando o player é chamado uma vez só. Falta confirmar no aparelho. |
| O app instalado congela tudo em segundo plano. | **Falsa para áudio nativo** (rádios tocaram) e **verdadeira para o player do YouTube**. O limite é do iframe, não do app instalado. |

## Decisões e opções avaliadas

| Opção | Decisão | Por quê |
| --- | --- | --- |
| Player oficial do YouTube por iframe (`youtubeEngine.ts`) | **Mantida** para faixas específicas. Segundo plano: usar pelo navegador. | Dentro dos termos. É o único caminho para o catálogo geral. No app instalado o iOS o pausa (medido). |
| Extrair o áudio no servidor (`ytdl-core`, `yt-dlp`) e tocar por `<audio>` | **Não adotada** (recomendação feita depois do teste isolado, em 2026-10-28; o usuário seguiu para outras frentes sem pedir esse caminho). | Fere os termos do YouTube e pode afetar a chave usada na busca (documentado, e reconhecido pelas próprias fontes). Medido: o endereço extraído fica preso ao IP (o áudio teria de passar pelo nosso servidor), a biblioteca mais citada foi barrada, e o `yt-dlp` exige um servidor Python próprio, sempre atualizado. De memória: o Safari pede respostas a faixas de bytes; funções da Vercel têm tempo e banda limitados. Só reabrir se o usuário aceitar o risco por escrito e houver um servidor dedicado. |
| Rádios ao vivo por `<audio>` nativo | **Adotada.** Lista curada em `src/data/liveRadios.ts` e emissoras por estilo do Radio Browser (PR #60). | Medido: toca em segundo plano no app instalado. Sem YouTube, sem cota, sem banda de vídeo. Documentado em api.radio-browser.info: API gratuita e aberta, sem garantia de funcionamento, pede `User-Agent` descritivo, passar pelos espelhos e avisar cada clique. Os streams pertencem às emissoras. |
| Spotify Web Playback SDK | **Não adotada.** | O grupo não tem Premium. Documentado: o SDK exige Premium para quem ouve e lista o Safari do iOS com limitação de autoplay ([documentação](https://developer.spotify.com/documentation/web-playback-sdk)). Desde 2026-02 o modo de desenvolvimento exige dono Premium e limita a 5 usuários ([TechCrunch](https://techcrunch.com/2026/02/06/spotify-changes-developer-mode-api-to-require-premium-accounts-limits-test-users/)). Reavaliar se alguém passar a ter Premium. |
| Apple MusicKit JS | **Não avaliada a fundo.** | Exige assinatura Apple Music de cada ouvinte e conta de desenvolvedor Apple. Fórum da Apple diz que a fila não avança com o aparelho bloqueado ([discussão](https://developer.apple.com/forums/thread/699926)), com ressalva de que pode ter sido corrigido. |
| Faixa completa pelo Deezer | **Sem caminho legítimo.** | Não há SDK oficial de faixa completa para terceiros (busca de 2026-10-28). Os projetos encontrados usam credencial privada e endereços internos, fora dos termos. |
| Capacitor (app híbrido com `UIBackgroundModes: audio`) | **Em aberto**: depende de decisão do usuário. | De memória: é o único caminho para segundo plano completo no iPhone (inclusive a hipótese, não verificada, de manter o player oficial dentro do app nativo). Exige Mac com Xcode e, para não expirar em 7 dias, a conta de desenvolvedor Apple de US$ 99 por ano; para os dois amigos, TestFlight. |
| Arquivos de áudio do próprio usuário (Supabase Storage) | **Em aberto**: o usuário preferiu não aprofundar agora. | De memória: `<audio>` nativo, segundo plano garantido como nas rádios. O plano gratuito dá 1 GB (cerca de 250 a 300 MP3 de 128 kbps). Só vale para arquivos que o usuário tem o direito de usar; converter vídeos do YouTube tem o mesmo problema de termos da extração. Falta verificar se o Storage atende pedidos de faixa de bytes de forma que o Safari aceite. |
| Link de prévia do Deezer | **Renovar quando vencido** (PR #61). | Medido: vence em 15 minutos. |

## Sobre as fontes de terceiros consultadas

Três respostas de assistentes de busca foram avaliadas e descartadas nos pontos abaixo. Registrar para não repetir o erro:

- O código de exemplo tinha endereços inválidos (`https://youtube.com{videoId}`), `exec` com texto vindo do cliente (injeção de comando), `crossOrigin = "anonymous"` (o Google não manda CORS nos servidores de mídia, então o áudio falharia) e `highWaterMark: 1 <= 25` (um booleano). Declarava `audio/mpeg` para um formato que é WebM ou M4A.
- Afirmaram que o iframe pausa sozinho ao bloquear a tela: o T04 mostrou o contrário no navegador.
- Sugeriram hospedar `yt-dlp` junto das funções da Vercel, o que não é possível no plano gratuito.
- O ponto válido de todas: o app nativo (Capacitor) com permissão de áudio em segundo plano é o que resolve o app instalado de forma definitiva.

## Divergências conhecidas entre código e documentação

Quatro divergências foram achadas ao escrever este registro (2026-10-28):

1. **`expectPlayback` ignorava `waitMs`**: o código sempre esperava 6 s e o `READY_WATCH_MS` (1,5 s depois de o player carregar), descrito no INV-PLAY-01, nunca valeu. **Decisão:** manter o comportamento real (6 s, recomeçando uma vez quando o player carrega), porque 1,5 s interromperia as tentativas silenciosas (uma faixa começou sozinha em 3,6 s depois de duas tentativas), e corrigir a documentação. O parâmetro passou a ser respeitado. Branch `fix/start-watch-timing`, aguardando PR.
2. **Tentativas silenciosas param quando o estado vira "pausado"**: se o iOS pausa a prévia, `isPlaying` cai e o motor do YouTube para de tentar. **Superada pelo PR #62** (INV-PLAY-13): com a prévia tocando o player passou a ser chamado uma vez só, justamente porque as tentativas repetidas tiravam o som da prévia; sem prévia, as tentativas silenciosas continuam e seguem o estado de reprodução.
3. **O vigia de 6 s era curto para rádio ao vivo** (uma começou a tocar depois de o aviso aparecer). Corrigido no mesmo branch: 15 s para rádio ao vivo (INV-PLAY-12).
4. **Downloads offline de prévia** usavam o link guardado sem renovação. Corrigido no PR #61, já na `main` (INV-PREV-04). Falta confirmar no aparelho.

## Frentes em aberto

Ordenadas pela dependência de decisão do usuário:

1. **Testar no aparelho o que o PR #61 trouxe** (prévia vencida, sessão e download offline de prévia) e colar o relatório de Ajustes > Diagnóstico. Depois disso, atualizar a [matriz](compatibility-matrix.spec.md).
2. **Ouvir as rádios por estilo** (PR #60) no app instalado, com a tela bloqueada por 1 a 2 minutos.
3. **Decidir sobre o app nativo (Capacitor)**: há Mac e conta de desenvolvedor Apple?
4. **Decidir sobre arquivos de áudio próprios** (Supabase Storage): fazer a checagem de faixa de bytes, limites e custo.
5. **Medir o uso da cota da YouTube Data API** a partir dos logs da Vercel (resoluções pela API oficial contra a busca web).
6. **Repetir no aparelho os itens T01 a T15** do [roteiro](validation-checklist.spec.md) que a [matriz](compatibility-matrix.spec.md) ainda marca como não testados.
7. **Tarefas do painel do Supabase** do lado do usuário: Site URL, limites de envio de e-mail e usuários convidados com confirmação automática.
8. **Ativar a regra "Require status checks to pass"** (job `checks`) na `main`, para o merge exigir o CI.
9. **Divergências da seção anterior**: abrir o PR do vigia (itens 1 e 3), no branch `fix/start-watch-timing`.
10. **Melhorias de documentação** ainda não feitas: encurtar o `AGENTS.md`, um fato em um lugar só, rótulos de evidência em todas as seções.
11. **Ruído conhecido, sem impacto no uso**: avisos intermitentes de tempo esgotado do Supabase na verificação profunda de configuração (partida a frio) e o aviso `url.parse()` de uma dependência.
12. **Branches remotos já mergeados** para o usuário apagar (a sessão na nuvem recebe 403 ao tentar): os `docs/*`, `feat/*` e `fix/*` antigos e os desta rodada.
