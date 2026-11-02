-- Google first names are public defaults; explicit game nicknames remain intact.
begin;
create function svela_private.player_name(p_metadata jsonb, p_user_id uuid)
returns text language plpgsql immutable security invoker set search_path = '' as $$
declare v_key text; v_text text; v_values jsonb := '{}'::jsonb;
begin
  foreach v_key in array array['display_name','given_name','full_name','name'] loop
    if pg_catalog.jsonb_typeof(p_metadata->v_key) = 'string' then
      v_text := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(p_metadata->>v_key,'[[:space:]]+',' ','g')),80);
      v_values := v_values || pg_catalog.jsonb_build_object(v_key,nullif(v_text,''));
    end if;
  end loop;
  return coalesce(v_values->>'display_name',v_values->>'given_name',
    nullif(pg_catalog.split_part(coalesce(v_values->>'full_name',v_values->>'name',''),' ',1),''),
    'Esploratore ' || pg_catalog.left(pg_catalog.md5(p_user_id::text),8));
end;
$$;
revoke all on function svela_private.player_name(jsonb,uuid) from public,anon,authenticated,service_role;
create or replace function public.get_leaderboard(p_kind text, p_level_key text default null, p_limit integer default 50, p_offset integer default 0)
returns table(rank bigint,name text,value bigint,is_you boolean)
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from auth.users where id = v_uid) then raise exception 'Authentication required' using errcode = '28000'; end if;
  if p_kind is null or p_kind not in ('discoveries','time') or p_limit is null or p_limit not between 1 and 50 or p_offset is null or p_offset not between 0 and 10000 then raise exception 'Invalid ranking parameters' using errcode = '22023'; end if;
  if p_kind = 'time' and (p_level_key is null or not exists (select 1 from svela_private.puzzle_catalog where level_key = p_level_key and ranked)) then raise exception 'Choose a campaign level' using errcode = '22023'; end if;
  return query
  with scores as (
    select d.user_id,pg_catalog.count(*)::bigint as score from svela_private.verified_discoveries d where p_kind = 'discoveries' group by d.user_id
    union all
    select b.user_id,b.best_ms::bigint from svela_private.level_bests b where p_kind = 'time' and b.level_key = p_level_key
  ), ranked_scores as (
    select s.user_id,s.score,pg_catalog.rank() over(order by case when p_kind = 'discoveries' then -s.score else s.score end) as position from scores s
  )
  select r.position,
    svela_private.player_name(u.raw_user_meta_data, u.id),
    r.score,r.user_id = v_uid
  from ranked_scores r join auth.users u on u.id = r.user_id
  order by r.position,r.user_id limit p_limit offset p_offset;
end;
$$;
commit;
