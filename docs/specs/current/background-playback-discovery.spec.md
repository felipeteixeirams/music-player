# Discovery: faixa completa com a tela bloqueada (iPhone)

Status: **discovery, nada implementado e nenhuma decisão tomada** (2026-11-28). Pertence ao master [Integrações musicais e reprodução](../../masters/music-integrations.md). Cobre os gaps P1 e P2 da auditoria de 2026-11-28: a faixa completa para quando o app sai da tela no iPhone, e não existe solução definitiva para o áudio completo.

Rótulos de evidência: ✅ medido neste projeto (o número do teste está ao lado); 🔎 conferido no código; 📖 fonte externa (link; a maioria é fórum ou bug report, não documentação oficial da Apple); 💭 hipótese, sem prova.

## Pergunta

Existe uma fonte de faixa completa que toque com a tela bloqueada e com o app fora de foco no iPhone, sem violar a política do provedor, e a que custo?

## O que já sabemos

- ✅ O player do YouTube (iframe oculto ou visível) pausa quando o app sai da tela, no app instalado, com ou sem `audioSession`/`mediaSession`, com áudio mudo ao lado ou com uma rádio tocando (T32, 2026-11-02, [master](../../masters/music-integrations.md), INV-PLAY-26).
- ✅ Áudio nativo (`<audio>`) segue tocando com o app fora: o caso A do laboratório (rádio) avançou 3,1 s em 3 s no app instalado (2026-11-02). É o mesmo caminho dos podcasts e das rádios.
- 🔎 O app já usa `<audio>` nativo para rádios e episódios de podcast (INV-POD-01). Uma fonte de faixa completa que entregue um arquivo de áudio pelo mesmo caminho herdaria esse comportamento.
- 📖 Deezer: a API devolve prévias de 30 s, e a própria FAQ de desenvolvedores diz que a restrição é sobre streaming das faixas. Faixa completa exige acordo comercial ([FAQ Deezer](https://support.deezer.com/hc/en-gb/articles/360011538897-Deezer-FAQs-For-Developers), [diretrizes](https://developers.deezer.com/guidelines)). Deezer, portanto, **não** é fonte de faixa completa para este app.

## Alternativas avaliadas

| # | Alternativa | O que diz a evidência | Esforço e custo | Avaliação |
|---|---|---|---|---|
| A | Aceitar o limite e comunicar | ✅ T32 | Nenhum | Estado atual. Precisa de decisão sobre o comportamento com a tela bloqueada (Q3) |
| B | **Jamendo** (músicas sob licença Creative Commons, com streaming de MP3 pela API) | 💭 a API é gratuita com chave de cliente e entrega arquivo MP3 completo, então usaria o mesmo `<audio>` dos podcasts. **A licença de streaming e a atribuição precisam ser conferidas nos termos atuais antes de qualquer uso.** | Baixo: a prova de conceito já estava prevista e falta só a chave do usuário | Candidata a piloto. Catálogo independente, não o mainstream |
| C | **Apple Music** (MusicKit JS, com o token do desenvolvedor e a assinatura do ouvinte) | 📖 fóruns relatam que, no iPhone, a fila para no fim de cada faixa com a tela bloqueada ([fórum Apple 699926](https://developer.apple.com/forums/thread/699926)), e que o JavaScript fica suspenso com a tela apagada ([WebKit 221413](https://bugs.webkit.org/show_bug.cgi?id=221413)). 📖 o problema de PWA instalada com áudio que para ao sair do app é antigo, de 2019 em diante ([WebKit 198277](https://bugs.webkit.org/show_bug.cgi?id=198277)). 💭 não medido neste projeto | Exige conta de desenvolvedor Apple (taxa anual; valor a conferir no site da Apple) e assinatura do ouvinte. Precisa de caso de laboratório antes de qualquer decisão |
| D | **Spotify Web Playback SDK** | 📖 exige Premium; relatos de falha em iOS e de áudio que para em segundo plano ([fórum Spotify](https://community.spotify.com/t5/Spotify-for-Developers/Web-Playback-SDK-should-work-on-iOS-13-4-but-it-does-not/td-p/5232605)). 📖 o acesso ao `preview_url` foi restringido para apps novos, e há pedidos de restauração ([fórum Spotify](https://community.spotify.com/t5/Spotify-for-Developers/Request-to-Restore-Access-to-preview-url-in-API-Responses-for/td-p/7012597)) | Alto: aprovação, Premium do ouvinte, dependência de uma política que muda | **Descartar por ora** |
| E | App nativo (Capacitor ou Swift) com o modo de áudio em segundo plano | 💭 resolve o áudio nativo em segundo plano (já medido no `<audio>`), mas **não resolve a origem da faixa**: a Deezer não entrega faixa completa, e o YouTube continua proibido de ser extraído (F). O YouTube dentro de um WKWebView nativo não foi medido (💭 o relatório de Apple sobre picture-in-picture em WKWebView é de outro uso) | Alto: exige Mac ou build em nuvem (o projeto registrou que não há Mac, [avaliação do Capacitor](capacitor-evaluation.spec.md)), conta Apple Developer e distribuição | Adiado. Só faz sentido com uma fonte de faixa completa definida |
| F | Extrair o áudio do YouTube no servidor e tocar com `<audio>` | 📖 a política do YouTube proíbe "oferecer ao usuário a possibilidade de baixar ou separar faixas de áudio" e cita, como exemplo proibido, serviço que oferece MP3 do áudio de um vídeo ([política de desenvolvedor](https://developers.google.com/youtube/terms/developer-policies-guide)). A política diz que o acesso à API pode ser suspenso ou encerrado | Baixo técnico, alto risco: suspensão da chave e risco jurídico | **Rejeitar.** Não recomendar nem implementar |

## Recomendação (💭 até a medição)

1. **Manter o YouTube para primeiro plano**, como está, e tratar o segundo plano como limite conhecido (alternativa A), com a comunicação que você decidir em Q3.
2. **Piloto com Jamendo (B)** para faixas em segundo plano: a prova de conceito já estava prevista e só depende da chave. Antes de qualquer uso, conferir os termos de streaming e de atribuição.
3. **Medir MusicKit JS (C) num caso isolado** no laboratório, com a tela bloqueada e com o app instalado, antes de decidir sobre a conta de desenvolvedor. Sem medição, não recomendo gastar com a conta.
4. **Rejeitar F e D.** F viola a política de uma API da qual o app depende. D tem o mesmo problema de origem e uma política de API que muda.

## Decisões para você (domínio)

Cada item tem o contexto, as alternativas e a minha recomendação. Não vou implementar nenhum sem sua resposta.

**Q1. Qual fonte para faixa completa em segundo plano?**
- Contexto: hoje a faixa completa vem do YouTube oculto, que para com a tela bloqueada no iPhone. Os outros caminhos (Deezer, Apple Music, Spotify) têm limites de licença, conta ou política descritos acima.
- Alternativas: (a) Jamendo como piloto, com catálogo independente e licença CC; (b) Apple Music, para quem tem assinatura, depois de medição; (c) manter só o YouTube, sem segundo plano.
- **Recomendação: (a) como piloto, mais (c) como estado atual.** (b) só depois de medir.

**Q2. Pagar a conta de desenvolvedor Apple para testar MusicKit?**
- Contexto: MusicKit exige token de desenvolvedor, que vem com a conta paga (valor a conferir no site da Apple). O custo só se justifica se o teste de laboratório der resultado positivo.
- Alternativas: (a) pagar agora; (b) medir antes sem conta, se a Apple permitir algum teste; (c) não testar.
- **Recomendação: (c) por enquanto.** Antes disso, a prova de conceito do Jamendo (Q1a) tem custo zero.

**Q3. O que o app faz quando a tela é bloqueada e a faixa é do YouTube?**
- Contexto: hoje a faixa para em silêncio, sem aviso, e a rádio e os podcasts seguem.
- Alternativas: (a) pausar e mostrar um aviso ao voltar; (b) trocar automaticamente para a prévia de 30 s (não recomendo: a pessoa ouviria um trecho sem avisar); (c) seguir a fila por faixas de Jamendo, quando houver, e pausar as outras.
- **Recomendação: (a) agora**, e (c) quando o piloto de Jamendo existir.

**Q4. Reabrir o app nativo?**
- Contexto: o nativo resolve o áudio em segundo plano mas não a origem da faixa (ver E). Só vale se Q1 tiver uma fonte definida.
- Alternativas: (a) continuar adiado; (b) abrir um ponto de decisão com Mac ou build em nuvem.
- **Recomendação: (a).**

## Próximos passos (depois das respostas)

1. Se Q1 for (a): conferir os termos do Jamendo, pedir a chave e fazer a prova de conceito com `<audio>`, no mesmo formato de INV-POD-01.
2. Se Q3 for (a): texto do aviso e um teste de ponta a ponta com a tela bloqueada simulada (`visibilitychange`), sem depender do aparelho.
3. Se Q2 for (c): nada a fazer. Reabrir a medição do MusicKit quando houver decisão de conta.
4. Registrar as respostas aqui, com a data, e atualizar o item 19 de [Fontes de áudio e decisões](audio-sources-decisions.spec.md).

## Fontes

- [FAQ de desenvolvedores da Deezer](https://support.deezer.com/hc/en-gb/articles/360011538897-Deezer-FAQs-For-Developers)
- [Diretrizes da Deezer](https://developers.deezer.com/guidelines)
- [Política de desenvolvedor do YouTube](https://developers.google.com/youtube/terms/developer-policies-guide)
- [Fórum Apple: MusicKit JS, fila em segundo plano](https://developer.apple.com/forums/thread/699926)
- [WebKit 221413: JavaScript suspenso com a tela apagada](https://bugs.webkit.org/show_bug.cgi?id=221413)
- [WebKit 198277: PWA instalada para de tocar ao sair da tela](https://bugs.webkit.org/show_bug.cgi?id=198277)
- [Fórum Spotify: Web Playback SDK no iOS](https://community.spotify.com/t5/Spotify-for-Developers/Web-Playback-SDK-should-work-on-iOS-13-4-but-it-does-not/td-p/5232605)
- [Fórum Spotify: restauração do preview_url](https://community.spotify.com/t5/Spotify-for-Developers/Request-to-Restore-Access-to-preview-url-in-API-Responses-for/td-p/7012597)
