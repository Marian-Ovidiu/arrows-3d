-- Integration checks: run AFTER the migration as postgres/database owner.
-- Supabase SQL Editor: execute the entire file. psql: -v ON_ERROR_STOP=1 -f ...
-- Fixtures and account deletions are rolled back; never use real user IDs here.
begin;

insert into auth.users(id, aud, role, email)
values
  ('92f238b9-5c38-4a04-a1a1-d44329b43501', 'authenticated', 'authenticated', 'sql-test-a@example.invalid'),
  ('92f238b9-5c38-4a04-a1a1-d44329b43502', 'authenticated', 'authenticated', 'sql-test-b@example.invalid');

do $$
begin
  if pg_catalog.has_table_privilege('authenticated', 'public.game_progress', 'INSERT')
    or pg_catalog.has_table_privilege('authenticated', 'public.game_progress', 'UPDATE')
    or pg_catalog.has_table_privilege('authenticated', 'public.game_progress', 'DELETE')
    or pg_catalog.has_function_privilege('anon', 'public.save_game_progress(jsonb,integer,text,integer)', 'EXECUTE')
    or pg_catalog.has_function_privilege('anon', 'public.delete_own_account()', 'EXECUTE')
    or pg_catalog.has_function_privilege('service_role', 'public.delete_own_account()', 'EXECUTE') then
    raise exception 'Unexpected write/execute grants';
  end if;
  if exists (
    select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('save_game_progress', 'delete_own_account')
      and (not p.prosecdef or not ('search_path=""' = any(p.proconfig)))
  ) then raise exception 'Missing SECURITY DEFINER or empty search_path'; end if;
end;
$$;

select pg_catalog.set_config('test.save', '{"version":1,"activeLevel":3,"completed":[],"levels":{},"tutorial":{"rotated":false,"blockedSeen":false}}', true);
set local role authenticated;
select pg_catalog.set_config('request.jwt.claims', '{"sub":"92f238b9-5c38-4a04-a1a1-d44329b43501","role":"authenticated"}', true);

do $$
declare
  v_save jsonb := pg_catalog.current_setting('test.save')::jsonb;
  v_result jsonb;
  v_bad jsonb;
  v_rejected boolean;
begin
  v_result := public.save_game_progress(v_save, 8);
  if v_result <> '{"ok":false,"save":null,"revision":0,"updated_at":null}'::jsonb then
    raise exception 'Missing-row conflict contract failed'; end if;
  v_result := public.save_game_progress(v_save, 0);
  if v_result->'ok' <> 'true'::jsonb or v_result->'revision' <> '1'::jsonb
    or v_result->'save' <> v_save or v_result->>'updated_at' is null then
    raise exception 'First save failed'; end if;
  v_result := public.save_game_progress(pg_catalog.jsonb_set(v_save, '{activeLevel}', '0'), 1);
  if v_result->'ok' <> 'true'::jsonb or v_result->'revision' <> '2'::jsonb then
    raise exception 'CAS update failed'; end if;
  -- A second device has revision 1: its write must return the latest, not replace it.
  v_result := public.save_game_progress(v_save, 1);
  if v_result->'ok' <> 'false'::jsonb or v_result->'revision' <> '2'::jsonb
    or v_result->'save'->'activeLevel' <> '0'::jsonb then
    raise exception 'Stale write overwrote progress'; end if;
  v_result := public.save_game_progress(v_save, 0);
  if v_result->'ok' <> 'false'::jsonb or v_result->'revision' <> '2'::jsonb then
    raise exception 'Duplicate insert overwrote progress'; end if;

  for v_bad in select value from pg_catalog.jsonb_array_elements(pg_catalog.jsonb_build_array(
    null, '[]'::jsonb, v_save - 'tutorial',
    pg_catalog.jsonb_set(v_save, '{version}', '2'),
    pg_catalog.jsonb_set(v_save, '{activeLevel}', '4'),
    pg_catalog.jsonb_set(v_save, '{activeLevel}', '"1"'),
    pg_catalog.jsonb_set(v_save, '{completed}', '[0,0]'),
    pg_catalog.jsonb_set(v_save, '{completed}', '[null]'),
    pg_catalog.jsonb_set(v_save, '{levels}', '{"0":{}}'),
    pg_catalog.jsonb_set(v_save, '{levels}', '{"4":{"removedIds":[]}}'),
    pg_catalog.jsonb_set(v_save, '{levels}', '{"0":{"removedIds":[1]}}'),
    pg_catalog.jsonb_set(v_save, '{tutorial}', '{"rotated":null,"blockedSeen":false}'),
    v_save || pg_catalog.jsonb_build_object('oversized', pg_catalog.repeat('x',100001))
  )) loop
    v_rejected := false;
    begin perform public.save_game_progress(v_bad, 2);
    exception when invalid_parameter_value then v_rejected := true; end;
    if not v_rejected then raise exception 'Malformed save accepted: %', v_bad; end if;
  end loop;
  v_rejected := false;
  begin perform public.save_game_progress(v_save, -1);
  exception when invalid_parameter_value then v_rejected := true; end;
  if not v_rejected then raise exception 'Negative revision accepted'; end if;

  v_rejected := false;
  begin update public.game_progress set revision = 99;
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Direct write accepted'; end if;
end;
$$;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"92f238b9-5c38-4a04-a1a1-d44329b43502","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.game_progress) then raise exception 'RLS leaked account A'; end if;
  perform public.save_game_progress(pg_catalog.current_setting('test.save')::jsonb, 0);
  if (select pg_catalog.count(*) from public.game_progress) <> 1 then raise exception 'Owner read failed'; end if;
