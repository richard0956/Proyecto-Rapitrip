-- Ajustes de la cuenta del cliente (fase 2): foto de perfil, preferencia de avisos por correo, solicitud de eliminación de
-- cuenta y comentarios. Todo lo escribe el propio cliente con una sesión vigente; lo de eliminación y comentarios lo lee la
-- administración desde la consola.

-- ───────── Foto de perfil ─────────
-- La ruta vive con los datos personales: al anonimizar una cuenta se borra con el resto.
alter table identity.profile_pii add column avatar_path text
  check (avatar_path is null or avatar_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_.-]{1,80}$');

-- Avisos: hoy el sistema manda por correo «pedido recibido» y «pedido cancelado». El cliente puede apagarlos.
alter table identity.profiles add column notify_order_email boolean not null default true;

create or replace view public.my_profile with (security_invoker = true) as
  select p.id, p.status, p.created_at, p.last_sign_in_at, pii.full_name, pii.email, pii.phone, pii.avatar_path, p.notify_order_email
  from identity.profiles p
  join identity.profile_pii pii on pii.user_id = p.id
  where p.id = auth.uid() and private.has_valid_session();

-- Bucket privado: cada cliente solo ve y escribe su carpeta <id>/…; la tienda muestra la foto con un enlace firmado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text and private.has_valid_session());
create policy avatars_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text and private.has_valid_session());
create policy avatars_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text and private.has_valid_session());
-- El director ve y borra la foto al atender una solicitud de eliminación de cuenta.
create policy avatars_select_director on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and private.has_any_role(array['superadmin']::identity.app_role[]));
create policy avatars_delete_director on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and private.has_any_role(array['superadmin']::identity.app_role[]));

