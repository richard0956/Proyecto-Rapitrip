begin;
select plan(17);

create temp table tu (k text primary key, id uuid);
grant select on tu to public;
insert into tu select 'adm',  tests.create_user('adm@t.test');
insert into tu select 'old',  tests.create_user('old@t.test');
insert into tu select 'back', tests.create_user('back@t.test');
insert into tu select 'new',  tests.create_user('new@t.test');
insert into tu select 'caj',  tests.create_user('caj@t.test');
insert into tu select 'com',  tests.create_user('com@t.test');
select tests.grant_role((select id from tu where k = 'adm'), 'admin');
select tests.grant_role((select id from tu where k = 'caj'), 'cajero');
select tests.grant_role((select id from tu where k = 'com'), 'comercio', tests.create_commerce('C1'));

update identity.profiles set last_sign_in_at = now() - interval '13 months'
 where id in (select id from tu where k in ('old', 'back', 'caj', 'com'));
select private.mark_inactive_candidates();

select isnt((select anonymization_candidate_since from identity.profiles where id = (select id from tu where k = 'old')),
  null, 'una cuenta de cliente con 13 meses sin entrar queda como candidata');
select isnt((select anonymization_candidate_since from identity.profiles where id = (select id from tu where k = 'back')),
  null, 'otra cuenta inactiva también');
select is((select anonymization_candidate_since from identity.profiles where id = (select id from tu where k = 'new')),
  null, 'una cuenta reciente no es candidata');
select is((select anonymization_candidate_since from identity.profiles where id = (select id from tu where k = 'caj')),
  null, 'una cuenta de personal nunca es candidata');
select is((select anonymization_candidate_since from identity.profiles where id = (select id from tu where k = 'com')),
  null, 'una cuenta con comercio activo nunca es candidata');

update auth.users set last_sign_in_at = now() where id = (select id from tu where k = 'back');
select is((select anonymization_candidate_since from identity.profiles where id = (select id from tu where k = 'back')),
  null, 'si la persona vuelve a entrar, deja de ser candidata');

select tests.authenticate_as((select id from tu where k = 'adm'));
select ok(public.list_anonymization_candidates()
  @> jsonb_build_array(jsonb_build_object('user_id', (select id from tu where k = 'old'))),
  'el admin ve a la candidata en la lista');
select throws_ok(format($$select public.confirm_anonymization(%L, 'sin ser candidata')$$, (select id from tu where k = 'back')),
  '22023', null::text, 'no se anonimiza a quien no es candidata ni lo pidió el titular');
select lives_ok(format($$select public.confirm_anonymization(%L, 'inactiva más de 12 meses')$$, (select id from tu where k = 'old')),
  'el admin confirma la anonimización de la candidata');
reset role;

select is((select count(*) from identity.profile_pii where user_id = (select id from tu where k = 'old')), 0::bigint,
  'se borran los datos personales');
select is((select status::text from identity.profiles where id = (select id from tu where k = 'old')), 'anonimizada',
  'el perfil se conserva como identificador anónimo');
select is((select count(*) from auth.users where id = (select id from tu where k = 'old')), 0::bigint,
  'se borra el usuario de acceso');
select is((select count(*) from identity.user_roles where user_id = (select id from tu where k = 'old') and status <> 'revocado'),
  0::bigint, 'se revocan todos sus roles');
select ok(exists (select 1 from audit.events where action = 'account.anonymized'
  and target_id = (select id::text from tu where k = 'old')
  and (coalesce(after_data, '{}'::jsonb)::text || metadata::text) not like '%old@t.test%'),
  'queda auditado y la auditoría no guarda el correo');

select tests.authenticate_as((select id from tu where k = 'adm'));
select throws_ok(format($$select public.confirm_anonymization(%L, 'intento sobre personal', true)$$, (select id from tu where k = 'caj')),
  '22023', null::text, 'una cuenta con rol operativo no se anonimiza hasta revocar el rol');
select lives_ok(format($$select public.confirm_anonymization(%L, 'solicitud del titular', true)$$, (select id from tu where k = 'new')),
  'a pedido del titular se anonimiza aunque no sea candidata');
reset role;

select tests.authenticate_as((select id from tu where k = 'caj'));
select throws_ok(format($$select public.confirm_anonymization(%L, 'intento no autorizado', true)$$, (select id from tu where k = 'back')),
  '42501', null::text, 'el cajero no anonimiza cuentas');
reset role;

select * from finish();
rollback;