# Especificação: esquema de dados por usuário

Arquivo proprietário: `supabase/migrations/0001_init.sql`. Testes: `tests/db/schema.test.ts` (rodam em Postgres em memória via PGlite, com stubs de `auth.users`, `auth.uid()` e dos papéis `anon`/`authenticated`/`service_role`).

## Tabelas

| Tabela | Dono | Conteúdo |
| --- | --- | --- |
| `favorites` | usuário | faixa (jsonb) por `(user_id, track_id)` |
| `playlists` / `playlist_tracks` | usuário | nome de 1 a 60 caracteres; faixas com `position` |
| `video_choices` | usuário | `video_id` escolhido (11 caracteres `[A-Za-z0-9_-]`) |
| `play_history` | usuário | últimas 500 reproduções |
| `video_cache` | compartilhada | até 5 `video_ids` por faixa; só `service_role` |
| `usage_daily` | usuário | resoluções do dia; o dono só lê |

## Garantias (cobertas por teste)

- RLS em todas as tabelas: cada usuário só enxerga e grava linhas próprias (`user_id = auth.uid()`); `anon` não acessa nada.
- jsonb de faixa limitado a 8 KB e com `track->>'id' = track_id`.
- Limites por gatilho: 100 playlists por usuário, 500 faixas por playlist, 2000 favoritos; histórico aparado a 500.
- `consume_resolve(user, limite)` (só `service_role`): incrementa de forma atômica o contador do dia em America/Sao_Paulo e devolve a contagem, ou -1 quando o limite foi atingido.

## Como evoluir

Mudanças no schema entram como nova migração numerada (`0002_*.sql`), nunca editando uma já aplicada, e ganham teste em `tests/db/`. Aplicar a migração no Supabase (SQL Editor ou CLI) é passo manual do dono do projeto.
