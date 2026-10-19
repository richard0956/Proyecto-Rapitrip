-- Fase 4, etapa 4: `create_order` idempotente.
-- Un doble clic, un reintento de red o el botón «atrás» no deben crear dos pedidos (ni reservar el stock dos veces).
-- El navegador genera un `client_ref` por intento de checkout; si llega repetido, se devuelve el pedido ya creado.
--
-- El cuerpo ya probado de `create_order` no se toca: pasa a `private.create_order_core` y la función pública
-- (con un parámetro opcional más, por lo que las llamadas de seis argumentos siguen funcionando) lo envuelve.

alter table sales.orders add column client_ref uuid;
create unique index orders_client_ref_unique on sales.orders (client_id, client_ref) where client_ref is not null;

alter function public.create_order(uuid, jsonb, text, text, text, text) set schema private;
alter function private.create_order(uuid, jsonb, text, text, text, text) rename to create_order_core;
revoke all on function private.create_order_core(uuid, jsonb, text, text, text, text) from public, anon, authenticated;

create or replace function public.create_order(
  p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text,
  p_notes text default null, p_client_ref uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform private.require_valid_session();
  if p_client_ref is null then
    return private.create_order_core(p_store, p_items, p_payment_method, p_address, p_phone, p_notes);
  end if;

  -- Serializa los intentos simultáneos con la misma referencia: el segundo espera al primero y encuentra su pedido.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_client_ref::text, 0));
  select id into v_id from sales.orders where client_id = auth.uid() and client_ref = p_client_ref;
  if found then
    return v_id;
  end if;

  v_id := private.create_order_core(p_store, p_items, p_payment_method, p_address, p_phone, p_notes);
  update sales.orders set client_ref = p_client_ref where id = v_id;
  return v_id;
end $$;

revoke all on function public.create_order(uuid, jsonb, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.create_order(uuid, jsonb, text, text, text, text, uuid) to authenticated;
