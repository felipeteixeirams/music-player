-- Uso diário: uma linha por pessoa e por dia (dia de São Paulo) em que ela abriu o app logado.
-- A pessoa só grava a própria linha; ninguém lê as linhas pelo cliente. O painel de administrador lê com a chave de
-- serviço (que ignora o RLS) em api/_supabaseAdmin.ts. Aplicar à mão no SQL Editor do Supabase, como as anteriores.
create table if not exists public.app_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  primary key (user_id, day)
);

alter table public.app_days enable row level security;

drop policy if exists app_days_insert_own on public.app_days;
create policy app_days_insert_own on public.app_days
  for insert to authenticated
  with check (user_id = (select auth.uid()));

revoke all on public.app_days from anon;
grant insert on public.app_days to authenticated;
grant all on public.app_days to service_role;
