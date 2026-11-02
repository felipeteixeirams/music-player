# Avaliação do Capacitor (app nativo para iPhone)

Pesquisa de 2026-10-30, a pedido do usuário, depois de perguntar como apps como o YouTube e o OiTube tocam em segundo plano e em janela flutuante. **Atualizada em 2026-11-02** com os resultados do laboratório de segundo plano (T32) e com uma pesquisa do usuário sobre plugins de áudio nativo (seção "Pesquisa de 2026-11-02"). Este documento é do master [Integrações musicais](../../masters/music-integrations.md) e complementa o item "Capacitor" de [Fontes de áudio e decisões](audio-sources-decisions.spec.md). **Não decide nada sozinho.**

Marcas de evidência: ✅ medido por mim hoje; 🔎 conferido no código; 📖 fonte lida (link; quase todas são fóruns e blogs, não documentação da Apple); 💭 hipótese ou memória, sem prova.

## Conclusão em poucas linhas

1. O Capacitor coloca o app dentro de um app nativo do iPhone (uma tela web embutida, `WKWebView`). Com isso o app pode pedir ao iOS o modo "áudio em segundo plano", que um PWA não tem.
2. **Para áudio nativo (`<audio>`: podcasts, rádios, arquivos próprios) isso tende a funcionar**, mas os relatos se contradizem sobre a chave ser necessária (ver fontes).
3. **Para o player do YouTube dentro dessa tela web, não há confirmação.** Achei um relato de alguém que ativou a sessão de áudio e o modo de segundo plano e não conseguiu tocar o YouTube embutido em segundo plano, e uma fonte de fornecedor dizendo que o iOS pausa o JavaScript da tela web em segundo plano. Nesta mesma conversa eu disse que o Capacitor era o caminho que na prática dá o segundo plano: isso vale para o áudio nativo, **não está provado para o YouTube**.
4. O Capacitor exige macOS com Xcode 26 ou um serviço de build na nuvem, e uma conta de desenvolvedor Apple paga (US$ 99 por ano) para distribuir pelo TestFlight.
5. A política do YouTube sobre player em segundo plano (item 19 das decisões) vale do mesmo jeito dentro de um app nativo.
6. O caminho de menor risco é um **protótipo curto com critério de parada**. Os passos que antes vinham antes dele (T30 com o áudio mudo) **já foram feitos e falharam** (T32, 2026-11-02): no PWA instalado nada manteve o vídeo do YouTube em segundo plano. Falta só o **D no navegador**, que custa minutos e informa o protótipo (seção "O teste que vem antes do protótipo").

## O que é e o que o app já tem para isso

