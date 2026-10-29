-- Podcasts, etapa 2: os programas que a pessoa segue e onde ela parou em cada episódio.
--
-- Como aplicar: Supabase > SQL Editor > cole este arquivo inteiro e execute (depois das migrações 0001 a 0003).
-- Enquanto não for aplicada, o app segue funcionando: o que depende destas tabelas só não sincroniza entre aparelhos.

-- ------------------------------------------------------------ programas seguidos
create table public.podcast_follows (
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- O `collectionId` do iTunes, que é como o app nomeia um programa
  show_id    text not null check (show_id ~ '^[0-9]{1,12}$'),
  -- O programa inteiro (nome, apresentador, capa), para a Biblioteca aparecer sem buscar nada
  show       jsonb not null check (pg_column_size(show) <= 4096 and (show ->> 'id') = show_id),
  created_at timestamptz not null default now(),
  primary key (user_id, show_id)
);

-- --------------------------------------------------- onde a pessoa parou em cada episódio
create table public.podcast_progress (
  user_id    uuid not null references auth.users (id) on delete cascade,
  episode_id text not null check (char_length(episode_id) between 1 and 64),
  show_id    text not null default '' check (char_length(show_id) <= 12),
  position   integer not null default 0 check (position >= 0),
  duration   integer not null default 0 check (duration >= 0),
  done       boolean not null default false,
  -- O episódio (título, capa, arquivo de áudio), para "Continue ouvindo" aparecer sem buscar o feed
  episode    jsonb not null check (pg_column_size(episode) <= 4096),
  updated_at timestamptz not null default now(),
  primary key (user_id, episode_id)
);
create index podcast_progress_user_idx on public.podcast_progress (user_id, updated_at desc);

-- ------------------------------------------------------------------ limites
create function public.enforce_podcast_limits() returns trigger
language plpgsql as $$
begin
  if (select count(*) from public.podcast_follows where user_id = new.user_id) >= 200 then
    raise exception 'limite de 200 podcasts seguidos por usuário' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger podcast_follows_limit before insert on public.podcast_follows
  for each row execute function public.enforce_podcast_limits();

-- O progresso guarda só os 300 episódios mais recentes de cada usuário
create function public.trim_podcast_progress() returns trigger
language plpgsql as $$
begin
  delete from public.podcast_progress
  where user_id = new.user_id
    and episode_id in (
      select episode_id from public.podcast_progress
      where user_id = new.user_id
      order by updated_at desc, episode_id desc
      offset 300
    );
  return null;
end $$;

create trigger podcast_progress_trim after insert on public.podcast_progress
  for each row execute function public.trim_podcast_progress();

-- ------------------------------------------------------------- acesso (RLS)
alter table public.podcast_follows  enable row level security;
alter table public.podcast_progress enable row level security;

create policy podcast_follows_own on public.podcast_follows
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy podcast_progress_own on public.podcast_progress
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.podcast_follows, public.podcast_progress from anon, authenticated;
grant select, insert, update, delete on public.podcast_follows, public.podcast_progress to authenticated;
