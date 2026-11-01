-- Run as the project database owner (Supabase SQL Editor or `supabase db push`).
begin;

create table public.game_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save jsonb not null,
  revision integer not null check (revision > 0),
  updated_at timestamptz not null default pg_catalog.now()
);

alter table public.game_progress enable row level security;
revoke all on table public.game_progress from public, anon, authenticated;
grant select on table public.game_progress to authenticated;
create policy "Read own progress" on public.game_progress
  for select to authenticated using ((select auth.uid()) = user_id);

create function public.save_game_progress(p_save jsonb, p_expected_revision integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_current public.game_progress%rowtype;
  v_key text;
  v_level jsonb;
  v_value jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  -- Identical key in delete_own_account: a save cannot recreate a deleted account.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 732641));
  if not exists (select 1 from auth.users where id = v_uid) then
    raise exception 'Account no longer exists' using errcode = '28000';
  end if;
  if p_expected_revision is null or p_expected_revision < 0 then
    raise exception 'Invalid expected revision' using errcode = '22023';
  end if;

  -- This is the version-1 wire format. The client also checks legal puzzle moves.
  if p_save is null or pg_catalog.jsonb_typeof(p_save) <> 'object'
    or pg_catalog.octet_length(p_save::text) > 100000 then
    raise exception 'Invalid save or save too large' using errcode = '22023';
  end if;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_save)) <> 5
    or not (p_save ?& array['version', 'activeLevel', 'completed', 'levels', 'tutorial'])
    or p_save->'version' <> '1'::jsonb
    or pg_catalog.jsonb_typeof(p_save->'activeLevel') <> 'number'
    or not (p_save->>'activeLevel' ~ '^[0-3]$')
    or pg_catalog.jsonb_typeof(p_save->'completed') <> 'array'
    or pg_catalog.jsonb_typeof(p_save->'levels') <> 'object'
    or pg_catalog.jsonb_typeof(p_save->'tutorial') <> 'object' then
    raise exception 'Invalid save shape or version' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(p_save->'completed') > 4
    or (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(p_save->'tutorial')) <> 2
    or not (p_save->'tutorial' ?& array['rotated', 'blockedSeen'])
    or pg_catalog.jsonb_typeof(p_save->'tutorial'->'rotated') <> 'boolean'
    or pg_catalog.jsonb_typeof(p_save->'tutorial'->'blockedSeen') <> 'boolean' then
    raise exception 'Invalid tutorial or completed levels' using errcode = '22023';
  end if;
  for v_value in select value from pg_catalog.jsonb_array_elements(p_save->'completed') loop
    if pg_catalog.jsonb_typeof(v_value) <> 'number' or not (v_value::text ~ '^[0-3]$') then
      raise exception 'Invalid completed level' using errcode = '22023';
    end if;
  end loop;
  if (select pg_catalog.count(*) from pg_catalog.jsonb_array_elements(p_save->'completed'))
    <> (select pg_catalog.count(distinct value) from pg_catalog.jsonb_array_elements(p_save->'completed')) then
    raise exception 'Duplicate completed level' using errcode = '22023';
  end if;
  for v_key, v_level in select key, value from pg_catalog.jsonb_each(p_save->'levels') loop
    if v_key !~ '^[0-3]$' or pg_catalog.jsonb_typeof(v_level) <> 'object' then
      raise exception 'Invalid level' using errcode = '22023';
    end if;
    if (select pg_catalog.count(*) from pg_catalog.jsonb_object_keys(v_level)) <> 1
      or pg_catalog.jsonb_typeof(v_level->'removedIds') is distinct from 'array' then
      raise exception 'Invalid level history' using errcode = '22023';
    end if;
    if pg_catalog.jsonb_array_length(v_level->'removedIds') > 80 then
      raise exception 'Level history too large' using errcode = '22023';
    end if;
    for v_value in select value from pg_catalog.jsonb_array_elements(v_level->'removedIds') loop
      if pg_catalog.jsonb_typeof(v_value) <> 'string'
        or pg_catalog.length(v_value #>> '{}') not between 1 and 64 then
        raise exception 'Invalid piece identifier' using errcode = '22023';
      end if;
    end loop;
  end loop;

  select * into v_current from public.game_progress where user_id = v_uid;
  if found then
    if v_current.revision <> p_expected_revision then
      return pg_catalog.jsonb_build_object('ok', false, 'save', v_current.save,
        'revision', v_current.revision, 'updated_at', v_current.updated_at);
    end if;
    update public.game_progress set save = p_save, revision = revision + 1,
      updated_at = pg_catalog.clock_timestamp()
      where user_id = v_uid returning * into v_current;
  else
    if p_expected_revision <> 0 then
      return pg_catalog.jsonb_build_object('ok', false, 'save', null,
        'revision', 0, 'updated_at', null);
    end if;
    insert into public.game_progress(user_id, save, revision, updated_at)
      values (v_uid, p_save, 1, pg_catalog.clock_timestamp()) returning * into v_current;
  end if;
  return pg_catalog.jsonb_build_object('ok', true, 'save', v_current.save,
    'revision', v_current.revision, 'updated_at', v_current.updated_at);
end;
$$;

create function public.delete_own_account()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text, 732641));
  delete from auth.users where id = v_uid;
  if not found then
    raise exception 'Account no longer exists' using errcode = '28000';
  end if;
  return true;
end;
$$;

revoke all on function public.save_game_progress(jsonb, integer) from public, anon, authenticated, service_role;
revoke all on function public.delete_own_account() from public, anon, authenticated, service_role;
grant execute on function public.save_game_progress(jsonb, integer) to authenticated;
grant execute on function public.delete_own_account() to authenticated;

commit;
