-- Arqueo y cierre de caja, etapa 7: la lista de pedidos muestra el código de cobro y si el cajero ya recibió el efectivo.
-- Las columnas nuevas van al final para no cambiar las existentes.

create or replace view public.orders_list with (security_invoker = true) as
  select o.id, o.number, o.client_id, o.store_id, o.store_name, o.commerce_id, o.status, o.payment_method,
         o.payment_status, o.subtotal, o.delivery_fee, o.total, o.courier_id, o.status_reason, o.expires_at,
         o.created_at, o.updated_at, o.confirmed_at, o.delivered_at,
         (select coalesce(sum(i.quantity), 0) from sales.order_items i where i.order_id = o.id) as item_count,
         o.channel, o.cashier_id, o.cash_session_id,
         o.payment_ref, o.cash_received_at
  from sales.orders o;
