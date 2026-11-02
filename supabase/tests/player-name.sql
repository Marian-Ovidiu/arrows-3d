-- Run after the name migration; all synthetic records are rolled back.
begin;
do $$
declare v_id uuid := 'c2751acd-596e-4d4d-a0ac-86db0640a001';
begin
  if svela_private.player_name('{"full_name":"Amica Rossi"}',v_id) <> 'Amica' then raise exception 'Family name exposed'; end if;
  if svela_private.player_name('{"given_name":"Maria Teresa","full_name":"Maria Teresa Rossi"}',v_id) <> 'Maria Teresa' then raise exception 'Compound given name lost'; end if;
  if svela_private.player_name('{"full_name":"","name":"Élodie Dupont"}',v_id) <> 'Élodie' then raise exception 'Name fallback failed'; end if;
  if svela_private.player_name('{"given_name":17,"full_name":null}',v_id) not like 'Esploratore %' then raise exception 'Invalid metadata leaked'; end if;
  if svela_private.player_name('{"display_name":"  Luna   Blu  ","full_name":"Amica Rossi"}',v_id) <> 'Luna Blu' then raise exception 'Nickname lost'; end if;
  insert into auth.users(id,aud,role,email,raw_user_meta_data) values(v_id,'authenticated','authenticated','name-test@example.invalid','{"given_name":"Amica","full_name":"Amica Rossi"}');
  insert into svela_private.verified_discoveries(user_id,level_key) values(v_id,'bosco-01-v1');
  perform pg_catalog.set_config('request.jwt.claims',pg_catalog.jsonb_build_object('sub',v_id,'role','authenticated')::text,true);
  if (select name from public.get_leaderboard('discoveries') where is_you) <> 'Amica' then raise exception 'Ranking did not use Google given name'; end if;
  update auth.users set raw_user_meta_data=raw_user_meta_data || '{"display_name":"Esploratrice"}'::jsonb where id=v_id;
  if (select name from public.get_leaderboard('discoveries') where is_you) <> 'Esploratrice' then raise exception 'Ranking ignored edited nickname'; end if;
end;
$$;
rollback;
