-- Liquidaciones a los comercios (Política 9 del Manual de Políticas de TI).
--   Norma 9.1      cada liquidación dice pedido, monto y fecha; la periodicidad del convenio no pasa de 15 días; se puede ver el
--                  neto de cada pedido (cobro, liquidación y reversión).
--   Norma 9.2      una devolución aprobada sobre un pedido ya liquidado genera una reversión, que se descuenta en la siguiente
--                  liquidación; quién asume el costo lo dice el convenio.
--   Control 9.1.1  cada mes se concilian cobros, liquidaciones y reversiones, y queda registro con diferencias y correcciones.
-- Se liquida lo vendido en productos (el subtotal); el envío es de Rapitrip y del repartidor. La comisión la fija el convenio.

-- 1. Convenio de cada comercio ----------------------------------------------------------------------------------------------
create table sales.commerce_agreements (
  commerce_id uuid primary key references identity.commerces(id),
  commission_pct numeric(5, 2) not null default 0 check (commission_pct between 0 and 100),
  period_days int not null default 15 check (period_days between 1 and 15),
  return_cost_bearer text not null default 'comercio' check (return_cost_bearer in ('comercio', 'rapitrip')),
  updated_by uuid,
  updated_at timestamptz not null default now()
);

-- El convenio vigente (o el de por defecto si todavía no se cargó).
create or replace function private.agreement(p_commerce uuid)
returns sales.commerce_agreements language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select a from sales.commerce_agreements a where a.commerce_id = p_commerce),
    row(p_commerce, 0, 15, 'comercio', null, now())::sales.commerce_agreements);
$$;

