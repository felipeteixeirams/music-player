-- Etapa 3: cache compartilhado de vídeos e cota diária.
--
-- 1. O cache também guarda "pesquisei e não achei" (lista vazia), com prazo curto definido pelo servidor.
-- 2. Quando a busca falha depois de a cota ter sido consumida, o servidor devolve a unidade.

alter table public.video_cache drop constraint video_cache_video_ids_check;
alter table public.video_cache add constraint video_cache_video_ids_check check (cardinality(video_ids) between 0 and 5);

create function public.refund_resolve(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.usage_daily
     set resolves = greatest(resolves - 1, 0)
   where user_id = p_user and day = (now() at time zone 'America/Sao_Paulo')::date;
end $$;

revoke all on function public.refund_resolve(uuid) from public, anon, authenticated;
grant execute on function public.refund_resolve(uuid) to service_role;
