-- Feedback enviado pela pessoa em Ajustes > Ajuda > "Enviar feedback" (INV-FB-01).
-- A pessoa só grava as próprias linhas e não as lê de volta pelo app; quem lê é o administrador, pelo painel do
-- Supabase (ou pelo service_role). Aplicar à mão no SQL Editor do Supabase, como as anteriores.
create table if not exists public.app_feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('bug', 'idea', 'other')),
  message    text not null check (char_length(message) between 1 and 1000),
  version    text not null default '' check (char_length(version) <= 20),
  created_at timestamptz not null default now()
);

create index if not exists app_feedback_user_idx on public.app_feedback (user_id, created_at desc);

alter table public.app_feedback enable row level security;

drop policy if exists app_feedback_insert_own on public.app_feedback;
create policy app_feedback_insert_own on public.app_feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.app_feedback from anon;
grant insert on public.app_feedback to authenticated;
grant usage, select on sequence public.app_feedback_id_seq to authenticated;
grant all on public.app_feedback to service_role;
