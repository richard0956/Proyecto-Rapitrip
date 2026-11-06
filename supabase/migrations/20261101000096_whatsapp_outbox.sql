-- WhatsApp (UltraMsg), solo para dos usos: la afiliación de comercios y el soporte con Rapitrip. No se usa para pedidos.
-- Misma forma que el correo (`private.email_outbox`): una bandeja, una función que la reclama y otra que marca el resultado.
-- La función de borde `send-outbox` la procesa junto con los correos; si UltraMsg falla, la solicitud ya quedó guardada.

create table private.whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  to_phone text not null,
  template text not null check (template in ('commerce_request_received')),
  data jsonb not null default '{}'::jsonb,
  -- 'omitido': el número no es válido o no hay servicio configurado; no se reintenta y `last_error` dice por qué.
  status text not null default 'pendiente' check (status in ('pendiente', 'enviando', 'enviado', 'fallido', 'omitido')),
  attempts int not null default 0,
  last_error text,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table private.whatsapp_outbox enable row level security;
revoke all on private.whatsapp_outbox from public, anon, authenticated, service_role;

create or replace function private.enqueue_whatsapp(p_to text, p_template text, p_data jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if p_to is null or btrim(p_to) = '' then
    return null;
  end if;
  insert into private.whatsapp_outbox (to_phone, template, data)
  values (btrim(p_to), p_template, coalesce(p_data, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.claim_whatsapp_outbox(p_limit int default 20)
returns table (id uuid, to_phone text, template text, data jsonb, attempts int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  return query
  with c as (
    select o.id from private.whatsapp_outbox o
    where (o.status in ('pendiente', 'fallido') and o.attempts < 5)
       or (o.status = 'enviando' and o.claimed_at < now() - interval '10 minutes')
    order by o.created_at
    limit greatest(p_limit, 1)
    for update skip locked)
  update private.whatsapp_outbox o
     set status = 'enviando', attempts = o.attempts + 1, claimed_at = now()
    from c
   where o.id = c.id
  returning o.id, o.to_phone, o.template, o.data, o.attempts;
end $$;

create or replace function public.mark_whatsapp_outbox(p_id uuid, p_ok boolean, p_error text default null, p_skip boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update private.whatsapp_outbox
     set status = case when p_ok then 'enviado' when p_skip then 'omitido' else 'fallido' end,
         last_error = left(p_error, 500),
         sent_at = case when p_ok then now() else null end
   where id = p_id;
end $$;

revoke all on function public.claim_whatsapp_outbox(int) from public, anon, authenticated;
revoke all on function public.mark_whatsapp_outbox(uuid, boolean, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_whatsapp_outbox(int) to service_role;
grant execute on function public.mark_whatsapp_outbox(uuid, boolean, text, boolean) to service_role;

-- Al llegar una solicitud de afiliación con teléfono se encola el agradecimiento. Un fallo aquí nunca debe impedir la solicitud.
create or replace function private.enqueue_commerce_request_whatsapp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_phone text := btrim(coalesce(new.details ->> 'phone', ''));
begin
  if v_phone = '' then
    return new;
  end if;
  begin
    perform private.enqueue_whatsapp(v_phone, 'commerce_request_received', jsonb_build_object(
      'business_name', new.business_name,
      'contact_name', new.details ->> 'contact_name',
      'request_id', new.id));
  exception when others then
    raise warning 'no se pudo encolar el WhatsApp de la solicitud %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

create trigger enqueue_whatsapp_after_commerce_request
  after insert on identity.commerce_requests
  for each row execute function private.enqueue_commerce_request_whatsapp();
