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
| 2026-10-28 | App instalado, `1fb536dadd54` (tudo até o PR #65) | Quatro faixas de vídeo conhecido começaram sozinhas no primeiro toque (1,6 a 2,5 s). Uma faixa nova tocou a prévia em 1,7 s e a faixa completa assumiu sozinha 3 s depois. Nos logs da Vercel a partida da função mostra a linha de serviços conferidos por `/api/health?deep=1` e não o aviso `auth-settings`. O aviso `url.parse()` (DEP0169, nível de erro na Vercel) continua: não nasce no código do projeto (não reproduzido ao carregar a rota localmente), vem do ambiente da plataforma. |
| 2026-10-28 | App instalado, `af7065795696` (com o PR #61) | A renovação do link vencido funcionou (prévia em 0,8 a 1,2 s). Com a prévia tocando e o player do YouTube sendo chamado ao lado, a prévia parava cerca de 0,5 s depois de cada ▶, três vezes seguidas (`áudio do navegador pausou (app visível, em 2 s)`). Duas "recusas" `AbortError` por toques em sequência rápida. |
| 2026-10-28 | App instalado, `7c75a4f2c1b7` | "Iris": prévia recusada com `NotSupportedError`. "Frantic": prévia em 419 ms. Uma busca de vídeo sem resposta por cerca de 90 s. As faixas do YouTube pararam em segundo plano duas vezes. A "Rádio Globo" (áudio nativo) avançou 7 s com o app fora. |
| 2026-10-28 | App instalado, `ed2e817bd774` (com os PRs #69 e #81), iOS 18.7, sessão `2f0086ffffbe` | "Frantic" (vídeo conhecido no aparelho, resolvido em 8 ms) tocada 1 s depois de o app abrir: o player do YouTube foi criado no próprio toque (21:16:36), ficou pronto 1 s depois, três tentativas silenciosas falharam e, aos 6 s, o aviso "O iPhone não deixou a música começar sozinha" apareceu. Nos logs da Vercel o `feed` dessa sessão saiu 1 s antes do toque (cerca de 21:16:35) e não houve `pré-resolução` (a fila espera 3 s). **Leitura (hipótese, uma ocorrência):** o toque chegou antes dos 2 s de espera para criar o player em repouso, e o script do YouTube só era baixado dentro de `prime()` (o `preload()` documentado nunca era chamado). Corrigido no PR seguinte: `preload()` e `prime()` na abertura do app, e o relatório diz quantos ms depois da abertura o player foi criado. |
| 2026-10-28 | App instalado, `695a4d646324` (com a pré-resolução e o player criado na abertura), iOS 18.7, sessão `d72e8f3b728b` | "Heaven's Call" (faixa nova, nunca pré-resolvida) tocada 36 s depois de o app abrir, com o player **criado ao abrir o app** (2,7 s depois da página) e **pronto** (1,5 s depois de criado): vídeo achado 1,6 s depois do toque (busca web não: oficial, 1,06 s), duas tentativas silenciosas, **nenhum evento de "player carregado"** e aos 6 s o aviso "O iPhone não deixou…". Antes disso as faixas pré-resolvidas e de cache tinham sido consultadas sem erro (5 linhas `pré-resolução`). **Leitura (hipótese):** não era mais a espera do player: um vídeo carregado depois da busca, fora do toque, nem chega a carregar no iOS; só o início dentro do toque libera. Resposta: `unlockPlayback()` (vídeo-reserva mudo no toque, INV-PLAY-10; T26). |
| 2026-10-28 | App instalado, `f2abfa7520bc` (com #85 e #86), iOS 18.7, sessão `f1d7390abc5c` | "Memories" (faixa nova): `player liberado no toque`, vídeo achado em 2,2 s (2 versões, pela segunda opinião), duas tentativas silenciosas e **começou a tocar com o vídeo real carregado 5,3 s depois do toque**: a hipótese do vídeo-reserva se sustenta (antes disso, o mesmo caso falhava). "Give Me Shelter": sem vídeo (confirmado na busca: só Rolling Stones), prévia de 30 s. "For Freedom" (segunda faixa nova da sessão): **falhou de novo** (sem som 6 s depois do toque), e o ▶ iniciou em 454 ms; o vídeo-reserva não tinha rodado, porque só valia uma vez por sessão, e entre as duas o iOS pausou o app e uma prévia assumiu. Leitura: a liberação não é permanente; refeita em todo toque com o player parado. Além disso a barra de tempo da faixa terminou em 0:27 de 6:07: a duração do vídeo-reserva (19 s) ficou. |

### No ambiente de desenvolvimento e nas APIs reais

- **Link de prévia do Deezer** (2026-10-28, API real): o `hdnea=exp=…` vence cerca de 15 minutos depois da consulta (`exp` igual a agora mais 0,25 h). O feed fica em cache por horas (CDN e aparelho): uma lista aberta há mais de 15 minutos traz links mortos.
- **WebKit do ambiente** (2026-10-27): o player do YouTube só carrega de 1,7 a 3,5 s depois do toque, mesmo com a busca do vídeo em 50 ms. O som real não é verificável ali (o YouTube responde "vídeo indisponível" ao ambiente), então o que foi provado são tempos e ordem de chamadas, não áudio.
- **Radio Browser** (2026-10-28, API real): 13 dos 14 estilos testados trouxeram de 2 a 12 emissoras com HTTPS, MP3 ou AAC, em 250 a 900 ms (hip hop com filtro de Brasil veio vazio e passou a buscar no mundo todo).
- **Teste isolado de extração** (2026-10-28, fora do projeto, sem a chave do YouTube, vídeo público "Me at the zoo", nada foi baixado): `@distube/ytdl-core` 4.16.12 foi barrado em 0,4 s com "Sign in to confirm you're not a bot" (e avisou que estava desatualizado). `yt-dlp` 2026.10.26 obteve o endereço de um áudio M4A, mas o endereço traz `ip=` do ambiente que o pediu e vale 6 h. Limite do teste: o ambiente sai por um proxy, que não é o IP da Vercel.

## Hipóteses e o que aconteceu com elas

| Hipótese | Estado |
| --- | --- |
| O iOS só deixa o iframe do YouTube começar sozinho se ele nascer dentro do toque. | **Não sustentada sozinha**: no app instalado o iframe criado no toque ainda foi bloqueado. |
| O início funciona quando a chamada ao player sai dentro do toque e o player já está pronto. | **Sustentada** (faixa conhecida em 2026-10-27; quatro faixas conhecidas e uma nova com a faixa completa assumindo sozinha em 2026-10-28, com o player pronto desde a abertura). Por isso o player é criado em repouso. Ainda n pequeno e uma sessão: não provada. |
| Um vídeo-reserva mudo tocado no toque libera o player (PR #58). | **Retirada**: coincidiu com faixas novas deixarem de tocar a prévia. A causa real pode ter sido o link de prévia vencido (próxima linha); não dá para separar as duas sem o aparelho. |
| Parte das prévias que não tocavam era link vencido. | **Sustentada**: validade de 15 minutos medida, `NotSupportedError` no aparelho. Corrigida no PR #61, já na `main` (renovação do link). Falta confirmar no aparelho. |
| A biblioteca de sessão pode travar no iOS depois de o app ficar fora e segurar a busca do vídeo. | **Hipótese** (uma busca sem resposta por cerca de 90 s). Mitigada no PR #61, já na `main` (espera máxima de 2,5 s, sem deslogar por demora). |
| Cada chamada para iniciar um vídeo que o iOS recusa tira o som da prévia que toca ao lado. | **Inferência sustentada pelo relatório** (pausas sem ação do usuário, com o app visível, logo depois das chamadas ao player), não medição do áudio do iOS. Tratada no PR #62 (player chamado uma vez só) e depois superada: sem prévia ao lado do player (ver a decisão acima). |
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
| Download offline de faixa | **Retirado em 2026-10-28** (decisão do usuário). | O áudio completo vem do player do YouTube, que não entrega arquivo; baixar fere os termos. O botão guardava só a prévia de 30 s. A limpeza do que ficou nos aparelhos é `purgeLegacyDownloads`. A rota `/api/audio` (cópia da prévia) ficou sem uso. Offline de verdade só com arquivos próprios (linha abaixo). |
| Arquivos de áudio do próprio usuário (Supabase Storage) | **Em aberto**: o usuário preferiu não aprofundar agora. | De memória: `<audio>` nativo, segundo plano garantido como nas rádios. O plano gratuito dá 1 GB (cerca de 250 a 300 MP3 de 128 kbps). Só vale para arquivos que o usuário tem o direito de usar; converter vídeos do YouTube tem o mesmo problema de termos da extração. Falta verificar se o Storage atende pedidos de faixa de bytes de forma que o Safari aceite. |
| Prévia de 30 s como ponte enquanto a faixa completa carrega | **Retirada** (decisão do usuário, 2026-10-28). A prévia só toca quando não há faixa completa (sem vídeo, cota do dia acabada) ou ela falhou. | O usuário não via sentido na prévia, e o salto para o início da faixa ao assumir a completa incomodava. Medido: o player pronto desde a abertura começa a faixa completa sozinho (cinco faixas em 2026-10-28). Em troca, uma faixa nova espera alguns segundos; o botão de reproduzir mostra carregamento (anel animado, sem texto). Risco: se o iPhone recusar o início tardio, o aviso e o ▶ resolvem. |
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
4. **Downloads offline de prévia** usavam o link guardado sem renovação. Corrigido no PR #61, mas **sem objeto** desde o PR #68: os downloads foram retirados e o INV-PREV-04 saiu.

### Pré-resolução do vídeo antes do toque (2026-10-28)

**Hipótese (não medida no aparelho):** o iPhone aceita o início automático quando o vídeo já é conhecido no toque (medido, uma sessão de 5 faixas); uma faixa que ninguém tocou espera a busca depois do toque (cerca de 1 a 1,5 s) e falha. **Decisão do usuário:** procurar o vídeo antes do toque das faixas prováveis (as 2 próximas da fila e as 2 primeiras de cada cartão personalizado), em tempo ocioso, uma por vez, até 6 buscas por sessão. **Custo:** cada pré-resolução é uma busca (100 de 10.000 unidades); ela usa o mesmo total diário dos toques e só até 20 de 30 por pessoa, então o máximo de buscas por dia não aumenta (INV-PLAY-14). **Como confirmar:** T23 do roteiro, comparando o início de faixas pré-resolvidas com as outras. **Não resolve** o caso de uma faixa fora das pré-resolvidas (a busca continua no toque); a alternativa mais forte seguem sendo o Capacitor ou arquivos próprios.

## Frentes em aberto

Atualizado em 2026-10-29, depois dos PRs #56 a #100 (o #101 devolve a unidade da cota de busca sem resultado, INV-PLAY-23). Ordenadas pela dependência de decisão do usuário:

1. **Testar no aparelho o que os PRs trouxeram** e colar o relatório de Ajustes > Diagnóstico (a primeira linha traz o código da sessão); atualizar a [matriz](compatibility-matrix.spec.md) no mesmo dia. **Confirmado no aparelho em 2026-10-29** (app instalado, iOS 18.7, relatórios do usuário): pausar e retomar volta à mesma faixa (PR #95, INV-PLAY-20); a barra mantém a duração depois de pausar e retomar (PR #97, INV-PLAY-21; o PR #96 sozinho não bastou); "Heaven's Call" do Akashic toca a versão certa depois do cache descartado (PRs #87 e #90, INV-PLAY-18); com o limite diário em 30 de 30 a faixa nova ainda toca (PR #91, INV-PLAY-19, relato do usuário). **Ainda sem teste no aparelho:** "Não é esta música" com um vídeo realmente errado (PR #99, INV-PLAY-22); o painel de administrador (PR #93, exige criar `ADMIN_EMAILS` na Vercel e novo deploy); letra e fila como vistas do player (PRs #98 e #100, INV-UI-10); a fila inteligente e o disjuntor com a cota do YouTube de fato esgotada (INV-PLAY-15 e 16); a pré-resolução desligada (PR #89, INV-PLAY-14). Os roteiros são T16 a T27 do [roteiro de validação](validation-checklist.spec.md).
2. **A pessoa do Android Redmi (Chrome)**: depois do deploy dos PRs #75 e #76, tentar o login de novo. A causa da tela preta é **hipótese** (GPU de entrada com WebGL sob desfoque, `INV-AUTH-05`). Faltam as respostas dela: a tela escureceu ao enviar o código ou ao voltar do e-mail, abriu pelo ícone ou pelo Chrome, versões do Android e do Chrome. Se continuar, procurar `[Client]` e `route=` com o `sid` dela nos logs da Vercel.
3. **Decidir sobre o app nativo (Capacitor)**: há Mac e conta de desenvolvedor Apple?
4. **Decidir sobre arquivos de áudio próprios** (Supabase Storage): fazer a checagem de faixa de bytes, limites e custo. É também o único caminho para crossfade e para offline de verdade.
5. **Crossfade** (pedido do usuário): registrado, não implementado. Com o player do YouTube no iPhone não é viável (um só iframe, e o iOS recusa começar um segundo vídeo fora do toque); só com `<audio>` e arquivos próprios.
6. **Decidir sobre a rota `/api/audio`** (proxy de áudio): sem uso desde a retirada dos downloads. Removê-la baixa as funções da Vercel de 8 para 7 e exige atualizar o `AGENTS.md` e os testes.
7. **Medir o uso da cota da YouTube Data API** a partir dos logs da Vercel (resoluções pela API oficial contra a busca web); agora os logs têm `uid`, `sid` e `route`, então dá para contar por pessoa.
8. **Repetir no aparelho os itens T01 a T15** do roteiro que a matriz ainda marca como não testados.
9. **Tarefas do painel do Supabase** do lado do usuário: Site URL, limites de envio de e-mail e usuários convidados com confirmação automática.
10. **Configurar o GitHub**: ativar a regra "Require status checks to pass" (job `checks`) na `main`, para o merge exigir o CI, e "Automatically delete head branches" em Settings > General, para os branches mesclados saírem sozinhos.
11. **Retenção dos erros do app**: os logs da Vercel no plano gratuito guardam pouco tempo. Se o usuário sentir falta de histórico, guardar os `[Client]` numa tabela do Supabase (hoje só vão para o log).
12. **Limite de taxa global das rotas**: hoje é por instância; precisa do firewall da Vercel ou de armazenamento compartilhado.
13. **Retirar o campo `featured` de `/api/feed`**: a home não o mostra desde o PR #79; ficou só por compatibilidade com apps abertos. Pode sair depois de as versões antigas sumirem.
14. **Limpezas pequenas de código**: `preferredEngine` e `switchEngineManually` do `AudioContext` não têm tela que os use; `public/assets/aistudio/` guarda um log colado da Vercel.
15. **Melhorias de documentação** ainda não feitas: encurtar o `AGENTS.md`, um fato em um lugar só, rótulos de evidência em todas as seções.
16. **Ruído conhecido, sem impacto no uso**: avisos intermitentes de tempo esgotado do Supabase na verificação profunda de configuração (partida a frio) e o aviso `url.parse()` de uma dependência.
17. **Branches remotos já mergeados** para o usuário apagar (a sessão na nuvem recebe 403 ao tentar): os `docs/*`, `feat/*`, `fix/*` e `chore/*` listados por `git branch -r` que estejam sem commits à frente da `main` (conferir com `git rev-list --count origin/main..<branch>`). Em 2026-10-29 sobravam `fix/duration-from-catalog`, `fix/first-tap-preview-handoff` e `fix/unlock-every-tap`. Para apagar: `git push origin --delete <branch>`.
18. **Ideias de produto sem decisão ainda:** reordenar a fila no botão de fila do player (INV-UI-10); lista permanente de vídeos recusados no "Não é esta música" (tabela e migração manual no Supabase: hoje o vídeo errado só é evitado até o cache da faixa vencer, INV-PLAY-22); ações no painel de administrador (mudar o limite diário e religar a pré-resolução sem novo deploy, com tabela de configuração) e limitar a ação "Não é esta música" ao admin se o grupo de convidados crescer; escolha de qualidade e download só com arquivos próprios (item 4; a extração de vídeo do YouTube segue descartada por decisão do usuário).
