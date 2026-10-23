-- Arqueo y cierre de caja, etapa 6: lecturas para la pantalla de caja.
-- pending_courier_cash: efectivo que el repartidor registró al entregar y que el cajero aún no recibe.
-- cash_session_incidents_for: incidencias de un turno. La ve el cajero dueño del turno y la administración.

create or replace function public.pending_courier_cash()
returns table (order_id uuid, order_number bigint, store_name text, total numeric, payment_ref text, delivered_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_cashier();
  return query
    select o.id, o.number, o.store_name, o.total, o.payment_ref, o.delivered_at
      from sales.orders o
     where o.channel = 'web' and o.payment_method = 'efectivo' and o.payment_ref is not null
       and o.cash_received_at is null and o.status = 'entregado'
     order by o.delivered_at;
end $$;

create or replace function public.cash_session_incidents_for(p_session uuid)
returns table (kind text, detail text, commerce_name text, order_number bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.is_admin_console()
          or (private.is_cashier() and exists (select 1 from sales.cash_sessions s where s.id = p_session and s.cashier_id = auth.uid()))) then
    raise exception 'no puedes ver las incidencias de este turno' using errcode = '42501';
  end if;
  return query
    select i.kind, i.detail, c.name, o.number
      from sales.cash_session_incidents i
      left join identity.commerces c on c.id = i.commerce_id
      left join sales.orders o on o.id = i.order_id
     where i.session_id = p_session
     order by c.name nulls last, i.created_at;
end $$;

revoke all on function public.pending_courier_cash(), public.cash_session_incidents_for(uuid) from public, anon;
grant execute on function public.pending_courier_cash(), public.cash_session_incidents_for(uuid) to authenticated;
