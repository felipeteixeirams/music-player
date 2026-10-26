# Master: contas e dados por usuário

## Propósito e autoridade

Descreve como o app separa o contexto de cada pessoa (login, favoritos, playlists, escolhas de versão, histórico) e como limita o uso das integrações por usuário. O desenho do banco e suas garantias estão no satélite abaixo; este master registra o estado e as decisões.

## Estado

- Banco (Supabase, região São Paulo): schema, RLS, limites e função de cota em `supabase/migrations/0001_init.sql`, validados por `tests/db/schema.test.ts` (PGlite). **Implementado em 2026-10-26.**
- Login por convite e proteção das rotas pelo token: implementado em 2026-10-26 (etapa 1).
- Favoritos, playlists e escolhas de versão por conta, com migração dos dados do aparelho: implementado em 2026-10-26 (etapa 2).
- Pendente, em etapas de um PR cada: (3) cache compartilhado de vídeos e cota diária por usuário; (4) histórico de reprodução.

## Decisões

- Acesso só por convite: cadastro aberto desligado no Supabase (Authentication > Sign In / Providers > Email > "Allow new users to sign up" desligado); o app pede o código com `shouldCreateUser: false`. O convite é criar o usuário no painel (Authentication > Users > Add user, com e-mail confirmado).
- Código digitado, não link mágico: no iPhone o link abriria o Safari, cuja sessão é separada do app instalado. O modelo de e-mail "Magic link" (Authentication > Emails > Templates) precisa mostrar `{{ .Token }}` e não ter link: o texto pronto, em português, está em `supabase/templates/magic-link.html` (assunto "Seu código de acesso ao AuraStream").
- O servidor valida o token chamando o Supabase (`api/_auth.ts`), sem usar o `JWT_SECRET`. Sem as variáveis, o login fica desligado localmente; na Vercel a API recusa (503) em vez de abrir.
- Respostas cacheadas pela borda da Vercel (`s-maxage`) podem ser servidas sem passar pela função; só trazem dados públicos do catálogo e não gastam a cota do YouTube.
- O e-mail padrão do Supabase pode só entregar a membros da equipe do projeto e ter limite baixo de envios (não verificado); para convidados externos, configurar SMTP próprio.
- Chaves públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) vão para o cliente. `SUPABASE_SERVICE_ROLE_KEY` e a senha do banco ficam só nas variáveis de ambiente da Vercel, nunca no repositório nem em conversas.
- A cota é de "faixas novas" por dia (resoluções de vídeo, que gastam a YouTube Data API), não de horas de reprodução: tocar não passa pelo servidor.

## Dados por conta (etapa 2)

- O aparelho trabalha sempre na própria cópia, no `localStorage` com as chaves sufixadas pelo id do usuário (`src/utils/scopedStorage.ts`): instantâneo, funciona offline, e duas pessoas no mesmo aparelho nunca se misturam. A conta (Supabase, tabelas com RLS) é a cópia durável e a ponte entre aparelhos.
- `src/utils/userDataSync.ts` sincroniza, sem função serverless: o cliente fala com a API REST do Supabase com o token do usuário (`userDataRemote.ts`) e as políticas de RLS garantem o isolamento. Envia só a diferença (`diffSnapshots`), com espera de 0,8 s para agrupar mudanças.
- Quem vence quando divergem: a conta, exceto se o aparelho tem alterações ainda não enviadas. Essas ficam marcadas no armazenamento (`aurastream_sync_pending`) no instante da mudança, para sobreviver a fechar o app, e vencem na próxima sincronização. Alterações feitas enquanto a conta é lida também não são sobrescritas.
- Primeiro login num aparelho com dados de antes das contas: quem entra primeiro leva os dados (as chaves antigas são apagadas, ninguém mais herda) e eles são mesclados com a conta; ids de playlist antigos que não eram uuid ganham um uuid.
- A sincronização roda ao abrir, ao voltar ao primeiro plano (no máximo a cada 30 s) e ao voltar a conexão. Uma recusa definitiva da conta (por exemplo, um limite) devolve ao aparelho o estado da conta.
- Os contextos não conhecem a sincronização: avisam `emitUserDataChanged()` depois de salvar e releem o armazenamento em `onUserDataApplied` (`src/utils/userDataEvents.ts`). "Limpar cache" não apaga mais favoritos: eles são da conta.
- Não sincronizado, de propósito: downloads offline (são do aparelho), a lista de início salva e o limite de cache.

## Código proprietário

`api/_auth.ts` (verificação e cache do token), `api/_guard.ts` (`authorizeRequest`), `src/utils/{supabaseConfig,authClient,apiFetch}.ts`, `src/context/AuthContext.tsx`, `src/components/{LoginScreen,SyncAgent}.tsx`, `src/utils/loginCode.ts`, `src/utils/{scopedStorage,userData,userDataRemote,userDataSync,userDataEvents}.ts`, `supabase/migrations/`. Testes: `tests/api/auth.test.ts`, `tests/e2e/login.spec.ts`, `tests/e2e/sync.spec.ts`, `tests/userData.test.ts`, `tests/userDataSync.test.ts`, `tests/db/schema.test.ts`.

## Navegação para a especificação

- [Esquema, RLS e cota por usuário](../specs/current/user-data-schema.spec.md)
