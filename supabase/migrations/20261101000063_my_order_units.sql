-- Entregas express y programadas, etapa 7: el listado de pedidos del cliente se agrupa por compra.
-- Para paginar sin partir una compra por la mitad, la lista se pide por «unidades»: cada compra es una unidad (con todos sus
-- pedidos) y cada pedido suelto, anterior a las compras con varias tiendas, es una unidad de un pedido.
-- Solo ve las suyas: la vista respeta las políticas de pedidos (sesión de menos de un día) y filtra por el cliente.

create view public.my_order_units with (security_invoker = true) as
  select coalesce(o.checkout_id, o.id) as unit_id,
         o.checkout_id,
         max(o.created_at) as created_at,
         count(*)::int as order_count,
         sum(o.total) as total,
         max(c.payment_status) as payment_status
  from sales.orders o
  left join sales.checkouts c on c.id = o.checkout_id
  where o.client_id = auth.uid() and o.channel = 'web'
  group by coalesce(o.checkout_id, o.id), o.checkout_id;

revoke all on public.my_order_units from public, anon;
grant select on public.my_order_units to authenticated;
