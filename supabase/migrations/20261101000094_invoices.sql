-- Facturas de Rapitrip, etapa 1: registro contable propio, sin validez fiscal.
-- Diseño: docs/informe/2026-11-05-facturacion-design.md.
--
-- Cada pedido web tiene dos facturas con numeración de la plataforma: la de venta (productos, `subtotal`) y la de servicio
-- (envío, `delivery_fee`; solo si es mayor que cero). Se emiten cuando el pedido pasa a «por_confirmar» (efectivo al crearse,
-- tarjeta al confirmarse el pago). Si el pedido se cancela, se rechaza o se aprueba su devolución, se emiten notas de crédito
-- enlazadas. Un documento emitido no se modifica ni se borra.
-- Los datos personales del comprador viven aparte (`sales.invoice_buyers`) para poder borrarlos al anonimizar la cuenta sin
-- tocar el documento ni su huella.

-- Contadores de las series --------------------------------------------------------------------------------------------------

create table sales.document_counters (
  series text primary key check (series in ('venta', 'servicio', 'nc_venta', 'nc_servicio')),
  last_number int not null default 0 check (last_number >= 0)
);
insert into sales.document_counters (series) values ('venta'), ('servicio'), ('nc_venta'), ('nc_servicio');
alter table sales.document_counters enable row level security;
revoke all on sales.document_counters from public, anon, authenticated;

-- Siguiente número de la serie. El `update` bloquea la fila hasta que termina la transacción: si esta se deshace, el número
-- no se consume y no quedan huecos (una secuencia de Postgres sí los dejaría).
create or replace function private.next_document_number(p_series text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  update sales.document_counters set last_number = last_number + 1 where series = p_series returning last_number into v_n;
  if v_n is null then
    raise exception 'serie de documentos desconocida' using errcode = '22023';
  end if;
  return case p_series
    when 'venta' then 'RT-V-'
    when 'servicio' then 'RT-S-'
    when 'nc_venta' then 'RT-NCV-'
    else 'RT-NCS-'
  end || lpad(v_n::text, 6, '0');
end $$;
revoke all on function private.next_document_number(text) from public, anon, authenticated;

-- Libro de facturas y notas de crédito -------------------------------------------------------------------------------------

create table sales.invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales.orders(id),
  kind text not null check (kind in ('venta', 'servicio', 'nota_credito_venta', 'nota_credito_servicio')),
  number text not null unique,
  issued_at timestamptz not null default now(),
  credit_for uuid references sales.invoices(id),
  reason text check (reason is null or char_length(reason) between 3 and 300),
  data jsonb not null,
  total numeric(12, 2) not null check (total >= 0),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  constraint invoices_credit_pair check ((kind in ('nota_credito_venta', 'nota_credito_servicio')) = (credit_for is not null))
);
create index invoices_order_idx on sales.invoices (order_id, issued_at);
create index invoices_issued_idx on sales.invoices (issued_at desc);
-- Un pedido tiene una sola factura de cada tipo y una sola nota de crédito por factura.
create unique index invoices_one_per_kind_idx on sales.invoices (order_id, kind) where credit_for is null;
create unique index invoices_one_credit_idx on sales.invoices (credit_for) where credit_for is not null;

create or replace function private.block_invoice_changes()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'una factura emitida no se modifica ni se borra: se corrige con una nota de crédito' using errcode = '42501';
end $$;
create trigger invoices_append_only before update or delete on sales.invoices
  for each row execute function private.block_invoice_changes();
create trigger invoices_no_truncate before truncate on sales.invoices
  for each statement execute function private.block_invoice_changes();

alter table sales.invoices enable row level security;
revoke all on sales.invoices from public, anon, authenticated;

-- Comprador (personal): se borra al anonimizar la cuenta; el documento y su huella no cambian.
create table sales.invoice_buyers (
  order_id uuid primary key references sales.orders(id) on delete cascade,
  full_name text,
  email text
);
alter table sales.invoice_buyers enable row level security;
revoke all on sales.invoice_buyers from public, anon, authenticated;

create or replace function private.wipe_invoice_buyers()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from sales.invoice_buyers b using sales.orders o where o.id = b.order_id and o.client_id = new.id;
  return new;
end $$;
create trigger wipe_invoice_buyers_on_anonymize
  after update of status on identity.profiles
  for each row when (new.status = 'anonimizada' and old.status is distinct from new.status)
  execute function private.wipe_invoice_buyers();

-- Emisión -----------------------------------------------------------------------------------------------------------------

