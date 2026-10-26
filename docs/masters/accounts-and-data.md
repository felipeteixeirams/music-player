# Master: contas e dados por usuário

## Propósito e autoridade

Descreve como o app separa o contexto de cada pessoa (login, favoritos, playlists, escolhas de versão, histórico) e como limita o uso das integrações por usuário. O desenho do banco e suas garantias estão no satélite abaixo; este master registra o estado e as decisões.

## Estado

- Banco (Supabase, região São Paulo): schema, RLS, limites e função de cota em `supabase/migrations/0001_init.sql`, validados por `tests/db/schema.test.ts` (PGlite). **Implementado em 2026-10-26.**
- Pendente, em etapas de um PR cada: (1) login por convite e proteção das rotas pelo JWT; (2) favoritos, playlists e escolhas por usuário com migração dos dados do aparelho; (3) cache compartilhado de vídeos e cota diária por usuário; (4) histórico de reprodução.

## Decisões

- Acesso só por convite: cadastro aberto desligado no Supabase; o app entra por link mágico com `shouldCreateUser: false`.
- Chaves públicas (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) vão para o cliente. `SUPABASE_SERVICE_ROLE_KEY` e a senha do banco ficam só nas variáveis de ambiente da Vercel, nunca no repositório nem em conversas.
- A cota é de "faixas novas" por dia (resoluções de vídeo, que gastam a YouTube Data API), não de horas de reprodução: tocar não passa pelo servidor.

## Navegação para a especificação

- [Esquema, RLS e cota por usuário](../specs/current/user-data-schema.spec.md)
