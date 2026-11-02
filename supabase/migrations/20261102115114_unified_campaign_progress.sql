-- Unified campaign play keeps local attempt quality in the ordinary save.
-- These client claims never establish verified discoveries or online times.
begin;

-- Replace the sole exposed signature: default arguments preserve older callers
-- without ambiguous PostgREST overloads.
drop function public.save_game_progress(jsonb, integer, text);
create function public.save_game_progress(p_save jsonb, p_expected_revision integer, p_catalog_version text default null, p_progress_version integer default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := svela_private.require_account();
  v_current public.game_progress%rowtype;
  v_legacy jsonb := p_save;
  v_levels jsonb := '{}'::jsonb;
  v_key text;
  v_level jsonb;
  v_attempt jsonb;
  v_field text;
  v_result jsonb;
begin
  select * into v_current from public.game_progress where user_id = v_uid;
  if found and v_current.revision = p_expected_revision then
    -- Keep the fifty-level compatibility fence from the previous migration.
    if p_catalog_version is distinct from 'fantasy-v2' and exists (
      select 1 from svela_private.puzzle_catalog c where c.catalog_version = 'fantasy-v2'
      and (v_current.save->>'activeLevel' = c.level_key
        or v_current.save->'completed' ? c.level_key
        or v_current.save->'levels' ? c.level_key
        or v_current.save->'bestTimes' ? c.level_key)
    ) then
      raise exception 'Update Svela before saving progress for this campaign' using errcode = '22023';
    end if;
    -- Older applications sanitize away fields they do not understand. Only an
    -- informed client may intentionally overwrite or reset the enriched save.
    if p_progress_version is distinct from 3
      and pg_catalog.jsonb_typeof(v_current.save->'levels') = 'object'
      and exists (select 1 from pg_catalog.jsonb_each(v_current.save->'levels') as l where l.value ?| array['attempt','rarity']) then
      raise exception 'Update Svela before saving attempt progress' using errcode = '22023';
    end if;
  end if;

  if p_save is null or pg_catalog.octet_length(p_save::text) > 2000000 then
    raise exception 'Invalid save or save too large' using errcode = '22023';
  end if;
  if p_save->'version' = '2'::jsonb and pg_catalog.jsonb_typeof(p_save->'levels') = 'object' then
    for v_key, v_level in select key, value from pg_catalog.jsonb_each(p_save->'levels') loop
      if pg_catalog.jsonb_typeof(v_level) is distinct from 'object' then
        raise exception 'Invalid level' using errcode = '22023';
      end if;
      if v_level ? 'rarity' and (pg_catalog.jsonb_typeof(v_level->'rarity') is distinct from 'string'
        or v_level->>'rarity' not in ('common','uncommon','rare','epic')) then
        raise exception 'Invalid earned rarity' using errcode = '22023';
      end if;
      if v_level ? 'attempt' then
        v_attempt := v_level->'attempt';
        if pg_catalog.jsonb_typeof(v_attempt) is distinct from 'object' then
          raise exception 'Invalid attempt' using errcode = '22023';
        end if;
        if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_attempt)) <> 5
          or not (v_attempt ?& array['elapsedMs','hintsUsed','hintWaitMs','eligible','finished'])
          or pg_catalog.jsonb_typeof(v_attempt->'eligible') is distinct from 'boolean'
          or pg_catalog.jsonb_typeof(v_attempt->'finished') is distinct from 'boolean' then
          raise exception 'Invalid attempt shape' using errcode = '22023';
        end if;
        foreach v_field in array array['elapsedMs','hintsUsed','hintWaitMs'] loop
          if pg_catalog.jsonb_typeof(v_attempt->v_field) is distinct from 'number'
            or (v_attempt->v_field)::text !~ '^[0-9]{1,16}$' then
            raise exception 'Invalid attempt counter' using errcode = '22023';
          end if;
          if (v_attempt->>v_field)::bigint > 9007199254740991 then
            raise exception 'Attempt counter out of bounds' using errcode = '22023';
          end if;
        end loop;
        if (v_attempt->>'elapsedMs')::bigint > 86400000
          or (v_attempt->>'hintWaitMs')::bigint > least((v_attempt->>'hintsUsed')::bigint,6) * 5000 then
          raise exception 'Attempt duration or assistance cooldown out of bounds' using errcode = '22023';
        end if;
      end if;
      v_levels := v_levels || pg_catalog.jsonb_build_object(v_key,v_level - 'rarity' - 'attempt');
    end loop;
    v_legacy := pg_catalog.jsonb_set(p_save,'{levels}',v_levels);
  end if;

  -- Reuse every original shape/history check and the revision/CAS implementation.
  -- The account advisory lock spans both writes; a failed validation rolls back
  -- everything, and restoring metadata neither increments nor timestamps twice.
  v_result := svela_private.save_game_progress_v2(v_legacy,p_expected_revision);
  if v_result->'ok' = 'true'::jsonb and v_legacy is distinct from p_save then
    update public.game_progress set save = p_save where user_id = v_uid;
    v_result := pg_catalog.jsonb_set(v_result,'{save}',p_save);
  end if;
  return v_result;