-- Guarda un documento con su huella (sha256 del `data` en forma canónica de jsonb).
create or replace function private.insert_invoice(
  p_order uuid, p_kind text, p_series text, p_data jsonb, p_total numeric, p_credit_for uuid default null, p_reason text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  insert into sales.invoices (order_id, kind, number, credit_for, reason, data, total, sha256)
  values (p_order, p_kind, private.next_document_number(p_series), p_credit_for, p_reason, p_data, p_total,
          encode(sha256(convert_to(p_data::text, 'UTF8')), 'hex'))
  returning id into v_id;
  return v_id;
end $$;
revoke all on function private.insert_invoice(uuid, text, text, jsonb, numeric, uuid, text) from public, anon, authenticated;

-- Emite la factura de venta y, si hay envío cobrado, la de servicio. Solo pedidos web; idempotente.
create or replace function private.issue_order_invoices(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  o sales.orders;
  v_base jsonb;
  v_lines jsonb;
  v_commerce text;
begin
  select * into o from sales.orders where id = p_order;
  if not found or o.channel <> 'web' then
    return;
  end if;
  if exists (select 1 from sales.invoices where order_id = p_order and credit_for is null) then
    return;
  end if;

  select name into v_commerce from identity.commerces where id = o.commerce_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'product', i.product_name, 'variant', i.variant_name, 'sku', i.sku,
           'quantity', i.quantity, 'unit_price', i.unit_price, 'line_total', i.line_total) order by i.product_name, i.variant_name), '[]'::jsonb)
    into v_lines from sales.order_items i where i.order_id = p_order;

  v_base := jsonb_build_object(
    'issuer', 'Rapitrip',
    'legend', 'Comprobante interno de Rapitrip, sin validez fiscal',
    'order_number', o.number,
    'store_name', o.store_name,
    'commerce_name', v_commerce,
    'payment_method', o.payment_method,
    'payment_intent_id', o.payment_intent_id,
    'currency', upper(o.payment_currency),
    'delivery_class', o.delivery_class,
    'eta_min_days', o.eta_min_days,
    'eta_max_days', o.eta_max_days,
    'order_created_at', o.created_at);

  insert into sales.invoice_buyers (order_id, full_name, email)
  select o.id, pii.full_name, pii.email from identity.profile_pii pii where pii.user_id = o.client_id
  on conflict (order_id) do nothing;

  perform private.insert_invoice(p_order, 'venta', 'venta',
    v_base || jsonb_build_object('lines', v_lines, 'subtotal', o.subtotal, 'total', o.subtotal), o.subtotal);

  if o.delivery_fee > 0 then
    perform private.insert_invoice(p_order, 'servicio', 'servicio',
      v_base || jsonb_build_object(
        'lines', jsonb_build_array(jsonb_build_object(
          'product', case o.delivery_class when 'programado' then 'Servicio de entrega programada' else 'Servicio de entrega express' end,
          'quantity', 1, 'unit_price', o.delivery_fee, 'line_total', o.delivery_fee)),
        'total', o.delivery_fee),
      o.delivery_fee);
  end if;
end $$;
revoke all on function private.issue_order_invoices(uuid) from public, anon, authenticated;

