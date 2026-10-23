-- Devoluciones, etapa 10: el cliente ve el estado y la decisión de su solicitud en la app.
-- Solo devuelve filas del propio cliente: para cualquier otro usuario el resultado es vacío.

create or replace function public.my_return_request(p_order uuid)
returns table (request_id uuid, status text, reason text, photo_count integer, decision_note text, requested_at timestamptz, decided_at timestamptz, payment_method text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.has_valid_session() then
    raise exception 'inicia sesión para ver tu devolución' using errcode = '42501';
  end if;
  return query
    select r.id, r.status, r.reason, cardinality(r.photos)::integer, r.decision_note, r.created_at, r.decided_at, o.payment_method
      from sales.return_requests r
      join sales.orders o on o.id = r.order_id
     where r.order_id = p_order and r.client_id = auth.uid();
end $$;

revoke all on function public.my_return_request(uuid) from public, anon;
grant execute on function public.my_return_request(uuid) to authenticated;
