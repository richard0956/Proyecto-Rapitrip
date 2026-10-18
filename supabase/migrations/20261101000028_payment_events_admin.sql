-- Fase 3, etapa 6: la administración ve los pagos de Stripe que quedaron por reembolsar.
-- Un pago tarde, doble o de otro monto se reembolsa solo; si el reembolso falla (Stripe caído, por ejemplo) el evento queda
-- con resultado `reembolsar_*` y Stripe reintenta. Mientras tanto, la pantalla de excepciones lo muestra.

create policy payment_events_select_admin on sales.payment_events
  for select to authenticated using (private.is_admin_console());
grant select on sales.payment_events to authenticated;

create view public.payment_events_list with (security_invoker = true) as
  select e.event_id, e.event_type, e.order_id, o.number as order_number, e.outcome, e.received_at, e.updated_at
  from sales.payment_events e
  left join sales.orders o on o.id = e.order_id
  where e.outcome like 'reembolsar%';

revoke all on public.payment_events_list from public, anon;
grant select on public.payment_events_list to authenticated;
