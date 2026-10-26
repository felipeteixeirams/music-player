# Master: contas e dados por usuário

## Propósito e autoridade

Descreve como o app separa o contexto de cada pessoa (login, favoritos, playlists, escolhas de versão, histórico) e como limita o uso das integrações por usuário. O desenho do banco e suas garantias estão no satélite abaixo; este master registra o estado e as decisões.

## Estado

- Banco (Supabase, região São Paulo): schema, RLS, limites e função de cota em `supabase/migrations/0001_init.sql`, validados por `tests/db/schema.test.ts` (PGlite). **Implementado em 2026-10-26.**
- Login por convite e proteção das rotas pelo token: implementado em 2026-10-26 (etapa 1).
- Favoritos, playlists e escolhas de versão por conta, com migração dos dados do aparelho: implementado em 2026-10-26 (etapa 2).
- Cache compartilhado de vídeos e cota diária de faixas novas por pessoa: implementado em 2026-10-26 (etapa 3); contrato em [Contratos](../specs/current/music-integration-contracts.spec.md).
- Histórico de reprodução por conta, com tela "Reproduzidas recentemente" na Biblioteca: implementado em 2026-10-26 (etapa 4). As quatro etapas planejadas estão concluídas.

## Decisões

- Acesso só por convite: cadastro aberto desligado no Supabase (Authentication > Sign In / Providers > Email > "Allow new users to sign up" desligado); o app pede o código com `shouldCreateUser: false`. O convite é criar o usuário no painel (Authentication > Users > Add user, com e-mail confirmado).
- Código digitado, não link mágico: no iPhone o link abriria o Safari, cuja sessão é separada do app instalado. O modelo de e-mail "Magic link" (Authentication > Emails > Templates) precisa mostrar `{{ .Token }}` e não ter link: o texto pronto, em português, está em `supabase/templates/magic-link.html` (assunto "Seu código de acesso ao AuraStream").
- O servidor valida o token chamando o Supabase (`api/_auth.ts`), sem usar o `JWT_SECRET`. Sem as variáveis, o login fica desligado localmente; na Vercel a API recusa (503) em vez de abrir.
- Respostas cacheadas pela borda da Vercel (`s-maxage`) podem ser servidas sem passar pela função; só trazem dados públicos do catálogo e não gastam a cota do YouTube.
- O e-mail padrão do Supabase pode só entregar a membros da equipe do projeto e ter limite baixo de envios (não verificado); para convidados externos, configurar SMTP próprio.
- Chaves públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) vão para o cliente. `SUPABASE_SERVICE_ROLE_KEY` e a senha do banco ficam só nas variáveis de ambiente da Vercel, nunca no repositório nem em conversas.
- A cota é de "faixas novas" por dia (resoluções de vídeo, que gastam a YouTube Data API), não de horas de reprodução: tocar não passa pelo servidor.

## Histórico de reprodução (etapa 4)

- Uma faixa entra no histórico depois de ouvida o bastante: 25 s de escuta real, ou metade dela se for mais curta (`src/utils/playedCounter.ts`). Pular para a frente não conta, pausar não custa nada, e repetir a faixa conta de novo. Rádios ao vivo ficam de fora.
- O histórico só cresce (a conta guarda as últimas 500, um gatilho apaga as mais antigas), por isso não usa o motor de favoritos: cada reprodução vai para uma fila de envio no armazenamento do aparelho (`aurastream_play_history_outbox`) e é enviada em lote; sem conexão, a fila espera e nada se perde. Ao abrir, ao voltar ao primeiro plano e quando a conexão volta, a fila é enviada e a lista da conta é lida (assim as reproduções de outro aparelho aparecem). Uma reprodução que a conta recusa de vez é descartada para não travar as demais (`src/utils/playHistorySync.ts`).
- A tela "Reproduzidas recentemente" mostra cada faixa uma vez, a mais recente primeiro; "Limpar histórico" apaga na hora no aparelho e deixa um pedido para a conta, que vale em todos os aparelhos.
- Não faz parte do histórico: busca, favoritos e playlists (esses são da conta por outro caminho), nem o tempo total ouvido.

