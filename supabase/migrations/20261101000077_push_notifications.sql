-- Repartidor, etapa 6: avisos push (Web Push).
-- Diseño: docs/informe/2026-10-22-repartidor-ofertas-y-push-design.md (sección 4.3).
--
-- Mismo patrón que la bandeja de correos: una tabla de suscripciones (una por navegador instalado del repartidor), una cola de
-- envíos y una función de borde (`send-push`) que la vacía. Cuando la coordinación propone un pedido se encola un aviso GENÉRICO
-- («tienes una propuesta»): nunca lleva datos del cliente ni del pedido; el repartidor los ve al abrir la aplicación.
--
--   * La suscripción (dirección del servicio push y dos claves) es un dato personal ligado a un dispositivo: solo la lee su dueño
--     (sin las claves) y se borra al perder el repartidor su cuenta o su ficha.
--   * Un aviso vencido no se envía. Si la propuesta se cancela o vence, se encola un aviso para cerrar la notificación.
--   * El push solo avisa: la aplicación sigue consultando sus propuestas por su cuenta (no depende de que llegue).

create table identity.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references identity.profiles(id) on delete cascade,
  -- Postgres limita las repeticiones de una expresión regular a 255: el largo se valida aparte.
  endpoint text not null unique check (endpoint ~ '^https://[^[:space:]]+$' and char_length(endpoint) between 18 and 500),
  p256dh text not null check (p256dh ~ '^[A-Za-z0-9_-]{86,88}$'),
  auth text not null check (auth ~ '^[A-Za-z0-9_-]{22,24}$'),
  user_agent text check (user_agent is null or char_length(user_agent) <= 200),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on identity.push_subscriptions (user_id, created_at);
alter table identity.push_subscriptions enable row level security;
create policy push_subscriptions_select_own on identity.push_subscriptions
  for select to authenticated using (user_id = auth.uid() and private.is_courier_session());
-- Las claves no salen hacia las pantallas.
grant select (id, user_id, endpoint, user_agent, created_at, last_seen_at) on identity.push_subscriptions to authenticated;

create view public.my_push_subscriptions with (security_invoker = true) as
  select id, endpoint, user_agent, created_at, last_seen_at from identity.push_subscriptions where user_id = auth.uid();
revoke all on public.my_push_subscriptions from public, anon;
grant select on public.my_push_subscriptions to authenticated;

-- El repartidor registra el navegador donde instaló la aplicación. Si la dirección ya existía (dispositivo compartido), pasa a él.
create or replace function public.register_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_courier_session() then
    raise exception 'solo un repartidor con sesión activa activa los avisos' using errcode = '42501';
  end if;
  if p_endpoint is null or p_endpoint !~ '^https://[^[:space:]]+$' or char_length(p_endpoint) not between 18 and 500 then
    raise exception 'dirección de avisos no válida' using errcode = '22023';
  end if;
  if p_p256dh is null or p_p256dh !~ '^[A-Za-z0-9_-]{86,88}$' or p_auth is null or p_auth !~ '^[A-Za-z0-9_-]{22,24}$' then
    raise exception 'claves de avisos no válidas' using errcode = '22023';
  end if;
  insert into identity.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(nullif(btrim(p_user_agent), ''), 200))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now()
  returning id into v_id;
  -- Hasta 5 dispositivos por repartidor: se conservan los más recientes.
  delete from identity.push_subscriptions
   where user_id = auth.uid()
     and id not in (select id from identity.push_subscriptions where user_id = auth.uid() order by last_seen_at desc, created_at desc limit 5);
  perform private.write_audit('courier.push_registered', 'courier', auth.uid()::text);
  return v_id;
end $$;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'no autenticado' using errcode = '28000';
  end if;
  delete from identity.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  if found then
    perform private.write_audit('courier.push_unregistered', 'courier', auth.uid()::text);
  end if;
end $$;

-- Sin cuenta o sin ficha activa no hay avisos: se borran sus dispositivos.
create or replace function private.drop_push_on_courier_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from identity.push_subscriptions where user_id = old.user_id;
  return null;
end $$;
revoke all on function private.drop_push_on_courier_change() from public, anon, authenticated;
create trigger drop_push_on_courier_change
  after update of status, user_id on identity.couriers
  for each row when (old.user_id is not null and ((new.status = 'inactivo' and old.status is distinct from new.status) or new.user_id is distinct from old.user_id))
  execute function private.drop_push_on_courier_change();