end;
$$;
revoke all on function public.save_game_progress(jsonb,integer,text,integer) from public, anon, authenticated, service_role;
grant execute on function public.save_game_progress(jsonb,integer,text,integer) to authenticated;

create or replace function public.start_timed_run(p_level_key text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid; v_id uuid; v_session text := auth.jwt()->>'session_id';
begin
  v_uid := svela_private.require_account();
  if v_session is null or not exists (select 1 from auth.sessions where id::text = v_session and user_id = v_uid) then raise exception 'Session expired' using errcode = '28000'; end if;
  if not exists (select 1 from svela_private.puzzle_catalog where level_key = p_level_key and ranked) then raise exception 'Unknown ranked level' using errcode = '22023'; end if;
  -- The first normal play can establish both a discovery and a time.
  delete from svela_private.timed_runs where user_id = v_uid;
  insert into svela_private.timed_runs(user_id,session_id,level_key) values(v_uid,v_session,p_level_key) returning id into v_id;
  return pg_catalog.jsonb_build_object('id',v_id);
end;
$$;

create or replace function public.finish_timed_run(p_run_id uuid, p_removed_ids jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_finished_at timestamptz := pg_catalog.clock_timestamp(); v_uid uuid; v_run svela_private.timed_runs%rowtype; v_elapsed integer; v_best integer; v_session text := auth.jwt()->>'session_id';
begin
  v_uid := svela_private.require_account();
  if v_session is null or not exists (select 1 from auth.sessions where id::text = v_session and user_id = v_uid) then raise exception 'Session expired' using errcode = '28000'; end if;
  select * into v_run from svela_private.timed_runs where id = p_run_id and user_id = v_uid and session_id = v_session for update;
  if not found then raise exception 'Unknown or consumed run' using errcode = '22023'; end if;
  if v_finished_at > v_run.started_at + interval '24 hours' then raise exception 'Run expired' using errcode = '22023'; end if;
  if not svela_private.verify_solution(v_run.level_key,p_removed_ids) then raise exception 'Invalid complete solution' using errcode = '22023'; end if;
  v_elapsed := greatest(1, pg_catalog.ceil(extract(epoch from (v_finished_at - v_run.started_at)) * 1000)::integer);
  if v_elapsed > 86400000 then raise exception 'Run expired' using errcode = '22023'; end if;
  delete from svela_private.timed_runs where id = p_run_id;
  insert into svela_private.verified_discoveries(user_id,level_key) values(v_uid,v_run.level_key) on conflict do nothing;
  insert into svela_private.level_bests(user_id,level_key,best_ms) values(v_uid,v_run.level_key,v_elapsed)
    on conflict (user_id,level_key) do update set best_ms = least(svela_private.level_bests.best_ms,excluded.best_ms) returning best_ms into v_best;
  return pg_catalog.jsonb_build_object('elapsed_ms',v_elapsed,'best_ms',v_best);
end;
$$;
revoke all on function public.start_timed_run(text),public.finish_timed_run(uuid,jsonb) from public, anon, authenticated, service_role;
grant execute on function public.start_timed_run(text),public.finish_timed_run(uuid,jsonb) to authenticated;
commit;