create or replace function public.set_commerce_agreement(p_commerce uuid, p_commission_pct numeric, p_period_days int, p_return_cost_bearer text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  if not exists (select 1 from identity.commerces where id = p_commerce) then
    raise exception 'comercio inexistente' using errcode = 'P0002';
  end if;
  if p_commission_pct is null or p_commission_pct not between 0 and 100 then
    raise exception 'la comisión va de 0 a 100 %%' using errcode = '22023';
  end if;
  if p_period_days is null or p_period_days not between 1 and 15 then
    raise exception 'la liquidación es cada 1 a 15 días (Norma 9.1.3)' using errcode = '22023';
  end if;
  if p_return_cost_bearer not in ('comercio', 'rapitrip') then
    raise exception 'indica quién asume el costo de las devoluciones' using errcode = '22023';
  end if;
  insert into sales.commerce_agreements (commerce_id, commission_pct, period_days, return_cost_bearer, updated_by, updated_at)
  values (p_commerce, p_commission_pct, p_period_days, p_return_cost_bearer, auth.uid(), now())
  on conflict (commerce_id) do update
    set commission_pct = excluded.commission_pct, period_days = excluded.period_days,
        return_cost_bearer = excluded.return_cost_bearer, updated_by = excluded.updated_by, updated_at = now();
  perform private.write_audit('agreement.updated', 'commerce', p_commerce::text, null,
    jsonb_build_object('commission_pct', p_commission_pct, 'period_days', p_period_days, 'return_cost_bearer', p_return_cost_bearer));
end $$;

-- 2. Liquidaciones y reversiones (evidencia: solo de inserción) -------------------------------------------------------------
create table sales.settlements (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  commerce_id uuid not null references identity.commerces(id),
  orders_count int not null,
  gross numeric(12, 2) not null,
  commission numeric(12, 2) not null,
  reversals numeric(12, 2) not null,
  net numeric(12, 2) not null,
  commission_pct numeric(5, 2) not null,
  reference text check (reference is null or char_length(reference) <= 120),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
create index settlements_commerce_idx on sales.settlements (commerce_id, created_at desc);

create table sales.settlement_items (
  settlement_id uuid not null references sales.settlements(id),
  order_id uuid primary key references sales.orders(id),
  subtotal numeric(12, 2) not null,
  commission numeric(12, 2) not null,
  amount numeric(12, 2) not null
);

create table sales.settlement_reversals (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references identity.commerces(id),
  order_id uuid not null references sales.orders(id),
  return_request_id uuid not null unique references sales.return_requests(id),
  amount numeric(12, 2) not null check (amount >= 0),
  bearer text not null check (bearer in ('comercio', 'rapitrip')),
  created_at timestamptz not null default now(),
  applied_settlement_id uuid references sales.settlements(id),
  applied_at timestamptz
);

create table sales.reconciliations (
  id uuid primary key default gen_random_uuid(),
  month date not null,
  totals jsonb not null,
  differences text not null check (char_length(differences) between 2 and 2000),
  corrections text check (corrections is null or char_length(corrections) <= 2000),
  done_by uuid not null,
  done_at timestamptz not null default now()
);

create trigger settlements_append_only before update or delete on sales.settlements
  for each row execute function private.block_evidence_changes();
create trigger settlement_items_append_only before update or delete on sales.settlement_items
  for each row execute function private.block_evidence_changes();
create trigger reconciliations_append_only before update or delete on sales.reconciliations
  for each row execute function private.block_evidence_changes();

alter table sales.commerce_agreements enable row level security;
alter table sales.settlements enable row level security;
alter table sales.settlement_items enable row level security;
alter table sales.settlement_reversals enable row level security;
alter table sales.reconciliations enable row level security;
revoke all on sales.commerce_agreements, sales.settlements, sales.settlement_items, sales.settlement_reversals, sales.reconciliations
  from public, anon, authenticated;

-- Pedidos por liquidar: entregados y cobrados, sin liquidar y sin una devolución aprobada.
create or replace function private.pending_settlement_orders(p_commerce uuid)
returns table (order_id uuid, number bigint, delivered_at timestamptz, subtotal numeric, commission numeric, amount numeric)
language sql stable security definer set search_path = '' as $$
  select o.id, o.number, o.delivered_at, o.subtotal,
         round(o.subtotal * (private.agreement(p_commerce)).commission_pct / 100, 2),
         o.subtotal - round(o.subtotal * (private.agreement(p_commerce)).commission_pct / 100, 2)
    from sales.orders o
   where o.commerce_id = p_commerce and o.status = 'entregado' and o.payment_status = 'pagado'
     and not exists (select 1 from sales.settlement_items i where i.order_id = o.id)
     and not exists (select 1 from sales.return_requests r where r.order_id = o.id and r.status = 'aprobada')
   order by o.delivered_at;
$$;

-- Norma 9.2: al aprobarse una devolución de un pedido ya liquidado, nace su reversión (por lo liquidado, si el costo es del
-- comercio; en cero, si lo asume Rapitrip, para que quede la constancia).
create or replace function private.reverse_settlement_on_return()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_item sales.settlement_items;
  v_order sales.orders;
  v_bearer text;
begin
  if new.status = 'aprobada' and old.status is distinct from 'aprobada' then
    select * into v_item from sales.settlement_items where order_id = new.order_id;
    if found then
      select * into v_order from sales.orders where id = new.order_id;
      v_bearer := (private.agreement(v_order.commerce_id)).return_cost_bearer;
      insert into sales.settlement_reversals (commerce_id, order_id, return_request_id, amount, bearer)
      values (v_order.commerce_id, new.order_id, new.id, case when v_bearer = 'comercio' then v_item.amount else 0 end, v_bearer)
      on conflict (return_request_id) do nothing;
    end if;
  end if;
  return new;
end $$;

create trigger return_requests_reverse_settlement
  after update of status on sales.return_requests
  for each row execute function private.reverse_settlement_on_return();

-- Estado de cada comercio: cuánto hay por liquidar y cuándo toca (la última liquidación más el periodo del convenio; si
-- nunca se liquidó, desde el pedido más antiguo por liquidar).
create or replace function public.settlements_overview()
returns table (commerce_id uuid, commerce_name text, pending_orders int, pending_amount numeric, pending_reversals numeric,
               commission_pct numeric, period_days int, return_cost_bearer text, last_settled_at timestamptz, due_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query
    select c.id, c.name,
           (select count(*)::int from private.pending_settlement_orders(c.id)),
           coalesce((select sum(p.amount) from private.pending_settlement_orders(c.id) p), 0),
           coalesce((select sum(r.amount) from sales.settlement_reversals r where r.commerce_id = c.id and r.applied_settlement_id is null), 0),
           (private.agreement(c.id)).commission_pct, (private.agreement(c.id)).period_days, (private.agreement(c.id)).return_cost_bearer,
           (select max(s.created_at) from sales.settlements s where s.commerce_id = c.id),
           coalesce((select max(s.created_at) from sales.settlements s where s.commerce_id = c.id),
                    (select min(p.delivered_at) from private.pending_settlement_orders(c.id) p))
             + make_interval(days => (private.agreement(c.id)).period_days)
      from identity.commerces c
     order by 10 nulls last, c.name;
end $$;

create or replace function public.settlement_preview(p_commerce uuid)
returns table (order_id uuid, number bigint, delivered_at timestamptz, subtotal numeric, commission numeric, amount numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query select * from private.pending_settlement_orders(p_commerce);
end $$;

-- Registra la liquidación: todos los pedidos pendientes menos las reversiones pendientes (Norma 9.2.4: se descuentan en la
-- siguiente liquidación). Una liquidación sin pedidos ni reversiones no se registra.
create or replace function public.record_settlement(p_commerce uuid, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_number bigint;
  v_pct numeric := (private.agreement(p_commerce)).commission_pct;
  v_count int;
  v_gross numeric;
  v_commission numeric;
  v_reversals numeric;
begin
  perform private.require_admin_console();
  perform 1 from identity.commerces where id = p_commerce for update;
  if not found then
    raise exception 'comercio inexistente' using errcode = 'P0002';
  end if;
  select count(*), coalesce(sum(subtotal), 0), coalesce(sum(commission), 0)
    into v_count, v_gross, v_commission from private.pending_settlement_orders(p_commerce);
  select coalesce(sum(amount), 0) into v_reversals
    from sales.settlement_reversals where commerce_id = p_commerce and applied_settlement_id is null;
  if v_count = 0 and v_reversals = 0 then
    raise exception 'no hay pedidos ni reversiones por liquidar' using errcode = '22023';
  end if;
  insert into sales.settlements (commerce_id, orders_count, gross, commission, reversals, net, commission_pct, reference, created_by)
  values (p_commerce, v_count, v_gross, v_commission, v_reversals, v_gross - v_commission - v_reversals, v_pct,
          nullif(left(btrim(coalesce(p_reference, '')), 120), ''), auth.uid())
  returning id, number into v_id, v_number;
  insert into sales.settlement_items (settlement_id, order_id, subtotal, commission, amount)
  select v_id, p.order_id, p.subtotal, p.commission, p.amount from private.pending_settlement_orders(p_commerce) p;
  update sales.settlement_reversals set applied_settlement_id = v_id, applied_at = now()
   where commerce_id = p_commerce and applied_settlement_id is null;
  perform private.write_audit('settlement.recorded', 'settlement', v_id::text, null,
    jsonb_build_object('commerce_id', p_commerce, 'orders', v_count, 'net', v_gross - v_commission - v_reversals));
  return jsonb_build_object('id', v_id, 'number', v_number, 'net', v_gross - v_commission - v_reversals, 'orders', v_count);
end $$;

create or replace function public.settlements_history(p_commerce uuid default null)
returns table (id uuid, number bigint, commerce_id uuid, commerce_name text, orders_count int, gross numeric, commission numeric,
               reversals numeric, net numeric, reference text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare v_own uuid := private.session_commerce();
begin
  perform private.require_console_session();
  -- La administración ve todas (o las de un comercio); el comercio, solo las suyas.
  if not private.has_any_role(array['admin', 'superadmin']::identity.app_role[]) then
    if v_own is null then
      raise exception 'no tienes permiso para ver liquidaciones' using errcode = '42501';
    end if;
    p_commerce := v_own;
  end if;
  return query
    select s.id, s.number, s.commerce_id, c.name, s.orders_count, s.gross, s.commission, s.reversals, s.net, s.reference, s.created_at
      from sales.settlements s join identity.commerces c on c.id = s.commerce_id
     where p_commerce is null or s.commerce_id = p_commerce
     order by s.created_at desc limit 100;
end $$;

-- Lo que el comercio tiene por cobrar todavía (sus pedidos pendientes de liquidar y sus reversiones pendientes).
create or replace function public.my_settlement_status()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_own uuid := private.session_commerce();
begin
  perform private.require_console_session();
  if v_own is null then
    raise exception 'no tienes permiso para ver liquidaciones' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pending_orders', (select count(*) from private.pending_settlement_orders(v_own)),
    'pending_amount', coalesce((select sum(amount) from private.pending_settlement_orders(v_own)), 0),
    'pending_reversals', coalesce((select sum(amount) from sales.settlement_reversals where commerce_id = v_own and applied_settlement_id is null), 0),
    'commission_pct', (private.agreement(v_own)).commission_pct,
    'period_days', (private.agreement(v_own)).period_days,
    'return_cost_bearer', (private.agreement(v_own)).return_cost_bearer);
end $$;

-- Norma 9.1.4: el neto de un pedido a partir de su cobro, su liquidación y su reversión.
create or replace function public.order_settlement(p_order uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_order sales.orders;
  v_item sales.settlement_items;
  v_settlement sales.settlements;
  v_reversal sales.settlement_reversals;
begin
  perform private.require_admin_console();
  select * into v_order from sales.orders where id = p_order;
  if not found then
    raise exception 'pedido inexistente' using errcode = 'P0002';
  end if;
  select * into v_item from sales.settlement_items where order_id = p_order;
  if v_item.settlement_id is not null then
    select * into v_settlement from sales.settlements where id = v_item.settlement_id;
  end if;
  select * into v_reversal from sales.settlement_reversals where order_id = p_order;
  return jsonb_build_object(
    'charged', case when v_order.payment_status in ('pagado', 'reembolso_pendiente', 'reembolsado') then v_order.total else 0 end,
    'subtotal', v_order.subtotal,
    'delivery_fee', v_order.delivery_fee,
    'settled', v_item.amount,
    'commission', v_item.commission,
    'settlement_number', v_settlement.number,
    'settled_at', v_settlement.created_at,
    'reversed', v_reversal.amount,
    'reversal_applied_at', v_reversal.applied_at,
    'net_to_commerce', coalesce(v_item.amount, 0) - coalesce(v_reversal.amount, 0));
end $$;

-- 3. Conciliación mensual (Control 9.1.1) -----------------------------------------------------------------------------------
-- Cifras del mes (hora de Managua) y lo que no cuadra: pedidos cobrados sin liquidar pasado el plazo del convenio, y
-- reversiones que siguen sin descontarse.
create or replace function public.reconciliation_summary(p_month date)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := (date_trunc('month', p_month)::timestamp at time zone 'America/Managua');
  v_to timestamptz := ((date_trunc('month', p_month) + interval '1 month')::timestamp at time zone 'America/Managua');
begin
  perform private.require_admin_console();
  return jsonb_build_object(
    'month', to_char(date_trunc('month', p_month), 'YYYY-MM'),
    'charged', coalesce((select sum(o.total) from sales.orders o where o.status = 'entregado' and o.payment_status = 'pagado' and o.delivered_at >= v_from and o.delivered_at < v_to), 0),
    'charged_orders', (select count(*) from sales.orders o where o.status = 'entregado' and o.payment_status = 'pagado' and o.delivered_at >= v_from and o.delivered_at < v_to),
    'settled', coalesce((select sum(s.gross - s.commission) from sales.settlements s where s.created_at >= v_from and s.created_at < v_to), 0),
    'commission', coalesce((select sum(s.commission) from sales.settlements s where s.created_at >= v_from and s.created_at < v_to), 0),
    'reversed', coalesce((select sum(r.amount) from sales.settlement_reversals r where r.applied_at >= v_from and r.applied_at < v_to), 0),
    'net_paid', coalesce((select sum(s.net) from sales.settlements s where s.created_at >= v_from and s.created_at < v_to), 0),
    'overdue_unsettled', (
      select count(*) from identity.commerces c, lateral private.pending_settlement_orders(c.id) p
       where p.delivered_at < now() - make_interval(days => (private.agreement(c.id)).period_days)),
    'pending_reversals', (select count(*) from sales.settlement_reversals r where r.applied_settlement_id is null),
    'mismatched_items', (
      select count(*) from sales.settlement_items i join sales.orders o on o.id = i.order_id
       where i.subtotal <> o.subtotal or i.amount <> i.subtotal - i.commission),
    'last_reconciled_at', (select max(done_at) from sales.reconciliations where month = date_trunc('month', p_month)::date));
end $$;

create or replace function public.record_reconciliation(p_month date, p_differences text, p_corrections text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_admin_console();
  if p_month is null or date_trunc('month', p_month) > date_trunc('month', now()) then
    raise exception 'elige un mes que ya empezó' using errcode = '22023';
  end if;
  if p_differences is null or char_length(btrim(p_differences)) < 2 then
    raise exception 'indica las diferencias encontradas (o «ninguna»)' using errcode = '22023';
  end if;
  insert into sales.reconciliations (month, totals, differences, corrections, done_by)
  values (date_trunc('month', p_month)::date, public.reconciliation_summary(p_month), left(btrim(p_differences), 2000),
          nullif(left(btrim(coalesce(p_corrections, '')), 2000), ''), auth.uid())
  returning id into v_id;
  perform private.write_audit('reconciliation.recorded', 'reconciliation', v_id::text, null,
    jsonb_build_object('month', to_char(date_trunc('month', p_month), 'YYYY-MM')));
  return v_id;
end $$;

create or replace function public.reconciliations()
returns table (id uuid, month date, totals jsonb, differences text, corrections text, done_at timestamptz, done_by_name text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query
    select r.id, r.month, r.totals, r.differences, r.corrections, r.done_at, pii.full_name
      from sales.reconciliations r left join identity.profile_pii pii on pii.user_id = r.done_by
     order by r.done_at desc limit 24;
end $$;

revoke all on function
  public.set_commerce_agreement(uuid, numeric, int, text), public.settlements_overview(), public.settlement_preview(uuid),
  public.record_settlement(uuid, text), public.settlements_history(uuid), public.my_settlement_status(), public.order_settlement(uuid),
  public.reconciliation_summary(date), public.record_reconciliation(date, text, text), public.reconciliations()
from public, anon;
grant execute on function
  public.set_commerce_agreement(uuid, numeric, int, text), public.settlements_overview(), public.settlement_preview(uuid),
  public.record_settlement(uuid, text), public.settlements_history(uuid), public.my_settlement_status(), public.order_settlement(uuid),
  public.reconciliation_summary(date), public.record_reconciliation(date, text, text), public.reconciliations()
to authenticated;
