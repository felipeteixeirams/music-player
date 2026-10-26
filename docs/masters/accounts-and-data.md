# Master: contas e dados por usuário

## Propósito e autoridade

Descreve como o app separa o contexto de cada pessoa (login, favoritos, playlists, escolhas de versão, histórico) e como limita o uso das integrações por usuário. O desenho do banco e suas garantias estão no satélite abaixo; este master registra o estado e as decisões.

## Estado

- Banco (Supabase, região São Paulo): schema, RLS, limites e função de cota em `supabase/migrations/0001_init.sql`, validados por `tests/db/schema.test.ts` (PGlite). **Implementado em 2026-10-26.**
- Login por convite e proteção das rotas pelo token: implementado em 2026-10-26 (etapa 1).
- Pendente, em etapas de um PR cada: (2) favoritos, playlists e escolhas por usuário com migração dos dados do aparelho; (3) cache compartilhado de vídeos e cota diária por usuário; (4) histórico de reprodução.

## Decisões

- Acesso só por convite: cadastro aberto desligado no Supabase (Authentication > Sign In / Providers > Email > "Allow new users to sign up" desligado); o app pede o código com `shouldCreateUser: false`. O convite é criar o usuário no painel (Authentication > Users > Add user, com e-mail confirmado).
- Código digitado, não link mágico: no iPhone o link abriria o Safari, cuja sessão é separada do app instalado. O template de e-mail "Magic Link" (Authentication > Emails) precisa mostrar `{{ .Token }}`.
- O servidor valida o token chamando o Supabase (`api/_auth.ts`), sem usar o `JWT_SECRET`. Sem as variáveis, o login fica desligado localmente; na Vercel a API recusa (503) em vez de abrir.
- Respostas cacheadas pela borda da Vercel (`s-maxage`) podem ser servidas sem passar pela função; só trazem dados públicos do catálogo e não gastam a cota do YouTube.
- O e-mail padrão do Supabase pode só entregar a membros da equipe do projeto e ter limite baixo de envios (não verificado); para convidados externos, configurar SMTP próprio.
- Chaves públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) vão para o cliente. `SUPABASE_SERVICE_ROLE_KEY` e a senha do banco ficam só nas variáveis de ambiente da Vercel, nunca no repositório nem em conversas.
- A cota é de "faixas novas" por dia (resoluções de vídeo, que gastam a YouTube Data API), não de horas de reprodução: tocar não passa pelo servidor.

## Código proprietário

`api/_auth.ts` (verificação e cache do token), `api/_guard.ts` (`authorizeRequest`), `src/utils/{supabaseConfig,authClient,apiFetch}.ts`, `src/context/AuthContext.tsx`, `src/components/LoginScreen.tsx`, `supabase/migrations/`. Testes: `tests/api/auth.test.ts`, `tests/e2e/login.spec.ts`, `tests/db/schema.test.ts`.

## Navegação para a especificação

- [Esquema, RLS e cota por usuário](../specs/current/user-data-schema.spec.md)
