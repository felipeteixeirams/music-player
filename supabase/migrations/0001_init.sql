-- AuraStream: tabelas por usuário, regras de acesso por linha (RLS) e a cota diária.
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro e execute. É seguro executar de novo só em um
-- banco vazio (as tabelas são criadas sem "if not exists" de propósito, para não mascarar um banco pela metade).
--
-- Como o acesso funciona:
--   * O app (navegador) usa a chave `anon` com o login do usuário (papel `authenticated`): cada pessoa só enxerga e
--     altera as próprias linhas (`user_id = auth.uid()`).
--   * As funções do servidor usam a chave `service_role`, que ignora o RLS: só elas gravam o cache de vídeos e
--     consomem a cota.
--   * Quem pode entrar é decidido no painel (Authentication): cadastro aberto desligado e convite por e-mail.

-- ------------------------------------------------------------------ favoritos
create table public.favorites (
  user_id    uuid not null references auth.users (id) on delete cascade,
  track_id   text not null check (char_length(track_id) between 1 and 64),
  -- A faixa inteira, para a Biblioteca aparecer mesmo que ela não esteja em nenhum feed hoje
  track      jsonb not null check (pg_column_size(track) <= 8192 and (track ->> 'id') = track_id),
  created_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

-- ------------------------------------------------------------------ playlists
create table public.playlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  name       text not null check (char_length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index playlists_user_idx on public.playlists (user_id, created_at);

create table public.playlist_tracks (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id    text not null check (char_length(track_id) between 1 and 64),
  track       jsonb not null check (pg_column_size(track) <= 8192 and (track ->> 'id') = track_id),
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id)
);

-- ------------------------------------------------------- escolha de "Outra versão"
create table public.video_choices (
  user_id    uuid not null references auth.users (id) on delete cascade,
  track_id   text not null check (char_length(track_id) between 1 and 64),
  video_id   text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  updated_at timestamptz not null default now(),
  primary key (user_id, track_id)
);

-- ---------------------------------------------------------------- histórico
create table public.play_history (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  track_id  text not null check (char_length(track_id) between 1 and 64),
  track     jsonb not null check (pg_column_size(track) <= 8192 and (track ->> 'id') = track_id),
  played_at timestamptz not null default now()
);
create index play_history_user_idx on public.play_history (user_id, played_at desc, id desc);

-- ------------------------------------------- cache de vídeos (compartilhado)
-- A faixa do catálogo -> os vídeos do YouTube que a tocam. Cada faixa é pesquisada uma vez para todos os usuários.
create table public.video_cache (
  track_id    text primary key check (char_length(track_id) between 1 and 64),
  video_ids   text[] not null check (cardinality(video_ids) between 1 and 5),
  resolved_at timestamptz not null default now()
);

-- ------------------------------------------------------------- cota diária
-- Quantas faixas novas (buscas de vídeo) cada usuário já pediu em cada dia (dia de São Paulo).
create table public.usage_daily (
  user_id  uuid not null references auth.users (id) on delete cascade,
  day      date not null,
  resolves integer not null default 0 check (resolves >= 0),
  primary key (user_id, day)
);

-- ------------------------------------------------------------------ limites
-- O navegador não é de confiança: os tetos valem também no banco.
create function public.enforce_limits() returns trigger
language plpgsql as $$
begin
  if tg_table_name = 'playlists' then
    if (select count(*) from public.playlists where user_id = new.user_id) >= 100 then
      raise exception 'limite de 100 playlists por usuário' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'playlist_tracks' then
    if (select count(*) from public.playlist_tracks where playlist_id = new.playlist_id) >= 500 then
      raise exception 'limite de 500 faixas por playlist' using errcode = 'P0001';
    end if;
  elsif tg_table_name = 'favorites' then
    if (select count(*) from public.favorites where user_id = new.user_id) >= 2000 then
      raise exception 'limite de 2000 favoritos por usuário' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

create trigger playlists_limit before insert on public.playlists
  for each row execute function public.enforce_limits();
create trigger playlist_tracks_limit before insert on public.playlist_tracks
  for each row execute function public.enforce_limits();
create trigger favorites_limit before insert on public.favorites
  for each row execute function public.enforce_limits();

-- O histórico guarda só as 500 reproduções mais recentes de cada usuário
create function public.trim_history() returns trigger
language plpgsql as $$
begin
  delete from public.play_history
  where user_id = new.user_id
    and id in (
      select id from public.play_history
      where user_id = new.user_id
      order by played_at desc, id desc
      offset 500
    );
  return null;
end $$;

create trigger play_history_trim after insert on public.play_history
  for each row execute function public.trim_history();

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger playlists_touch before update on public.playlists
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- consumir uma busca da cota
-- Atômica: duas chamadas ao mesmo tempo nunca passam do limite. Devolve quantas buscas o usuário já fez hoje
-- (contando esta) ou -1 quando o limite do dia já foi atingido. Só o servidor (service_role) a executa.
create function public.consume_resolve(p_user uuid, p_limit integer) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_day  date := (now() at time zone 'America/Sao_Paulo')::date;
  v_used integer;
begin
  insert into public.usage_daily (user_id, day, resolves)
  values (p_user, v_day, 1)
  on conflict (user_id, day) do update
    set resolves = public.usage_daily.resolves + 1
    where public.usage_daily.resolves < p_limit
  returning resolves into v_used;
  return coalesce(v_used, -1);
end $$;

revoke all on function public.consume_resolve(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_resolve(uuid, integer) to service_role;

-- ------------------------------------------------------------- acesso (RLS)
alter table public.favorites       enable row level security;
alter table public.playlists       enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.video_choices   enable row level security;
alter table public.play_history    enable row level security;
alter table public.video_cache     enable row level security;
alter table public.usage_daily     enable row level security;

create policy favorites_own on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy playlists_own on public.playlists
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy playlist_tracks_own on public.playlist_tracks
  for all to authenticated
  using (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.playlists p where p.id = playlist_id and p.user_id = (select auth.uid())));

create policy video_choices_own on public.video_choices
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy play_history_own on public.play_history
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- O usuário só lê a própria cota (para mostrar quanto resta); quem grava é a função do servidor
create policy usage_daily_read_own on public.usage_daily
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------- permissões
-- Sem privilégio nenhum para quem não entrou, e o mínimo para quem entrou.
revoke all on public.favorites, public.playlists, public.playlist_tracks, public.video_choices,
              public.play_history, public.video_cache, public.usage_daily from anon, authenticated;

grant select, insert, update, delete on public.favorites, public.playlists, public.playlist_tracks,
                                        public.video_choices, public.play_history to authenticated;
grant select on public.usage_daily to authenticated;

grant all on public.video_cache, public.usage_daily to service_role;
