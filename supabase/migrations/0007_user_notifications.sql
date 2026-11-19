-- Caixa de avisos dentro do app (INV-NOT-01): avisos para uma pessoa, lidos pelo próprio app.
-- Só o servidor grava, pela função notify_user (security definer); a pessoa lê as próprias linhas e marca como lidas
-- (só a coluna read_at muda). Guarda 90 dias (INV-NOT-03). Aplicar à mão no SQL Editor do Supabase, como as anteriores.
create table if not exists public.user_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind ~ '^[a-z_]{1,40}$'),
  payload    jsonb not null default '{}' check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 2048),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index if not exists user_notifications_user_idx on public.user_notifications (user_id, created_at desc);

alter table public.user_notifications enable row level security;

drop policy if exists user_notifications_select_own on public.user_notifications;
create policy user_notifications_select_own on public.user_notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists user_notifications_mark_own on public.user_notifications;
create policy user_notifications_mark_own on public.user_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.user_notifications from anon, authenticated;
grant select on public.user_notifications to authenticated;
-- A pessoa só pode mudar a data de leitura; o restante da linha é do servidor
grant update (read_at) on public.user_notifications to authenticated;
grant all on public.user_notifications to service_role;

-- Único caminho de gravação: quem avisa (o servidor, com a chave de serviço) informa a pessoa e o tipo.
-- Guarda 90 dias por pessoa a cada aviso novo (INV-NOT-03).
create or replace function public.notify_user(target uuid, notice_kind text, notice_payload jsonb default '{}')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  notice_id uuid;
begin
  delete from public.user_notifications
   where user_id = target and created_at < now() - interval '90 days';

  insert into public.user_notifications (user_id, kind, payload)
  values (target, notice_kind, coalesce(notice_payload, '{}'))
  returning id into notice_id;

  return notice_id;
end;
$$;

revoke all on function public.notify_user(uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.notify_user(uuid, text, jsonb) to service_role;