-- Registra (o quita, con null) la foto ya subida a <id>/<archivo>.
create or replace function public.set_my_avatar(p_path text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  if p_path is not null and split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'ruta de foto inválida' using errcode = '22023';
  end if;
  update identity.profile_pii set avatar_path = p_path, updated_at = now() where user_id = auth.uid();
  if not found then
    raise exception 'perfil inexistente' using errcode = 'P0002';
  end if;
  perform private.write_audit(case when p_path is null then 'profile.avatar_removed' else 'profile.avatar_changed' end, 'profile', auth.uid()::text, null, null);
end $$;

create or replace function public.set_my_notifications(p_order_email boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  update identity.profiles set notify_order_email = coalesce(p_order_email, true) where id = auth.uid();
  perform private.write_audit('profile.notifications_changed', 'profile', auth.uid()::text, null,
    jsonb_build_object('order_email', coalesce(p_order_email, true)));
end $$;

-- Los correos de pedido respetan la preferencia del cliente.
create or replace function private.enqueue_order_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_email text;
  v_template text;
begin
  v_template := case
    when new.to_status = 'por_confirmar' then 'order_received'
    when new.to_status in ('cancelado', 'rechazado') then 'order_cancelled'
  end;
  if v_template is null then
    return new;
  end if;

  select * into v_order from sales.orders where id = new.order_id;
  if exists (select 1 from identity.profiles where id = v_order.client_id and not notify_order_email) then
    return new;
  end if;
  select email into v_email from identity.profile_pii where user_id = v_order.client_id;
  if v_email is null or btrim(v_email) = '' then
    return new;
  end if;

  perform private.enqueue_email(v_email, v_template, jsonb_build_object(
    'number', v_order.number,
    'order_id', v_order.id,
    'store_name', v_order.store_name,
    'total', v_order.total,
    'payment_method', v_order.payment_method,
    'status', new.to_status,
    'reason', new.reason));
  return new;
end $$;

-- ───────── Solicitud de eliminación de cuenta ─────────
-- El cliente la pide; el director la atiende con la anonimización (que borra datos personales, roles y el acceso) o la rechaza.
create table identity.deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identity.profiles(id) on delete cascade,
  reason text check (reason is null or char_length(reason) <= 500),
  status text not null default 'pendiente' check (status in ('pendiente', 'atendida', 'rechazada', 'cancelada')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500)
);
create unique index deletion_requests_one_pending on identity.deletion_requests (user_id) where status = 'pendiente';
alter table identity.deletion_requests enable row level security;
create policy deletion_requests_select_own on identity.deletion_requests
  for select to authenticated using (user_id = auth.uid());
grant select on identity.deletion_requests to authenticated;

create view public.my_deletion_requests with (security_invoker = true) as
  select id, status, created_at, resolved_at, resolution_note
  from identity.deletion_requests
  where user_id = auth.uid() and private.has_valid_session();
revoke all on public.my_deletion_requests from public, anon;
grant select on public.my_deletion_requests to authenticated;

create or replace function public.request_account_deletion(p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  if exists (select 1 from identity.user_roles where user_id = auth.uid() and status <> 'revocado') then
    raise exception 'esta cuenta tiene un rol en Rapitrip: pide a la administración que lo revoque antes' using errcode = '22023';
  end if;
  if exists (select 1 from identity.deletion_requests where user_id = auth.uid() and status = 'pendiente') then
    raise exception 'ya tienes una solicitud de eliminación pendiente' using errcode = '22023';
  end if;
  insert into identity.deletion_requests (user_id, reason)
  values (auth.uid(), nullif(left(btrim(coalesce(p_reason, '')), 500), ''))
  returning id into v_id;
  perform private.write_audit('account.deletion_requested', 'profile', auth.uid()::text, null, null);
  return v_id;
end $$;

create or replace function public.cancel_account_deletion()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  update identity.deletion_requests set status = 'cancelada', resolved_at = now(), resolved_by = auth.uid()
   where user_id = auth.uid() and status = 'pendiente';
  if not found then
    raise exception 'no tienes una solicitud pendiente' using errcode = 'P0002';
  end if;
  perform private.write_audit('account.deletion_cancelled', 'profile', auth.uid()::text, null, null);
end $$;

-- Lista para el director: solicitudes pendientes con el contacto de la cuenta (lectura auditada como el resto de datos personales).
create or replace function public.list_deletion_requests()
returns table (id uuid, user_id uuid, full_name text, email text, reason text, created_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if not private.has_any_role(array['superadmin']::identity.app_role[]) then
    raise exception 'acción reservada al director' using errcode = '42501';
  end if;
  perform private.write_audit('deletion_requests.listed', 'deletion_request', null, null, null);
  return query
    select r.id, r.user_id, pii.full_name, pii.email, r.reason, r.created_at
    from identity.deletion_requests r
    left join identity.profile_pii pii on pii.user_id = r.user_id
    where r.status = 'pendiente'
    order by r.created_at;
end $$;

-- Atiende (anonimiza la cuenta como pedido del titular) o rechaza una solicitud. El motivo queda en la auditoría.
create or replace function public.resolve_deletion_request(p_id uuid, p_approve boolean, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v identity.deletion_requests;
begin
  perform private.require_admin_console();
  if not private.has_any_role(array['superadmin']::identity.app_role[]) then
    raise exception 'acción reservada al director' using errcode = '42501';
  end if;
  if p_note is null or char_length(btrim(p_note)) < 5 then
    raise exception 'la nota es obligatoria (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select * into v from identity.deletion_requests where id = p_id for update;
  if not found or v.status <> 'pendiente' then
    raise exception 'la solicitud no está pendiente' using errcode = '22023';
  end if;
  if p_approve then
    perform public.confirm_anonymization(v.user_id, btrim(p_note), true);
    delete from identity.feedback where user_id = v.user_id;
  end if;
  update identity.deletion_requests
     set status = case when p_approve then 'atendida' else 'rechazada' end,
         resolved_at = now(), resolved_by = auth.uid(), resolution_note = left(btrim(p_note), 500)
   where id = p_id;
  perform private.write_audit(case when p_approve then 'account.deletion_approved' else 'account.deletion_rejected' end,
    'deletion_request', p_id::text, null, null, btrim(p_note), null);
  return v.user_id;
end $$;

-- ───────── Comentarios ─────────
create table identity.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identity.profiles(id) on delete cascade,
  topic text not null check (topic in ('compra', 'entrega', 'app', 'otro')),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(message) between 5 and 1000),
  created_at timestamptz not null default now()
);
create index feedback_created_idx on identity.feedback (created_at desc);
alter table identity.feedback enable row level security;
-- Sin políticas de lectura directa: el cliente escribe por función y la administración lee por función.

create or replace function public.send_feedback(p_topic text, p_rating int, p_message text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  perform private.require_valid_session();
  if p_topic not in ('compra', 'entrega', 'app', 'otro') then
    raise exception 'tema inválido' using errcode = '22023';
  end if;
  if p_rating is null or p_rating not between 1 and 5 then
    raise exception 'la calificación va de 1 a 5' using errcode = '22023';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 5 and 1000 then
    raise exception 'el comentario debe tener entre 5 y 1000 caracteres' using errcode = '22023';
  end if;
  -- Un tope sencillo contra el envío repetido: 5 comentarios por día.
  if (select count(*) from identity.feedback where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then
    raise exception 'ya enviaste varios comentarios hoy; inténtalo mañana' using errcode = '22023';
  end if;
  insert into identity.feedback (user_id, topic, rating, message)
  values (auth.uid(), p_topic, p_rating, btrim(p_message))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.list_feedback(p_limit int default 200)
returns table (id uuid, topic text, rating smallint, message text, created_at timestamptz, full_name text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query
    select f.id, f.topic, f.rating, f.message, f.created_at, pii.full_name
    from identity.feedback f
    left join identity.profile_pii pii on pii.user_id = f.user_id
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 200), 1), 500);
end $$;

revoke all on function public.set_my_avatar(text) from public, anon;
revoke all on function public.set_my_notifications(boolean) from public, anon;
revoke all on function public.request_account_deletion(text) from public, anon;
revoke all on function public.cancel_account_deletion() from public, anon;
revoke all on function public.list_deletion_requests() from public, anon;
revoke all on function public.resolve_deletion_request(uuid, boolean, text) from public, anon;
revoke all on function public.send_feedback(text, int, text) from public, anon;
revoke all on function public.list_feedback(int) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;
grant execute on function public.set_my_notifications(boolean) to authenticated;
grant execute on function public.request_account_deletion(text) to authenticated;
grant execute on function public.cancel_account_deletion() to authenticated;
grant execute on function public.list_deletion_requests() to authenticated;
grant execute on function public.resolve_deletion_request(uuid, boolean, text) to authenticated;
grant execute on function public.send_feedback(text, int, text) to authenticated;
grant execute on function public.list_feedback(int) to authenticated;
