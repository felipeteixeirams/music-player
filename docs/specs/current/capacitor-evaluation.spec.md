# Avaliação do Capacitor (app nativo para iPhone)

Pesquisa de 2026-10-30, a pedido do usuário, depois de perguntar como apps como o YouTube e o OiTube tocam em segundo plano e em janela flutuante. Este documento é do master [Integrações musicais](../../masters/music-integrations.md) e complementa o item "Capacitor" de [Fontes de áudio e decisões](audio-sources-decisions.spec.md). **Não decide nada sozinho.**

Marcas de evidência: ✅ medido por mim hoje; 🔎 conferido no código; 📖 fonte lida (link; quase todas são fóruns e blogs, não documentação da Apple); 💭 hipótese ou memória, sem prova.

## Conclusão em poucas linhas

1. O Capacitor coloca o app dentro de um app nativo do iPhone (uma tela web embutida, `WKWebView`). Com isso o app pode pedir ao iOS o modo "áudio em segundo plano", que um PWA não tem.
2. **Para áudio nativo (`<audio>`: podcasts, rádios, arquivos próprios) isso tende a funcionar**, mas os relatos se contradizem sobre a chave ser necessária (ver fontes).
3. **Para o player do YouTube dentro dessa tela web, não há confirmação.** Achei um relato de alguém que ativou a sessão de áudio e o modo de segundo plano e não conseguiu tocar o YouTube embutido em segundo plano, e uma fonte de fornecedor dizendo que o iOS pausa o JavaScript da tela web em segundo plano. Nesta mesma conversa eu disse que o Capacitor era o caminho que na prática dá o segundo plano: isso vale para o áudio nativo, **não está provado para o YouTube**.
4. O Capacitor exige macOS com Xcode 26 ou um serviço de build na nuvem, e uma conta de desenvolvedor Apple paga (US$ 99 por ano) para distribuir pelo TestFlight.
5. A política do YouTube sobre player em segundo plano (item 19 das decisões) vale do mesmo jeito dentro de um app nativo.
6. O caminho de menor risco é um **protótipo curto com critério de parada**, depois de rodar o T30 e o experimento do áudio mudo no PWA.

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
| PWA com o experimento do áudio mudo | 💭 desconhecido (T30 com a chave) | Já está no código | Pode não funcionar; mesma política |
| Capacitor com o iframe do YouTube | **Não confirmado** | Mac ou build na nuvem, US$ 99 por ano, algumas mudanças de origem | Pode não resolver nada; política do YouTube; revisão da Apple |
| Capacitor com áudio nativo e arquivos próprios | Sim para o que tem arquivo (podcasts, rádios, Supabase Storage) | O mesmo, mais o armazenamento e a decisão sobre arquivos próprios | Direitos sobre os arquivos |
| Usar pelo navegador (Safari ou Edge) | Segue tocando (medido em 2026-10-25) | Zero | Menos "app"; sem tela inicial |

## Protótipo com critério de parada (se houver Mac ou build na nuvem)

Objetivo: responder em um dia se o iframe do YouTube sobrevive em segundo plano dentro do app nativo, antes de investir em qualquer adaptação.

1. Capacitor com uma tela que abre o endereço de produção, o modo "Audio, AirPlay e Picture in Picture" ligado e a sessão de áudio em "playback".
2. Instalar no aparelho e repetir o **T30** (trocar de aplicativo por 1 minuto e bloquear a tela por 1 minuto) com uma faixa do YouTube, um episódio de podcast e uma rádio, copiando o Diagnóstico (agora com as linhas do estado do player).
3. **Parar** se a faixa do YouTube pausar: o Capacitor não resolve o YouTube, e o ganho passa a ser só áudio nativo (que o PWA já faz). **Continuar** se tocar: aí vem a decisão de política (item 19) antes de qualquer adaptação.

## Recomendação

1. Antes de qualquer protótipo: rodar o T30 no PWA, com e sem a chave do áudio mudo. É de graça e pode resolver ou, pelo menos, medir o problema.
2. Só se o T30 mostrar que o PWA não dá e o grupo quiser mesmo o YouTube em segundo plano: fazer o protótipo acima. Hoje **não vale** assumir US$ 99 por ano e um Mac (ou serviço de build) por uma promessa que a pesquisa não sustenta para o YouTube.
3. Se o objetivo for "app de verdade" para podcasts, rádios e arquivos próprios, o PWA já toca isso em segundo plano; o Capacitor traria push mais estável e a presença na tela inicial como app, não o áudio.

## Perguntas para o usuário

- Há um Mac, ou prefere um serviço de build na nuvem? Aceita a conta de desenvolvedor de US$ 99 por ano?
- Quantas pessoas do grupo usam iPhone e quantas Android? (O Android não foi avaliado aqui.)
- Importa mais o YouTube em segundo plano ou ter áudio próprio (podcasts, rádios e arquivos) que já funciona?

## Registro de decisões

| Data | Decisão | PR |
| --- | --- | --- |
| — | Nenhuma ainda | — |