-- Coordinación ve quién tiene los avisos activados (la columna nueva va al final de la vista).
create or replace function private.user_has_push(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user is not null and exists (select 1 from identity.push_subscriptions where user_id = p_user);
$$;
revoke all on function private.user_has_push(uuid) from public, anon;
grant execute on function private.user_has_push(uuid) to authenticated;

create or replace view public.couriers_list with (security_invoker = true) as
  select id, full_name, phone, vehicle_type, status, user_id, created_at, vehicle_class, department, available, available_since,
         private.user_has_push(user_id) as push_enabled
  from identity.couriers;

-- Cola de envíos ----------------------------------------------------------------------------------------------------------
create table private.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  kind text not null check (kind in ('oferta_nueva', 'oferta_cancelada')),
  offer_id uuid,
  status text not null default 'pendiente' check (status in ('pendiente', 'enviando', 'enviado', 'fallido', 'sin_destino', 'vencido')),
  attempts int not null default 0,
  last_error text,
  claimed_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index push_outbox_pending_idx on private.push_outbox (created_at) where status in ('pendiente', 'fallido', 'enviando');
alter table private.push_outbox enable row level security;
revoke all on private.push_outbox from public, anon, authenticated, service_role;

create or replace function private.enqueue_push(p_user uuid, p_kind text, p_offer uuid, p_expires timestamptz)
returns void language sql security definer set search_path = '' as $$
  insert into private.push_outbox (user_id, kind, offer_id, expires_at) values (p_user, p_kind, p_offer, p_expires);
$$;
revoke all on function private.enqueue_push(uuid, text, uuid, timestamptz) from public, anon, authenticated;

-- Una propuesta nueva avisa al repartidor; si se cancela o vence, se pide cerrar la notificación.
create or replace function private.push_on_offer_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select user_id into v_user from identity.couriers where id = new.courier_id;
  if v_user is not null then
    perform private.enqueue_push(v_user, 'oferta_nueva', new.id, new.expires_at);
  end if;
  return null;
end $$;
create or replace function private.push_on_offer_close()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  select user_id into v_user from identity.couriers where id = new.courier_id;
  if v_user is not null then
    perform private.enqueue_push(v_user, 'oferta_cancelada', new.id, now() + interval '2 minutes');
  end if;
  return null;
end $$;
revoke all on function private.push_on_offer_insert(), private.push_on_offer_close() from public, anon, authenticated;
create trigger push_on_offer_insert after insert on sales.order_offers
  for each row execute function private.push_on_offer_insert();
create trigger push_on_offer_close after update of status on sales.order_offers
  for each row when (old.status = 'pendiente' and new.status in ('cancelada', 'vencida'))
  execute function private.push_on_offer_close();

-- Para la función de borde (solo service_role) -----------------------------------------------------------------------------
-- Toma hasta p_limit avisos y devuelve una fila por aviso y dispositivo. Descarta antes los vencidos y los de quien no tiene
-- dispositivos. Reintenta hasta 3 veces; un aviso «enviando» abandonado hace más de 2 minutos se vuelve a tomar.
create or replace function public.claim_push(p_limit int default 20)
returns table (outbox_id uuid, kind text, offer_id uuid, expires_at timestamptz, subscription_id uuid, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare v_ids uuid[];
begin
  with c as (
    select o.id from private.push_outbox o
     where (o.status in ('pendiente', 'fallido') and o.attempts < 3)
        or (o.status = 'enviando' and o.claimed_at < now() - interval '2 minutes')
     order by o.created_at
     limit least(greatest(coalesce(p_limit, 20), 1), 100)
     for update skip locked),
  u as (
    update private.push_outbox o set status = 'enviando', attempts = o.attempts + 1, claimed_at = now()
      from c where o.id = c.id returning o.id)
  select coalesce(array_agg(u.id), '{}') into v_ids from u;

  update private.push_outbox o set status = 'vencido' where o.id = any (v_ids) and o.expires_at <= now();
  update private.push_outbox o set status = 'sin_destino'
   where o.id = any (v_ids) and o.status = 'enviando'
     and not exists (select 1 from identity.push_subscriptions s where s.user_id = o.user_id);

  return query
    select o.id, o.kind, o.offer_id, o.expires_at, s.id, s.endpoint, s.p256dh, s.auth
      from private.push_outbox o
      join identity.push_subscriptions s on s.user_id = o.user_id
     where o.id = any (v_ids) and o.status = 'enviando'
     order by o.created_at, s.created_at;
end $$;

-- p_sent: llegó a al menos un dispositivo. p_gone: dispositivos que el servicio push dio por inexistentes (404 o 410).
create or replace function public.finish_push(p_outbox uuid, p_sent boolean, p_error text default null, p_gone uuid[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(array_length(p_gone, 1), 0) > 0 then
    delete from identity.push_subscriptions where id = any (p_gone);
  end if;
  update private.push_outbox
     set status = case when p_sent then 'enviado' else 'fallido' end,
         last_error = left(p_error, 500),
         sent_at = case when p_sent then now() else null end
   where id = p_outbox;
end $$;

-- La función de borde también puede dispararla la consola de coordinación al proponer un pedido: esta función solo confirma que
-- quien llama es coordinación (así no hace falta darle el secreto compartido a la consola).
create or replace function public.push_kick()
returns boolean language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_coordination_console() then
    raise exception 'no puedes disparar avisos' using errcode = '42501';
  end if;
  return true;
end $$;

revoke all on function
  public.register_push_subscription(text, text, text, text), public.unregister_push_subscription(text),
  public.claim_push(int), public.finish_push(uuid, boolean, text, uuid[]), public.push_kick()
from public, anon, authenticated;
grant execute on function public.register_push_subscription(text, text, text, text), public.unregister_push_subscription(text), public.push_kick()
  to authenticated;
grant execute on function public.claim_push(int), public.finish_push(uuid, boolean, text, uuid[]) to service_role;