## Diagnóstico do login (logs e erros)

- O servidor registra o motivo de cada recusa de login, sem token nem chave: `[Auth] 401 no_token GET /api/feed`, `[Auth] 401 invalid_session (HTTP 403 session_not_found...)`, `[Auth] 503 server_key_rejected (...)`, `[Auth] 503 login_not_configured (falta: ...)`, `[Auth] 503 auth_unavailable (...)`. Na primeira chamada de cada instância ele descreve a configuração: o projeto (host) e os **nomes** das variáveis em uso, nunca os valores. As respostas levam `code` com o mesmo motivo (campo a mais, compatível com clientes antigos).
- 401 quer dizer "entre de novo"; 503 quer dizer "o servidor não sabe": uma chave pública errada no servidor, ou o Supabase fora do ar, vira 503 e **não** desloga ninguém (antes, a chave errada derrubava todos os usuários em laço). Quando o app encerra a sessão, a tela de login diz o motivo ("Sua sessão terminou ou o acesso foi retirado").
- `/api/health` informa `login` (o servidor tem as variáveis do Supabase) e `cache` (tem a chave de serviço do cache e da cota); é o primeiro lugar a olhar depois de mudar variáveis na Vercel.
- No pedido de código, o console do navegador (inspetor do Safari) registra `[Login] pedido de código recusado: status=… code=…`, sem e-mail nem código, e a tela distingue: sem conexão, e-mail inválido, o servidor não conseguiu enviar o e-mail (SMTP errado ou recusado pelo provedor), os três limites de envio e código incorreto ou expirado.

## Código por e-mail: validade, reenvio e abuso

- O código vale 90 s e um novo só pode ser pedido 60 s depois (`CODE_TTL_MS` e `RESEND_COOLDOWN_MS` em `src/utils/loginCode.ts`). Quem de fato expira o código e recusa pedidos cedo demais é o Supabase, por endereço e por rede, então um script que ignore a tela não passa; a tela só mostra a contagem (e a lembra ao recarregar a página).
- Quando o servidor recusa o pedido, a tela diz qual dos três limites foi (`describeRateLimit`): o mesmo e-mail pediu cedo demais (com os segundos a esperar), os e-mails por hora do projeto acabaram (não é culpa de quem pediu e pode durar até uma hora; a saída é SMTP próprio) ou a rede fez pedidos demais.
- Ajustes no painel do Supabase que sustentam isso (os nomes podem variar; confira no painel): Authentication > Sign In / Providers > Email: "Email OTP Expiration" = 90 (segundos) e "Email OTP Length" = 6; intervalo mínimo entre e-mails para o mesmo usuário = 60 s; Authentication > Rate Limits: limites de envio de e-mails por hora, de pedidos de código e de verificações por rede a cada 5 minutos, em valores baixos para um grupo pequeno.
- Sem bloqueio universal: o intervalo mínimo é por usuário e os limites de pedido e de verificação são por rede; errar o código ou pedir demais trava só quem errou. O único teto compartilhado é o de e-mails por hora do projeto (e do provedor de SMTP): quem soubesse o e-mail de um convidado poderia gastá-lo e atrasar o código dos demais. Por isso, mantenha o teto por hora baixo mas folgado para o grupo e use SMTP próprio com limite próprio; endereço sem convite não envia nada (o Supabase recusa), e a tela responde igual para ele, para não revelar quem tem convite.
- Não implementado de propósito: um controle próprio no servidor. Se o grupo crescer ou houver abuso, o passo seguinte é uma rota que cobre pedido de código com limite por e-mail no banco, sem passar pela rede compartilhada do Supabase.

## Cota e cache (etapa 3)

