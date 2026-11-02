# Casco nativo (Capacitor) para testar o segundo plano do YouTube

Protótipo **isolado**: não faz parte do app web nem do `npm ci` da raiz (tem o próprio `package.json` e `package-lock.json`). Contexto, motivo e critério de parada: [Avaliação do Capacitor](../../docs/specs/current/capacitor-evaluation.spec.md).

**O que testa:** se o iframe do YouTube continua tocando com o app em segundo plano e com a tela bloqueada quando o app é **nativo** (uma tela `WKWebView` dentro de um aplicativo iOS), já que no PWA instalado ele pausa no instante da saída (T32, 2026-11-02). **Não testa** plugins de áudio nativo, fontes de áudio nem nada além disso.

## O que está pronto (e o que não foi verificado)

- Configuração do Capacitor 8 (`capacitor.config.ts`): a tela nativa abre o endereço de produção (`server.url`), então a origem é a mesma da API e `api/_guard.ts` **não muda**.
- Projeto iOS gerado por `npx cap add ios` (em `ios/`), com dois ajustes feitos à mão:
  - `ios/App/App/Info.plist`: `UIBackgroundModes` com `audio` (o mesmo que ligar "Audio, AirPlay e Picture in Picture" em Background Modes no Xcode);
  - `ios/App/App/AppDelegate.swift`: sessão de áudio `AVAudioSession` na categoria `playback`, ativada na abertura (o Capacitor não a define sozinho).
- 🔎 Conferido no código do Capacitor 8.6.0 (`CAPBridgeViewController.swift`): o `WKWebView` já usa `allowsInlineMediaPlayback = true` e `mediaTypesRequiringUserActionForPlayback = []`.
- ⚠️ **Nada disso foi compilado nem rodado**: foi gerado no Linux, onde não há Xcode. Pode precisar de ajustes ao abrir no Xcode (assinatura, versão mínima do iOS, mensagens do compilador).

## O que você precisa

- Um **Mac com Xcode 26 ou mais novo** (ou um serviço de build na nuvem; ver a spec) e **Node 22 ou mais novo**.
- Uma conta da Apple. Para instalar no seu próprio iPhone pelo Xcode basta a conta gratuita; para o TestFlight, a de desenvolvedor (US$ 99 por ano). 💭 A validade das instalações com conta gratuita não foi confirmada.
- O iPhone em modo de desenvolvedor (Ajustes, Privacidade e Segurança, Modo de Desenvolvedor).

## Passo a passo no Mac

```bash
cd native/capacitor
npm install
npm run sync      # copia a configuração para o projeto iOS (gera ios/App/App/capacitor.config.json)
npm run open      # abre o projeto no Xcode
```

No Xcode:
1. Selecione o target **App**, aba **Signing & Capabilities**: escolha o seu **Team** (muda o *Bundle Identifier* se o `br.com.aurastream.casco` já estiver em uso).
2. Confirme em **Signing & Capabilities** que **Background Modes** mostra **Audio, AirPlay, and Picture in Picture** marcado. Se não aparecer, clique em **+ Capability**, adicione Background Modes e marque essa opção (o `Info.plist` já traz a chave).
3. Conecte o iPhone, escolha-o como destino e rode (▶). No iPhone, confie no desenvolvedor em Ajustes, Geral, VPN e Gerenciamento de Dispositivo.

Para ver o console do app nativo: Safari no Mac, menu **Desenvolver**, o iPhone, a página (a depuração está ligada na configuração).

## Teste (use o Laboratório de segundo plano, `INV-PLAY-26`)

1. Entre no app com a sua conta e vá em Ajustes, Administração, **Laboratório de segundo plano**.
2. **Controle:** caso **A** (rádio), toque, saia do app por 30 s e volte. Esperado: a rádio segue (`áudio avançou X s`).
3. **Caso D** (YouTube oculto, como o app): toque em Iniciar e toque na tela até o vídeo tocar; saia por 30 s e volte; copie o relatório. Depois repita **bloqueando a tela por 5 minutos**.
4. Repita com o **caso C** (YouTube visível) se o D pausar.
5. Cole os relatórios na conversa com o agente.

## Critério de parada

- **Parar** se o vídeo pausar ao sair do app (`vídeo: pausado` junto de `SAIU DO APP`, `vídeo avançou 0.0 s`): o app nativo não resolve o YouTube e o Capacitor não vale o custo para isso.
- **Continuar** só se o vídeo tocar por 5 minutos com a tela bloqueada. Aí vêm, antes de qualquer adaptação, a decisão sobre a [política do YouTube](../../docs/specs/current/audio-sources-decisions.spec.md) (player "não exibido") e a revisão da App Store (regra 4.2).

## Se o app abrir em branco ou mostrar o texto "Casco de teste"

O endereço de produção (`PRODUCTION_URL` em `capacitor.config.ts`) não carregou: confira o domínio, a rede do iPhone e rode `npm run sync` de novo depois de mudar o endereço.

## Manutenção

- O Capacitor atualiza `ios/` com `npx cap sync ios`; os dois ajustes feitos à mão (`Info.plist` e `AppDelegate.swift`) precisam ser conferidos depois de uma atualização maior.
- `ios/App/App/capacitor.config.json`, `ios/App/App/public` e `ios/App/Pods` são gerados e ficam fora do Git.
- Este diretório pode ser apagado inteiro se o protótipo for descartado; nada no app web depende dele.
