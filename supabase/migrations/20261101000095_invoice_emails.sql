-- Facturas de Rapitrip, etapa 5: los correos del pedido llevan los números de las facturas.
-- El correo «pedido recibido» se encola al registrarse el evento del pedido, pero las facturas se emiten al final de la
-- transacción (migración 94). Al emitirlas, se agregan a ese correo, que sigue «pendiente» porque nadie lo envía hasta que
-- la transacción termina. Lo mismo con las notas de crédito en el correo «pedido cancelado».

create or replace function private.attach_invoices_to_email(p_order uuid, p_template text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_template = 'order_received' then
    update private.email_outbox o
       set data = o.data || jsonb_build_object('invoices', (
             select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'number', i.number) order by case i.kind when 'venta' then 0 when 'servicio' then 1 when 'nota_credito_venta' then 2 else 3 end, i.number), '[]'::jsonb)
               from sales.invoices i where i.order_id = p_order and i.credit_for is null))
     where o.template = 'order_received' and o.status = 'pendiente' and o.data ->> 'order_id' = p_order::text;
  elsif p_template = 'order_cancelled' then
    update private.email_outbox o
       set data = o.data || jsonb_build_object('credit_notes', (
             select coalesce(jsonb_agg(jsonb_build_object('kind', i.kind, 'number', i.number) order by case i.kind when 'venta' then 0 when 'servicio' then 1 when 'nota_credito_venta' then 2 else 3 end, i.number), '[]'::jsonb)
               from sales.invoices i where i.order_id = p_order and i.credit_for is not null))
     where o.template = 'order_cancelled' and o.status = 'pendiente' and o.data ->> 'order_id' = p_order::text;
  end if;
end $$;
revoke all on function private.attach_invoices_to_email(uuid, text) from public, anon, authenticated;

create or replace function private.invoice_on_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.to_status = 'por_confirmar' then
    perform private.issue_order_invoices(new.order_id);
    perform private.attach_invoices_to_email(new.order_id, 'order_received');
  elsif new.to_status in ('cancelado', 'rechazado') then
    perform private.issue_credit_notes(new.order_id, coalesce(nullif(btrim(new.reason), ''), 'Pedido ' || new.to_status));
    perform private.attach_invoices_to_email(new.order_id, 'order_cancelled');
  end if;
  return new;
end $$;