- Cada pessoa traz até 30 faixas novas por dia (`DAILY_NEW_TRACKS` na Vercel muda o número): uma "faixa nova" é uma que ninguém tocou antes no app, porque só ela gasta uma busca da YouTube Data API (≈100 por dia no app inteiro). Faixa já resolvida por qualquer pessoa vem do cache compartilhado e não conta. Tocar não passa pelo servidor e não tem limite de horas.
- Com a cota acabada o app toca a prévia de 30 s e avisa; o contador aparece em Ajustes. O dia vira à meia-noite de São Paulo.
- O servidor usa `DATABASE_SUPABASE_SERVICE_ROLE_KEY` (segredo, só na Vercel) para o cache e a cota; o navegador nunca a recebe.
- Ajuste fino: com 3 pessoas, 3 x 30 = 90 cabe nas ≈100 buscas diárias; ao convidar mais gente, baixe `DAILY_NEW_TRACKS` ou peça aumento de cota ao Google.

## Dados por conta (etapa 2)

- O aparelho trabalha sempre na própria cópia, no `localStorage` com as chaves sufixadas pelo id do usuário (`src/utils/scopedStorage.ts`): instantâneo, funciona offline, e duas pessoas no mesmo aparelho nunca se misturam. A conta (Supabase, tabelas com RLS) é a cópia durável e a ponte entre aparelhos.
- `src/utils/userDataSync.ts` sincroniza, sem função serverless: o cliente fala com a API REST do Supabase com o token do usuário (`userDataRemote.ts`) e as políticas de RLS garantem o isolamento. Envia só a diferença (`diffSnapshots`), com espera de 0,8 s para agrupar mudanças.
- Quem vence quando divergem: a conta, exceto se o aparelho tem alterações ainda não enviadas. Essas ficam marcadas no armazenamento (`aurastream_sync_pending`) no instante da mudança, para sobreviver a fechar o app, e vencem na próxima sincronização. Alterações feitas enquanto a conta é lida também não são sobrescritas.
- Primeiro login num aparelho com dados de antes das contas: quem entra primeiro leva os dados (as chaves antigas são apagadas, ninguém mais herda) e eles são mesclados com a conta; ids de playlist antigos que não eram uuid ganham um uuid.
- A sincronização roda ao abrir, ao voltar ao primeiro plano (no máximo a cada 30 s) e ao voltar a conexão. Uma recusa definitiva da conta (por exemplo, um limite) devolve ao aparelho o estado da conta.
- Os contextos não conhecem a sincronização: avisam `emitUserDataChanged()` depois de salvar e releem o armazenamento em `onUserDataApplied` (`src/utils/userDataEvents.ts`). "Limpar cache" não apaga mais favoritos: eles são da conta.
- Não sincronizado, de propósito: downloads offline (são do aparelho), a lista de início salva e o limite de cache.

## Código proprietário

`api/_auth.ts` (verificação e cache do token), `api/_resolveEndpoint.ts` e `api/_supabaseAdmin.ts` (cache e cota), `api/_guard.ts` (`authorizeRequest`), `src/utils/{supabaseConfig,authClient,apiFetch}.ts`, `src/context/AuthContext.tsx`, `src/components/{LoginScreen,SyncAgent}.tsx`, `src/utils/loginCode.ts`, `src/utils/{scopedStorage,userData,userDataRemote,userDataSync,userDataEvents,supabaseRest}.ts`, `src/utils/{playedCounter,playHistory,playHistoryRemote,playHistorySync}.ts`, `src/hooks/usePlayHistory.ts`, `supabase/migrations/`. Testes: `tests/api/auth.test.ts`, `tests/e2e/login.spec.ts`, `tests/e2e/sync.spec.ts`, `tests/userData.test.ts`, `tests/userDataSync.test.ts`, `tests/playHistory.test.ts`, `tests/e2e/history.spec.ts`, `tests/db/schema.test.ts`.

## Navegação para a especificação

- [Esquema, RLS e cota por usuário](../specs/current/user-data-schema.spec.md)
