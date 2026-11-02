-- Run after every migration, against an isolated database as owner. Rolls back.
begin;
insert into auth.users(id,aud,role,email) values
('36d210d0-0010-4000-8000-000000000050','authenticated','authenticated','fifty@example.invalid');
select set_config('test.expanded_key',(select level_key from svela_private.puzzle_catalog where catalog_version='fantasy-v2' and ranked order by level_key limit 1),true);
do $$ begin
  if (select count(*) from svela_private.puzzle_catalog where ranked) <> 50 then raise exception 'Expected 50 ranked puzzles'; end if;
  if (select count(*) from svela_private.puzzle_catalog where catalog_version='fantasy-v1') <> 16 then raise exception 'Original catalog identities changed'; end if;
  if pg_catalog.has_function_privilege('authenticated','svela_private.save_game_progress_v2(jsonb,integer)','execute')
    or pg_catalog.has_function_privilege('anon','public.save_game_progress(jsonb,integer,text,integer)','execute')
    or pg_catalog.has_function_privilege('service_role','public.save_game_progress(jsonb,integer,text,integer)','execute') then raise exception 'Compatibility wrapper is bypassable'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"36d210d0-0010-4000-8000-000000000050","role":"authenticated"}',true);
do $$
declare
  v_base jsonb := '{"version":2,"activeLevel":"bosco-01-v1","completed":[],"levels":{},"bestTimes":{},"tutorial":{"rotated":false,"blockedSeen":false}}';
  v_save jsonb;
  v_key text := current_setting('test.expanded_key');
  v_reference text;
  v_revision integer := 0;
  v_result jsonb;
begin
  -- All old formats remain usable before expanded progress exists.
  v_result := public.save_game_progress(v_base,v_revision);
  if v_result->'ok' <> 'true' then raise exception 'Old fifteen-level client rejected prematurely'; end if;
  v_revision := (v_result->>'revision')::integer;
  foreach v_reference in array array['activeLevel','completed','levels','bestTimes'] loop
    v_save := case v_reference
      when 'activeLevel' then jsonb_set(v_base,'{activeLevel}',to_jsonb(v_key))
      when 'completed' then jsonb_set(v_base,'{completed}',jsonb_build_array(v_key))
      when 'levels' then jsonb_set(v_base,'{levels}',jsonb_build_object(v_key,jsonb_build_object('removedIds','[]'::jsonb)))
      else jsonb_set(v_base,'{bestTimes}',jsonb_build_object(v_key,1234)) end;
    v_result := public.save_game_progress(v_save,v_revision,'fantasy-v2');
    if v_result->'ok' <> 'true' then raise exception 'New campaign save rejected'; end if;
    v_revision := (v_result->>'revision')::integer;
    begin
      perform public.save_game_progress(v_base,v_revision);
      raise exception 'Old client erased expanded %',v_reference;
    exception when invalid_parameter_value then null;
    end;
    begin
      perform public.save_game_progress('{"version":1,"activeLevel":0,"completed":[],"levels":{},"tutorial":{"rotated":false,"blockedSeen":false}}',v_revision);
      raise exception 'Legacy v1 client erased expanded %',v_reference;
    exception when invalid_parameter_value then null;
    end;
    v_result := public.save_game_progress(v_base,v_revision-1);
    if v_result->'ok' <> 'false' or v_result->'save' <> v_save then raise exception 'CAS conflict did not preserve expanded save'; end if;
    -- An explicit overwrite/reset from an informed current client remains possible.
    v_result := public.save_game_progress(v_base,v_revision,'fantasy-v2');
    if v_result->'ok' <> 'true' then raise exception 'Current client reset blocked'; end if;
    v_revision := (v_result->>'revision')::integer;
  end loop;
end $$;
reset role;
rollback;
