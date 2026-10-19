-- Fase 4, etapa 7: correos mínimos del pedido (decisión D5): «pedido recibido» y «pedido cancelado o rechazado».
-- Un solo punto de encolado: el historial del pedido. «Recibido» sale cuando el pedido queda por confirmar (en efectivo al
-- crearse; con tarjeta al confirmarse el pago). «Cancelado» sale al cancelarse, rechazarse o vencer, con el motivo.
-- El correo sale por la bandeja existente (`send-outbox`); si la cuenta no tiene correo (anonimizada), no se encola nada.

alter table private.email_outbox drop constraint if exists email_outbox_template_check;
alter table private.email_outbox add constraint email_outbox_template_check
  check (template in ('commerce_approved', 'commerce_rejected', 'incident_alert', 'order_received', 'order_cancelled'));

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

create trigger enqueue_order_email_after_event
  after insert on sales.order_events
  for each row execute function private.enqueue_order_email();