end;
$$;

select pg_catalog.set_config('request.jwt.claims', '{"sub":"92f238b9-5c38-4a04-a1a1-d44329b43501","role":"authenticated"}', true);
do $$
declare v_rejected boolean;
begin
  if (select pg_catalog.count(*) from public.game_progress) <> 1 then raise exception 'RLS leaked account B'; end if;
  if public.delete_own_account() is distinct from true then raise exception 'Deletion failed'; end if;
  if exists (select 1 from public.game_progress) then raise exception 'Progress survived deletion'; end if;
  -- A previously issued JWT may not have expired: neither RPC may resurrect/use it.
  v_rejected := false;
  begin perform public.save_game_progress(pg_catalog.current_setting('test.save')::jsonb, 0);
  exception when invalid_authorization_specification then v_rejected := true; end;
  if not v_rejected then raise exception 'Deleted JWT recreated progress'; end if;
  v_rejected := false;
  begin perform public.delete_own_account();
  exception when invalid_authorization_specification then v_rejected := true; end;
  if not v_rejected then raise exception 'Deleted JWT remained authorized'; end if;
end;
$$;

select pg_catalog.set_config('request.jwt.claims', '{}', true);
do $$
declare v_rejected boolean;
begin
  v_rejected := false;
  begin perform public.save_game_progress(pg_catalog.current_setting('test.save')::jsonb, 0);
  exception when invalid_authorization_specification then v_rejected := true; end;
  if not v_rejected then raise exception 'Missing uid accepted by save'; end if;
  v_rejected := false;
  begin perform public.delete_own_account();
  exception when invalid_authorization_specification then v_rejected := true; end;
  if not v_rejected then raise exception 'Missing uid accepted by delete'; end if;
end;
$$;

reset role;
do $$
begin
  if exists (select 1 from auth.users where id = '92f238b9-5c38-4a04-a1a1-d44329b43501')
    or exists (select 1 from public.game_progress where user_id = '92f238b9-5c38-4a04-a1a1-d44329b43501') then
    raise exception 'Account/progress deletion was incomplete'; end if;
  if not exists (select 1 from auth.users where id = '92f238b9-5c38-4a04-a1a1-d44329b43502')
    or not exists (select 1 from public.game_progress where user_id = '92f238b9-5c38-4a04-a1a1-d44329b43502') then
    raise exception 'Deletion affected another account'; end if;
end;
$$;

set local role anon;
do $$
declare v_rejected boolean;
begin
  v_rejected := false;
  begin perform public.save_game_progress(pg_catalog.current_setting('test.save')::jsonb, 0);
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Anonymous save was authorized'; end if;
  v_rejected := false;
  begin perform public.delete_own_account();
  exception when insufficient_privilege then v_rejected := true; end;
  if not v_rejected then raise exception 'Anonymous deletion was authorized'; end if;
end;
$$;
reset role;
rollback;
-- Success: no exceptions, final ROLLBACK. The two fixture users do not persist.
