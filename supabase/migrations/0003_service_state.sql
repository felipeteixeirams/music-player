-- Estado de serviços de terceiros, compartilhado por todas as instâncias da Vercel.
--
-- Hoje guarda o "disjuntor" da API de busca do YouTube: quando a cota diária acaba, o servidor registra até quando a
-- busca oficial fica suspensa (a cota do YouTube zera à meia-noite do Pacífico), para nenhuma instância insistir.
-- Só o servidor (service_role) lê e escreve; o app nunca fala com esta tabela.

create table public.service_state (
  key        text primary key check (char_length(key) between 1 and 40),
  until      timestamptz not null,
  reason     text not null check (char_length(reason) between 1 and 40),
  updated_at timestamptz not null default now()
);

alter table public.service_state enable row level security;
-- Sem nenhuma política: anon e authenticated não enxergam nada; o service_role ignora a RLS.
revoke all on public.service_state from anon, authenticated;
grant select, insert, update, delete on public.service_state to service_role;