- ✅ Capacitor 8.6.0 (npm, 2026-10-30). O comando exige Node 22 ou mais novo ([documentação](https://capacitorjs.com/docs/getting-started/environment-setup)): ✅ o ambiente de desenvolvimento tem Node 22.22.
- 📖 Para iOS: macOS e **Xcode 26.0 ou mais novo**, com as ferramentas de linha de comando; o gerenciador de dependências padrão é o Swift Package Manager ([documentação](https://capacitorjs.com/docs/getting-started/environment-setup)).
- 🔎 O app é Vite e React: o `npm run build` gera arquivos estáticos que o Capacitor empacota sem reescrever telas.
- 🔎 O login é por código de 6 dígitos digitado no próprio app (sem link de retorno), então não precisa de ligação por endereço (deep link) para entrar.

## O que o Capacitor resolve e o que não

| Capacidade | Com o Capacitor | Evidência |
| --- | --- | --- |
| Áudio nativo (podcasts, rádios, arquivos próprios) em segundo plano e com a tela bloqueada | Sim, com o modo "Audio, AirPlay e Picture in Picture" ligado e a sessão de áudio em "playback". Um fornecedor de plugins recomenda os dois e, se o `<audio>` ainda parar, usar um plugin de áudio nativo (AVFoundation) | 📖 [guia do Capgo](https://capgo.app/blog/how-to-play-audio-in-the-background-in-capacitor/) (vende plugin). Contradição: um relato diz que sem a chave o áudio continua tocando ([Apple](https://developer.apple.com/forums/thread/713084)), outro diz que sem a chave corta ao ir para segundo plano. Em app nativo o `<audio>` já tocou em segundo plano em relatos antigos ([WebKit 203293](https://bugs.webkit.org/show_bug.cgi?id=203293), iOS 13) |
| Player do YouTube (iframe) em segundo plano | **Não confirmado** | 📖 Relato de quem configurou sessão e modo de segundo plano e não conseguiu ([Apple](https://developer.apple.com/forums/thread/781787)); fornecedor de WebView diz que o iOS pausa o JavaScript em segundo plano ([WebViewGold](https://www.webviewgold.com/support-center/knowledgebase/does-webviewgold-will-support-background-audio-or-audio-playing-on-the-lock-screen-what-should-i-do-if-its-not-working-ios-android/)); um post de 2026 no iOS 26 descreve os mesmos sintomas ([Brave](https://community.brave.app/t/ios-lock-screen-audio-player-bug-number-1/658779/17)) |
| Janela flutuante (Picture-in-Picture) | Possível em app nativo para um `<video>` visível; não para um iframe oculto. O PiP em PWA da tela inicial é um bug aberto do WebKit | 📖 [WebKit 303885](https://bugs.webkit.org/show_bug.cgi?id=303885) |
| Notificação push e selo no ícone | Sim, por plugin nativo, com conta de desenvolvedor | 💭 não pesquisado a fundo (o PWA já tem push no iOS 16.4 ou mais novo, ver a descoberta de funcionalidades) |
| Política do YouTube sobre player em segundo plano | Continua valendo | 📖 [Políticas do YouTube](https://developers.google.com/youtube/terms/developer-policies), item III.I.9 |

## O que o app precisa mudar (🔎 do código)

- **Origem das chamadas à API.** `api/_guard.ts` só aceita pedidos com `Sec-Fetch-Site: same-origin` ou `Origin`/`Referer` do mesmo host. Dentro do Capacitor a página vem de uma origem do próprio app (💭 `capacitor://localhost`), então as chamadas à Vercel seriam de outra origem: 403, e a API ainda não manda cabeçalhos CORS. Há dois caminhos: (a) o app nativo abre o endereço de produção (`server.url`), a página continua da mesma origem da API e as atualizações chegam sem nova versão da loja; ou (b) a página fica dentro do app e a API passa a aceitar a origem do app (mudança em `api/_guard.ts`, `server.ts` e cabeçalhos, mais um endereço base absoluto no `apiFetch`).
- **Embed do YouTube.** O iframe manda `origin` com o endereço da página. 💭 Embeds do YouTube costumam falhar quando a página vem de um esquema que não é http ou https; abrir o endereço de produção (caminho a) evita isso. Não verifiquei.
- **Service worker.** 💭 Telas web embutidas têm restrições para service worker; o app não depende dele para funcionar (o início offline usa o `localStorage`), mas o `public/sw.js` pode não rodar.
- **Interface de PWA.** O botão de instalar e o aviso de nova versão perdem o sentido (com o caminho b a versão só muda com uma nova versão do app).
- **O resto** (Supabase, sincronização, histórico, podcasts, capas) é código da página e roda igual.

## Distribuição e custo

| Opção | O que exige | Evidência |
| --- | --- | --- |
| Mac próprio | macOS com Xcode 26 | 📖 documentação do Capacitor |
| Build na nuvem, sem Mac | Serviços que compilam em Macs deles, assinam e mandam ao TestFlight a partir de qualquer sistema: [Capgo Build](https://capgo.app/docs/builder/), [Capawesome](https://capawesome.io/solutions/build-without-mac/), Codemagic. Preço dos serviços não verificado. A assinatura ainda precisa de credenciais da Apple | 📖 páginas dos próprios serviços |
| Conta de desenvolvedor Apple | US$ 99 por ano (pessoa física) para TestFlight e App Store; a conta grátis só instala em aparelho próprio | 📖 fóruns e blogs; 💭 de memória: a instalação com conta grátis expira em 7 dias e os builds do TestFlight em 90 dias (não confirmado nas fontes) |
| App Store pública | Revisão da Apple: a regra 4.2 reprova app que é só um site empacotado; relatos de reprovação mesmo com recursos nativos acrescentados | 📖 [MobiLoud](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper), [Apple Developer Forums](https://developer.apple.com/forums/thread/812889) (fontes de terceiros; o texto da Apple não foi lido) |
| TestFlight só para o grupo (3 a 5 pessoas) | Conta paga; 💭 testadores internos costumam dispensar a revisão completa (não confirmado) | 💭 |

## Comparação dos caminhos

| Caminho | Segundo plano do YouTube | Custo e esforço | Risco |
| --- | --- | --- | --- |
| PWA como está | Pausa no app instalado (medido); segue no navegador | Zero | Política do YouTube (player oculto) |
| PWA com o experimento do áudio mudo | ✅ **Refutado** em três medições (INV-PLAY-25), e o recurso foi removido. Também não funcionaram: iframe visível, `audioSession`, `mediaSession`, rádio em paralelo (T32, 2026-11-02) | — | — |
| Capacitor com o iframe do YouTube | **Não confirmado** | Mac ou build na nuvem, US$ 99 por ano, algumas mudanças de origem | Pode não resolver nada; política do YouTube; revisão da Apple |
| Capacitor com áudio nativo e arquivos próprios | Sim para o que tem arquivo (podcasts e rádios). **Arquivos próprios (Supabase Storage) foram descartados em 2026-11-02** | Só podcasts e rádios, que o PWA já toca em segundo plano | — |
| Usar pelo navegador (Safari ou Edge) | Segue tocando (medido em 2026-10-25) | Zero | Menos "app"; sem tela inicial |

## Pesquisa de 2026-11-02 (plugins de áudio nativo e o que eles resolvem)

O usuário trouxe uma pesquisa que conclui que o problema não é manter o PWA vivo, e sim manter o **vídeo do YouTube** tocando dentro de um PWA instalado, e que sugere Capacitor com um plugin de áudio nativo. Conferência feita aqui:

- ✅ **A premissa bate com as medições do T32** (2026-11-02, iPhone 11, iOS 18.7): o `<audio>` segue tocando fora do app e o vídeo do YouTube pausa no instante da saída, visível ou oculto, com ou sem `audioSession`, `mediaSession` e áudio nativo ao lado. Ver a [matriz de compatibilidade](compatibility-matrix.spec.md).
- 📖 **O que a Apple exige para áudio em segundo plano em app nativo** (citado na pesquisa; a documentação da Apple não foi lida aqui): `AVAudioSession` com a categoria `playback`, o modo de fundo `audio` em `UIBackgroundModes` e o recurso "Background Modes" no projeto do Xcode. É capacidade de app nativo e não dá para pedir isso a um PWA.
- 📖 **Plugins candidatos, conferidos no registro do npm e nos READMEs em 2026-11-02** (nada foi instalado nem testado; o iOS não foi rodado). Uma primeira versão desta seção, baseada só em resumos de busca, trazia um dado errado sobre o `@smartcompanion` (versão 0.3.0 e 25 downloads, de um espelho desatualizado) e foi corrigida:

| Plugin | Registro do npm (2026-11-02) | O que o README diz |
| --- | --- | --- |
| `@smartcompanion/native-audio-player` | 2.0.0, publicado em 2026-10-29, criado em 2025-07-06, 10 versões, cerca de 940 downloads no mês, BSD-2-Clause, exige Capacitor 8 ou mais novo | iOS 15 ou mais novo; áudio nativo em segundo plano, controles na tela de bloqueio e na notificação, playlists, saída pelo fone de ouvido ou alto-falante; é preciso ligar "Audio" em Background Modes no Xcode; `http` puro é recusado pelo App Transport Security |
| `@capgo/capacitor-native-audio` (nome atual; o antigo `@capgo/native-audio` parou na 8.4.2, 2026-04-20) | 8.4.38, publicado em 2026-10-19, criado em 2026-05-28 sob esse nome, 36 versões, cerca de 63 mil downloads no mês, MPL-2.0 | AVFoundation no iOS; arquivos locais, URLs `https` e HLS; "Tocando agora" com `MPNowPlayingInfoCenter` e `MPRemoteCommandCenter`; o recurso `backgroundPlayback` é **só de Android** (o README diz que o iOS já tem segundo plano pela `AVAudioSession`); ligar as notificações no iOS **interrompe** o áudio de outros apps (Spotify, Apple Music) |
| `@mediagrid/capacitor-native-audio` | 3.0.0, publicado em 2026-01-23, criado em 2024-08-07, 13 versões, cerca de 6,9 mil downloads no mês, MIT, exige Capacitor 8 ou mais novo | "Tocar áudio por URL, nativo, junto com áudio em segundo plano"; o README completo não foi lido |
| `capacitor-media-session` | 0.1.8, publicado em **2021-05-08**, cerca de 34 downloads no mês, exige **Capacitor 3** | **Abandonado e incompatível com o Capacitor 8**: descartado |
| `@capacitor-community/native-audio` | 8.0.0, publicado em 2025-12-30, cerca de 47 mil downloads no mês, MIT | Pelos resumos de busca, voltado a efeitos sonoros curtos (o README não foi lido aqui); não é o plugin de segundo plano |

- 💭 **O que esses plugins não resolvem para este projeto.** Eles tocam uma **URL de áudio**. A faixa do YouTube não entrega URL de áudio, e extrair ou baixar está descartado. O que tem URL (rádios, podcasts e a prévia de 30 s do Deezer) **já toca em segundo plano no PWA** (T32, casos A e B). Um plugin nativo traria controles da tela de bloqueio e mais robustez nesses casos, não o YouTube. Por isso o "experimento 2" da pesquisa (Capacitor com plugin de áudio) só vale se o Capacitor virar o caminho por outro motivo.
- 📖 **O experimento que decide é o do iframe dentro do app nativo**, e a evidência externa não é animadora: um relato no [Apple Developer Forums](https://developer.apple.com/forums/thread/781787) de um `WKWebView` com YouTube que não manteve o áudio em segundo plano mesmo com o modo `audio` e sessão `playback` ativos (o registro de erros do relato aponta para permissões do WebKit); perguntas [sem resposta confirmada](https://reddit.birdcat.cafe/r/howdidtheycodeit/comments/1k36uy0/how_do_apps_like_musi_and_demus_enable_background) sobre como o Musi e o Demus fazem; e uma [pergunta antiga](https://kiwix.lema.org/stackoverflow.com_en_all_2023-11/questions/45897456/uiwebview-play-audio-when-app-goes-to-background) em que um comentário (não verificado) diz que tocar áudio do YouTube sem mostrar o vídeo fere os termos e pode levar à rejeição na App Store. Nada específico de Capacitor foi encontrado.

## O teste que vem antes do protótipo: o navegador e a tela bloqueada

**Resultado do caso D no navegador (Edge, o relatório informa iOS 27.0, 2026-11-02):** o laboratório (caso D, duas vezes) e o app de verdade (faixa "Stereo Love") **pausaram ao trocar de app** (sair para a tela inicial, sem bloquear a tela), com `avançou 0 s`. Isso **não reproduz o T04** (2026-10-25), em que o Edge seguiu tocando com a **tela bloqueada**.

Pelo critério anterior ("se pausa também no navegador, é provável que o próprio player do YouTube pause com a página oculta"), o Capacitor perderia força. Mas **a tela bloqueada nunca foi medida no laboratório** (todos os testes de navegador foram troca de app), e o T04 foi com tela bloqueada. Duas explicações ainda em aberto:

- 💭 Trocar de app e bloquear a tela são casos diferentes para o iOS, e o T04 só tocou porque bloqueou a tela. Nesse caso "usar pelo navegador com a tela bloqueada" pode continuar sendo uma saída, e o app nativo pode se comportar de outro jeito.
- 💭 O iOS mudou desde 2026-10-25 (o Edge informa `iOS 27.0`; o Safari informa `18.7`, número que talvez seja limitado pelo próprio navegador). A versão real do aparelho não foi conferida.

**Teste que decide (2 minutos cada):** o caso D do laboratório e uma faixa normal do app, no **Edge** e no **app instalado**, com a **tela bloqueada por 1 minuto** (o laboratório agora pede para escolher a saída e a registra no relatório). Conferir também a versão real do iOS em Ajustes, Geral, Sobre.

- Se tocar com a tela bloqueada no navegador (e pausar no app instalado), a regra depende do jeito de sair e do modo; o protótipo do Capacitor continua válido.
- Se pausar com a tela bloqueada também, o T04 deixou de valer, e o Capacitor só vale se alguém quiser testar mesmo assim, por conta e risco.

## Protótipo com critério de parada (se houver Mac ou build na nuvem)

Objetivo: responder em um dia se o iframe do YouTube sobrevive em segundo plano dentro do app nativo, antes de investir em qualquer adaptação. **Só o experimento do iframe**; sem plugin de áudio, sem mexer em fontes.

1. Capacitor com uma tela que abre o endereço de produção (`server.url`), o modo "Audio, AirPlay e Picture in Picture" ligado e a sessão de áudio em "playback".
2. Instalar no aparelho e usar o **Laboratório de segundo plano** (casos D e C, roteiro T32) dentro do app nativo, com um vídeo incorporável, e repetir com uma rádio (caso A) como controle. Medir: saída por 30 s, depois **tela bloqueada por 5 minutos**, copiando o relatório do laboratório.
3. **Parar** se o vídeo pausar: o Capacitor não resolve o YouTube, e o ganho passa a ser só áudio nativo (que o PWA já faz). **Continuar** se tocar por 5 minutos com a tela bloqueada: aí vem a decisão de política (item 19) antes de qualquer adaptação, e a revisão da App Store (regra 4.2 e a política do YouTube sobre player "não exibido").
4. Registrar o resultado na [matriz de compatibilidade](compatibility-matrix.spec.md) com uma coluna ou linha "app nativo (Capacitor)".

## Casco no repositório (2026-11-02)

O casco do protótipo está em [`native/capacitor/`](../../../native/capacitor/README.md): Capacitor 8.6, a tela nativa abre o endereço de produção (`server.url`), projeto iOS gerado por `npx cap add ios` com o modo de fundo `audio` no `Info.plist` e a sessão `AVAudioSession` em `playback` no `AppDelegate.swift`. Ele é isolado do app web (próprio `package.json`, fora do `npm ci` da raiz e do `tsc`) e traz o passo a passo para o Mac e o roteiro de teste com o Laboratório. **Foi gerado no Linux e nunca compilado nem rodado**: pode precisar de ajustes no Xcode. 🔎 Conferido no código do Capacitor 8.6.0: o `WKWebView` já usa `allowsInlineMediaPlayback = true` e `mediaTypesRequiringUserActionForPlayback = []`. O resultado do teste ainda não existe.

## Recomendação

1. **Rodar a tela bloqueada** (caso D do laboratório e uma faixa normal, no Edge e no app instalado, 1 minuto): é o que falta do T32. O caso D no navegador por troca de app já foi feito (2026-11-02) e pausou.
2. Só se o vídeo tocar com a tela bloqueada em algum ambiente e o grupo quiser mesmo o YouTube em segundo plano: fazer o protótipo acima, **só do iframe**. Hoje **não vale** assumir US$ 99 por ano e um Mac (ou serviço de build) por uma promessa que a pesquisa não sustenta para o YouTube.
3. **Não escolher plugin de áudio agora.** Se um dia o Capacitor virar o caminho por outro motivo, os candidatos vivos são o `@smartcompanion/native-audio-player` (mais focado em segundo plano e tela de bloqueio, mais novo e com bem menos uso), o `@capgo/capacitor-native-audio` (mais usado, MPL-2.0, mas atenção ao recurso de interromper outros apps no iOS) e o `@mediagrid/capacitor-native-audio`; escolher instalando cada um num app em branco e testando no iPhone. O `capacitor-media-session` está abandonado.
4. Se o objetivo for "app de verdade" para podcasts e rádios, o PWA já toca isso em segundo plano; o Capacitor traria push mais estável e a presença na tela inicial como app, não o áudio.

## Perguntas para o usuário

- Há um Mac, ou prefere um serviço de build na nuvem? Aceita a conta de desenvolvedor de US$ 99 por ano?
- Quantas pessoas do grupo usam iPhone e quantas Android? (O Android não foi avaliado aqui.)
- Importa mais o YouTube em segundo plano ou o áudio nativo (podcasts e rádios) que já funciona? (Arquivos próprios foram descartados.)
- Você roda a tela bloqueada (Edge e app instalado)? É o passo que decide se o protótipo compensa.

## Registro de decisões

| Data | Decisão | PR |
| --- | --- | --- |
| — | Nenhuma ainda | — |