-- Emite la nota de crédito de cada factura del pedido que aún no la tenga (anulación total).
create or replace function private.issue_credit_notes(p_order uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r sales.invoices;
  v_reason text := left(coalesce(nullif(btrim(p_reason), ''), 'Anulación del pedido'), 300);
begin
  for r in
    select * from sales.invoices i
     where i.order_id = p_order and i.credit_for is null
       and not exists (select 1 from sales.invoices c where c.credit_for = i.id)
     order by i.issued_at, i.id
  loop
    perform private.insert_invoice(p_order,
      case r.kind when 'venta' then 'nota_credito_venta' else 'nota_credito_servicio' end,
      case r.kind when 'venta' then 'nc_venta' else 'nc_servicio' end,
      r.data || jsonb_build_object('credit_for_number', r.number, 'original_issued_at', r.issued_at, 'reason', v_reason),
      r.total, r.id, v_reason);
  end loop;
end $$;
revoke all on function private.issue_credit_notes(uuid, text) from public, anon, authenticated;

-- Un solo punto de enganche: el historial del pedido (el mismo del correo «pedido recibido»).
-- Pedido que nunca pasó a «por_confirmar» (pago sin completar) no tiene facturas y, por tanto, tampoco notas de crédito.
create or replace function private.invoice_on_order_event()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.to_status = 'por_confirmar' then
    perform private.issue_order_invoices(new.order_id);
  elsif new.to_status in ('cancelado', 'rechazado') then
    perform private.issue_credit_notes(new.order_id, coalesce(nullif(btrim(new.reason), ''), 'Pedido ' || new.to_status));
  end if;
  return new;
end $$;
revoke all on function private.invoice_on_order_event() from public, anon, authenticated;

-- Diferido hasta el final de la transacción: `create_checkout` registra el evento «por_confirmar» y recién después fija el
-- envío, la clase de entrega y los plazos del pedido. Emitir en el momento del evento copiaría datos a medias.
create constraint trigger invoice_after_order_event
  after insert on sales.order_events
  deferrable initially deferred
  for each row execute function private.invoice_on_order_event();

-- Devolución aprobada: nota de crédito total.
create or replace function private.invoice_on_return_approved()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'aprobada' and old.status is distinct from 'aprobada' then
    perform private.issue_credit_notes(new.order_id, 'Devolución aprobada');
  end if;
  return new;
end $$;
revoke all on function private.invoice_on_return_approved() from public, anon, authenticated;

create trigger invoice_after_return_approved
  after update of status on sales.return_requests
  for each row execute function private.invoice_on_return_approved();

-- Lectura -------------------------------------------------------------------------------------------------------------------

-- Quién puede ver las facturas de un pedido: administración (todo), el comercio dueño (venta y sus notas) o el cliente.
create or replace function private.invoice_access(p_order uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare o sales.orders;
begin
  select * into o from sales.orders where id = p_order;
  if not found then
    return null;
  end if;
  if private.is_admin_console() then
    return 'admin';
  end if;
  if private.has_role('comercio', o.commerce_id) and private.has_strong_session() then
    return 'comercio';
  end if;
  if o.client_id = auth.uid() and private.has_valid_session() then
    return 'cliente';
  end if;
  return null;
end $$;
revoke all on function private.invoice_access(uuid) from public, anon, authenticated;

create or replace function public.order_invoices(p_order uuid)
returns table (id uuid, kind text, number text, issued_at timestamptz, total numeric, credit_for uuid)
language plpgsql stable security definer set search_path = '' as $$
declare v_access text := private.invoice_access(p_order);
begin
  if v_access is null then
    raise exception 'no puedes ver las facturas de este pedido' using errcode = '42501';
  end if;
  return query
    select i.id, i.kind, i.number, i.issued_at, i.total, i.credit_for
      from sales.invoices i
     where i.order_id = p_order
       and (v_access <> 'comercio' or i.kind in ('venta', 'nota_credito_venta'))
     order by i.issued_at, i.number;
end $$;

-- Un documento completo, listo para mostrarse o generar su PDF. El estado de pago no está en el documento: se toma del pedido.
-- El comercio no ve al comprador (igual que no ve sus datos de entrega) ni la referencia de pago.
create or replace function public.get_invoice(p_invoice uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  i sales.invoices;
  o sales.orders;
  b sales.invoice_buyers;
  v_access text;
  v_data jsonb;
begin
  select * into i from sales.invoices where id = p_invoice;
  if not found then
    raise exception 'factura no encontrada' using errcode = 'P0002';
  end if;
  v_access := private.invoice_access(i.order_id);
  if v_access is null or (v_access = 'comercio' and i.kind not in ('venta', 'nota_credito_venta')) then
    raise exception 'no puedes ver esta factura' using errcode = '42501';
  end if;
  select * into o from sales.orders where id = i.order_id;
  select * into b from sales.invoice_buyers where order_id = i.order_id;
  v_data := case when v_access = 'comercio' then i.data - 'payment_intent_id' else i.data end;
  return jsonb_build_object(
    'id', i.id, 'order_id', i.order_id, 'kind', i.kind, 'number', i.number, 'issued_at', i.issued_at,
    'total', i.total, 'reason', i.reason, 'sha256', i.sha256, 'data', v_data,
    'credit_for_number', (select c.number from sales.invoices c where c.id = i.credit_for),
    'buyer_name', case when v_access = 'comercio' then null else b.full_name end,
    'buyer_email', case when v_access = 'comercio' then null else b.email end,
    'buyer_anonymized', (b.order_id is null),
    'payment_status', o.payment_status,
    'order_status', o.status,
    'delivered_at', o.delivered_at,
    'delivery_confirmed_at', (select c.delivery_verified_at from sales.order_codes c where c.order_id = i.order_id));
end $$;

-- Libro contable para administración, con filtros. `p_to` es exclusivo.
create or replace function public.invoice_ledger(
  p_from timestamptz, p_to timestamptz, p_commerce uuid default null, p_method text default null, p_kind text default null,
  p_limit int default 500
) returns table (
  id uuid, kind text, number text, issued_at timestamptz, total numeric, order_id uuid, order_number bigint,
  commerce_id uuid, commerce_name text, payment_method text, payment_status text, credit_for_number text
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'indica un rango de fechas válido' using errcode = '22023';
  end if;
  return query
    select i.id, i.kind, i.number, i.issued_at, i.total, i.order_id, o.number, o.commerce_id, c.name,
           o.payment_method, o.payment_status, (select n.number from sales.invoices n where n.id = i.credit_for)
      from sales.invoices i
      join sales.orders o on o.id = i.order_id
      join identity.commerces c on c.id = o.commerce_id
     where i.issued_at >= p_from and i.issued_at < p_to
       and (p_commerce is null or o.commerce_id = p_commerce)
       and (p_method is null or o.payment_method = p_method)
       and (p_kind is null or i.kind = p_kind)
     order by i.issued_at desc, i.number desc
     limit greatest(1, least(coalesce(p_limit, 500), 2000));
end $$;

revoke all on function public.order_invoices(uuid), public.get_invoice(uuid),
  public.invoice_ledger(timestamptz, timestamptz, uuid, text, text, int) from public, anon;
grant execute on function public.order_invoices(uuid), public.get_invoice(uuid),
  public.invoice_ledger(timestamptz, timestamptz, uuid, text, text, int) to authenticated;
