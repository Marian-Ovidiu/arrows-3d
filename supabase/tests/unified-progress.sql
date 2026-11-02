-- Run after every migration against an isolated database as owner. Rolls back.
begin;
insert into auth.users(id,aud,role,email) values
('36d210d0-0010-4000-8000-000000000051','authenticated','authenticated','unified@example.invalid');
insert into auth.sessions(id,user_id) values
('36d210d0-0010-4000-8000-000000000052','36d210d0-0010-4000-8000-000000000051');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"36d210d0-0010-4000-8000-000000000051","role":"authenticated","session_id":"36d210d0-0010-4000-8000-000000000052"}',true);
do $$
declare
  v_base jsonb := '{"version":2,"activeLevel":"bosco-01-v1","completed":[],"levels":{},"bestTimes":{},"tutorial":{"rotated":false,"blockedSeen":false}}';
  v_level jsonb := '{"removedIds":[],"rarity":"rare","attempt":{"elapsedMs":12345,"hintsUsed":2,"hintWaitMs":1500,"eligible":true,"finished":false}}';
  v_save jsonb;
  v_bad jsonb;
  v_result jsonb;
  v_revision integer := 0;
  v_field text;
  v_legacy jsonb;
begin
  -- Each optional field independently establishes the older-client fence.
  foreach v_field in array array['rarity','attempt','both'] loop
    v_save := jsonb_set(v_base,'{levels}',jsonb_build_object('bosco-01-v1',case v_field
      when 'rarity' then v_level - 'attempt' when 'attempt' then v_level - 'rarity' else v_level end));
    v_result := public.save_game_progress(v_save,v_revision,'fantasy-v2',3);
    if v_result->'ok' <> 'true' or v_result->'save' <> v_save or (v_result->>'revision')::integer <> v_revision+1 then raise exception 'Enriched round-trip/revision failed: %',v_result; end if;
    v_revision := (v_result->>'revision')::integer;
    for v_legacy in select value from jsonb_array_elements(jsonb_build_array(v_base,'{"version":1,"activeLevel":0,"completed":[],"levels":{},"tutorial":{"rotated":false,"blockedSeen":false}}'::jsonb)) loop
      begin
        perform public.save_game_progress(v_legacy,v_revision,'fantasy-v2');
        raise exception 'Old client erased enriched progress';
      exception when invalid_parameter_value then null; end;
    end loop;
    v_result := public.save_game_progress(v_base,v_revision-1,'fantasy-v2');
    if v_result->'ok' <> 'false' or v_result->'save' <> v_save or (v_result->>'revision')::integer <> v_revision then raise exception 'Stale client did not receive complete conflict'; end if;
    v_result := public.save_game_progress(v_base,v_revision,'fantasy-v2',3);
    if v_result->'ok' <> 'true' or v_result->'save' <> v_base then raise exception 'Informed reset blocked'; end if;
    v_revision := (v_result->>'revision')::integer;
  end loop;

  -- Optional fields are strict wire data, never silently coerced or discarded.
  for v_bad in select value from jsonb_array_elements(jsonb_build_array(
    jsonb_set(v_level,'{rarity}','"legendary"'), jsonb_set(v_level,'{rarity}','null'),
    jsonb_set(v_level,'{rarity}','1'), jsonb_set(v_level,'{attempt}','null'),
    jsonb_set(v_level,'{attempt}','[]'), jsonb_set(v_level,'{attempt}','{}'),
    jsonb_set(v_level,'{attempt}',(v_level->'attempt')-'finished'),
    jsonb_set(v_level,'{attempt}',(v_level->'attempt')||'{"unknown":true}'),
    jsonb_set(v_level,'{attempt,eligible}','"true"'),
    jsonb_set(v_level,'{attempt,finished}','1'),
    jsonb_set(v_level,'{attempt,elapsedMs}','-1'),
    jsonb_set(v_level,'{attempt,hintsUsed}','1.5'),
    jsonb_set(v_level,'{attempt,hintWaitMs}','"1"'),
    jsonb_set(v_level,'{attempt,elapsedMs}','9007199254740992'),
    jsonb_set(v_level,'{attempt,elapsedMs}','86400001'),
    jsonb_set(v_level,'{attempt,hintWaitMs}','10001'),
    jsonb_set(jsonb_set(v_level,'{attempt,hintsUsed}','0'),'{attempt,hintWaitMs}','1'),
    jsonb_set(jsonb_set(v_level,'{attempt,hintsUsed}','100'),'{attempt,hintWaitMs}','30001'),
    v_level||'{"unknown":true}'
  )) loop
    begin
      perform public.save_game_progress(jsonb_set(v_base,'{levels}',jsonb_build_object('bosco-01-v1',v_bad)),v_revision,'fantasy-v2',3);
      raise exception 'Malformed attempt/rarity accepted: %',v_bad;
    exception when invalid_parameter_value then null; end;
  end loop;
  v_result := public.save_game_progress(v_base,v_revision,'fantasy-v2',3);
  if v_result->'ok' <> 'true' or (v_result->>'revision')::integer <> v_revision+1 then raise exception 'Invalid metadata changed revision'; end if;
  -- Local time/quality in a cloud snapshot cannot create leaderboard records.
  if exists(select 1 from public.get_leaderboard('discoveries') where is_you)
    or exists(select 1 from public.get_leaderboard('time','bosco-01-v1') where is_you) then raise exception 'Snapshot affected verified records'; end if;

  perform set_config('test.unified_run',public.start_timed_run('bosco-01-v1')->>'id',true);
end $$;
reset role;
-- Owner-controlled fixture clock proves elapsed time is server-derived.
update svela_private.timed_runs set started_at=clock_timestamp()-interval '3 seconds' where id=current_setting('test.unified_run')::uuid;
set local role authenticated;
do $$
declare
  v_result jsonb;
  v_proof jsonb := '["bosco-01-v1:-1,-1,-1","bosco-01-v1:1,1,1","bosco-01-v1:-1,-1,1","bosco-01-v1:1,1,-1","bosco-01-v1:-1,1,1","bosco-01-v1:1,-1,1","bosco-01-v1:-1,1,-1","bosco-01-v1:1,-1,-1"]';
begin
  begin
    perform public.finish_timed_run(current_setting('test.unified_run')::uuid,'[]');
    raise exception 'Incomplete first play accepted';
  exception when invalid_parameter_value then null; end;
  if exists(select 1 from public.get_leaderboard('discoveries') where is_you) then raise exception 'Invalid proof created discovery'; end if;
  v_result := public.finish_timed_run(current_setting('test.unified_run')::uuid,v_proof);
  if (v_result->>'elapsed_ms')::integer not between 3000 and 15000 then raise exception 'First play server clock failed: %',v_result; end if;
  if not exists(select 1 from public.get_leaderboard('discoveries') where is_you and value=1)
    or not exists(select 1 from public.get_leaderboard('time','bosco-01-v1') where is_you and value=(v_result->>'best_ms')::integer) then raise exception 'First play did not register discovery and time'; end if;
  perform public.submit_discovery('bosco-01-v1',v_proof);
  if (select value from public.get_leaderboard('discoveries') where is_you) <> 1 then raise exception 'First play discovery duplicated'; end if;
end $$;
reset role;
rollback;
