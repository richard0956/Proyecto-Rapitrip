-- Arqueo y cierre de caja, etapa 1: referencias de pago, recepción de efectivo de repartidor e incidencias de caja.
-- Ver docs/superpowers/specs/2026-10-20-arqueo-cierre-caja-design.md.
-- payment_ref: voucher del terminal (mostrador con tarjeta), identificador de la pasarela (web con tarjeta)
--              o código de cobro CE-XXXXXX (efectivo). Único por tienda mientras el pedido no esté cancelado.
-- cash_received_*: cuándo y en qué turno el cajero recibió el efectivo físico que entregó el repartidor.

alter table sales.orders
  add column payment_ref text check (payment_ref is null or char_length(payment_ref) between 4 and 20),
  add column cash_received_at timestamptz,
  add column cash_received_session uuid references sales.cash_sessions(id),
  add constraint orders_cash_received_pair check ((cash_received_at is null) = (cash_received_session is null));

create unique index orders_payment_ref_uniq on sales.orders (store_id, payment_ref)
  where payment_ref is not null and status <> 'cancelado';

-- Incidencias de un turno, una fila por diferencia. Solo se leen por funciones de caja y administración.
create table sales.cash_session_incidents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sales.cash_sessions(id),
  order_id uuid references sales.orders(id),
  commerce_id uuid references identity.commerces(id),
  kind text not null check (kind in (
    'pago_no_confirmado', 'voucher_faltante', 'efectivo_no_recibido',
    'sin_movimiento_stock', 'movimiento_sin_venta', 'descuadre_stock', 'diferencia_efectivo')),
  detail text not null check (char_length(detail) between 1 and 300),
  created_at timestamptz not null default now()
);
create index cash_session_incidents_session_idx on sales.cash_session_incidents (session_id);

alter table sales.cash_session_incidents enable row level security;
revoke all on sales.cash_session_incidents from public, anon, authenticated;
