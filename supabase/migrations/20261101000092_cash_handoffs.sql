-- Efectivo con responsable en todo momento: cajas físicas, entregas del repartidor al cajero y registro de responsabilidades.
--
-- 1) Cajas físicas. Cada caja registradora (estación de trabajo) tiene nombre y código. Un turno se abre en una caja: una caja
--    solo tiene un turno abierto y un cajero solo uno. El saldo inicial es lo contado en el último cierre de esa caja.
--    Si la caja tiene un cajero asignado, solo él la abre. Los turnos sin caja (anteriores a este cambio) siguen funcionando.
-- 2) Custodia. Desde que el repartidor entrega un pedido en efectivo, ese dinero está a su cargo hasta que un cajero lo confirma.
-- 3) Entrega. El repartidor (o coordinación, para quien no tiene cuenta) envía «efectivo entregado» a una caja abierta. El cajero
--    de esa caja tiene N minutos (15 por defecto) para contar y escribir el monto, sin ver lo declarado (conteo a ciegas), o
--    para rechazar si no lo recibió. Si el monto no coincide, la diferencia queda a cargo del repartidor. Si vence o se
--    rechaza, el efectivo sigue a cargo del repartidor.
-- 4) Responsabilidades. Cada falta queda registrada a nombre de una persona (repartidor o cajero): entrega vencida (los dos),
--    rechazada, con diferencia, efectivo retenido más de lo permitido y faltante o sobrante en el arqueo. El sistema no
--    sanciona solo: la administración decide la medida (Control 8.2.1, 5 días hábiles).
-- 5) Límites. Con más efectivo encima que el máximo, o con efectivo de hace más horas que las permitidas, el repartidor no
--    recibe pedidos nuevos en efectivo hasta entregarlo.
-- Todo queda en historial que no se modifica: quién envió, a qué caja, cuándo se confirmó, lo declarado, lo contado y la diferencia.

-- Configuración -------------------------------------------------------------------------------------------------------------
create table sales.cash_settings (
  id boolean primary key default true check (id),
  confirm_minutes int not null default 15 check (confirm_minutes between 5 and 60),
  max_hold_hours int not null default 4 check (max_hold_hours between 1 and 24),
  max_hold_amount numeric(12, 2) not null default 5000 check (max_hold_amount between 100 and 1000000),
  updated_at timestamptz not null default now()
);
insert into sales.cash_settings default values;
alter table sales.cash_settings enable row level security;

create or replace function public.cash_settings()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v sales.cash_settings;
begin
  if not (private.is_ops_console() or private.current_courier_id() is not null) then
    raise exception 'no puedes ver la configuración de efectivo' using errcode = '42501';
  end if;
  select * into v from sales.cash_settings;
  return jsonb_build_object('confirm_minutes', v.confirm_minutes, 'max_hold_hours', v.max_hold_hours, 'max_hold_amount', v.max_hold_amount);
end $$;

create or replace function public.set_cash_settings(p_confirm_minutes int, p_max_hold_hours int, p_max_hold_amount numeric)
returns void language plpgsql security definer set search_path = '' as $$
declare v_before sales.cash_settings;
begin
  perform private.require_admin_console();
  if p_confirm_minutes is null or p_confirm_minutes not between 5 and 60 then
    raise exception 'el tiempo para confirmar debe estar entre 5 y 60 minutos' using errcode = '22023';
  end if;
  if p_max_hold_hours is null or p_max_hold_hours not between 1 and 24 then
    raise exception 'el tiempo máximo con efectivo debe estar entre 1 y 24 horas' using errcode = '22023';
  end if;
  if p_max_hold_amount is null or p_max_hold_amount not between 100 and 1000000 or p_max_hold_amount <> round(p_max_hold_amount, 2) then
    raise exception 'el monto máximo debe estar entre 100 y 1,000,000' using errcode = '22023';
  end if;
  select * into v_before from sales.cash_settings;
  update sales.cash_settings set confirm_minutes = p_confirm_minutes, max_hold_hours = p_max_hold_hours,
         max_hold_amount = p_max_hold_amount, updated_at = now();
  perform private.write_audit('cash.settings_changed', 'cash_settings', 'main',
    jsonb_build_object('confirm_minutes', v_before.confirm_minutes, 'max_hold_hours', v_before.max_hold_hours, 'max_hold_amount', v_before.max_hold_amount),
    jsonb_build_object('confirm_minutes', p_confirm_minutes, 'max_hold_hours', p_max_hold_hours, 'max_hold_amount', p_max_hold_amount));
end $$;

-- Cajas físicas -------------------------------------------------------------------------------------------------------------
create table sales.cash_registers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 40),
  code text not null check (code ~ '^[A-Z0-9-]{3,12}$'),
  assigned_cashier uuid references identity.profiles(id),
  active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index cash_registers_code_key on sales.cash_registers (code);
create unique index cash_registers_name_key on sales.cash_registers (lower(name));
alter table sales.cash_registers enable row level security;

alter table sales.cash_sessions add column register_id uuid references sales.cash_registers(id);
create unique index cash_sessions_one_open_register on sales.cash_sessions (register_id) where closed_at is null and register_id is not null;

create or replace function private.cashier_name(p_user uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select nullif(btrim(p.full_name), '') from identity.profile_pii p where p.user_id = p_user), 'Cajero');
$$;

create or replace function private.cash_register_name(p_register uuid)
returns text language sql stable security definer set search_path = '' as $$
  select r.name from sales.cash_registers r where r.id = p_register;
$$;
grant execute on function private.cash_register_name(uuid) to authenticated;

create or replace function private.require_cashier_profile(p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is not null and not exists (select 1 from identity.user_roles ur join identity.profiles p on p.id = ur.user_id
                                         where ur.user_id = p_user and ur.role = 'cajero' and ur.status = 'activo' and p.status = 'activa') then
    raise exception 'la persona asignada debe tener el rol de cajero' using errcode = '22023';
  end if;
end $$;

create or replace function public.create_cash_register(p_name text, p_code text, p_cashier uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := nullif(btrim(p_name), '');
  v_code text := upper(nullif(btrim(p_code), ''));
  v_id uuid;
begin
  perform private.require_admin_console();
  if v_name is null or char_length(v_name) not between 2 and 40 then
    raise exception 'el nombre de la caja debe tener entre 2 y 40 caracteres' using errcode = '22023';
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9-]{3,12}$' then
    raise exception 'el código de la caja: de 3 a 12 letras, números o guiones' using errcode = '22023';
  end if;
  perform private.require_cashier_profile(p_cashier);
  begin
    insert into sales.cash_registers (name, code, assigned_cashier, created_by) values (v_name, v_code, p_cashier, auth.uid()) returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe una caja con ese nombre o código' using errcode = '23505';
  end;
  perform private.write_audit('cash_register.created', 'cash_register', v_id::text, null,
    jsonb_build_object('name', v_name, 'code', v_code, 'cashier', p_cashier));
  return v_id;
end $$;

create or replace function public.update_cash_register(p_id uuid, p_name text, p_cashier uuid, p_active boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v sales.cash_registers;
  v_name text := nullif(btrim(p_name), '');
begin
  perform private.require_admin_console();
  select * into v from sales.cash_registers where id = p_id for update;
  if not found then
    raise exception 'caja no encontrada' using errcode = 'P0002';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 40 then
    raise exception 'el nombre de la caja debe tener entre 2 y 40 caracteres' using errcode = '22023';
  end if;
  if p_active is null then
    raise exception 'indica si la caja está activa' using errcode = '22023';
  end if;
  perform private.require_cashier_profile(p_cashier);
  if exists (select 1 from sales.cash_sessions s where s.register_id = p_id and s.closed_at is null)
     and (not p_active or p_cashier is distinct from v.assigned_cashier) then
    raise exception 'la caja tiene un turno abierto: ciérralo antes de desactivarla o reasignarla' using errcode = '22023';
  end if;
  begin
    update sales.cash_registers set name = v_name, assigned_cashier = p_cashier, active = p_active, updated_at = now() where id = p_id;
  exception when unique_violation then
    raise exception 'ya existe una caja con ese nombre' using errcode = '23505';
  end;
  perform private.write_audit('cash_register.updated', 'cash_register', p_id::text,
    jsonb_build_object('name', v.name, 'cashier', v.assigned_cashier, 'active', v.active),
    jsonb_build_object('name', v_name, 'cashier', p_cashier, 'active', p_active));
end $$;

-- Cajas para la administración, con el turno abierto si lo hay.
create or replace function public.cash_registers_admin()
returns table (register_id uuid, name text, code text, active boolean, cashier_id uuid, cashier_name text,
               open_session uuid, open_cashier_name text, opened_at timestamptz, last_closed_at timestamptz, last_counted numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_admin_console();
  return query
    select r.id, r.name, r.code, r.active, r.assigned_cashier,
           case when r.assigned_cashier is null then null else private.cashier_name(r.assigned_cashier) end,
           o.id, case when o.id is null then null else private.cashier_name(o.cashier_id) end, o.opened_at,
           l.closed_at, l.counted_amount
      from sales.cash_registers r
      left join lateral (select s.id, s.cashier_id, s.opened_at from sales.cash_sessions s where s.register_id = r.id and s.closed_at is null) o on true
      left join lateral (select s.closed_at, s.counted_amount from sales.cash_sessions s where s.register_id = r.id and s.closed_at is not null
                          order by s.closed_at desc limit 1) l on true
     order by r.active desc, r.name;
end $$;

-- Cajas que puede abrir el cajero: activas, asignadas a él o sin asignar, y sin turno abierto de otra persona.
create or replace function public.my_cash_registers()
returns table (register_id uuid, name text, code text, assigned_to_me boolean, last_counted numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_cashier();
  return query
    select r.id, r.name, r.code, r.assigned_cashier = auth.uid(),
           (select s.counted_amount from sales.cash_sessions s where s.register_id = r.id and s.closed_at is not null order by s.closed_at desc limit 1)
      from sales.cash_registers r
     where r.active and (r.assigned_cashier is null or r.assigned_cashier = auth.uid())
       and not exists (select 1 from sales.cash_sessions s where s.register_id = r.id and s.closed_at is null and s.cashier_id <> auth.uid())
     order by (r.assigned_cashier = auth.uid()) desc nulls last, r.name;
end $$;

-- Apertura en una caja. Sin caja: la asignada al cajero si tiene una; si no, un turno sin caja (como antes).
drop function public.open_cash_session(numeric);
create or replace function public.open_cash_session(p_opening numeric, p_register uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_prev sales.cash_sessions;
  v_reg sales.cash_registers;
  v_register uuid := p_register;
  v_opening numeric(12, 2);
begin
  perform private.require_cashier();
  if v_register is null then
    select r.id into v_register from sales.cash_registers r where r.active and r.assigned_cashier = auth.uid() order by r.name limit 1;
  end if;
  if v_register is not null then
    select * into v_reg from sales.cash_registers where id = v_register for update;
    if not found or not v_reg.active then
      raise exception 'esa caja no está disponible' using errcode = 'P0002';
    end if;
    if v_reg.assigned_cashier is not null and v_reg.assigned_cashier <> auth.uid() then
      raise exception 'esa caja está asignada a otro cajero' using errcode = '42501';
    end if;
    select * into v_prev from sales.cash_sessions where register_id = v_register and closed_at is not null order by closed_at desc limit 1;
    if not found then
      -- Primera vez en una caja: el efectivo que el cajero tenía en su gaveta antes de que existieran las cajas.
      select * into v_prev from sales.cash_sessions where cashier_id = auth.uid() and register_id is null and closed_at is not null order by closed_at desc limit 1;
    end if;
  else
    select * into v_prev from sales.cash_sessions where cashier_id = auth.uid() and closed_at is not null order by closed_at desc limit 1;
  end if;
  if v_prev.id is not null then
    v_opening := v_prev.counted_amount;
    if p_opening is not null and p_opening <> v_opening then
      raise exception 'el saldo inicial es el efectivo del cierre anterior: %', v_opening using errcode = '22023';
    end if;
  else
    if p_opening is null then
      raise exception 'el primer turno necesita el monto inicial' using errcode = '22023';
    end if;
    v_opening := p_opening;
  end if;
  if v_opening < 0 or v_opening >= 100000000 or v_opening <> round(v_opening, 2) then
    raise exception 'el monto inicial debe ser 0 o más, con dos decimales' using errcode = '22023';
  end if;
  begin
    insert into sales.cash_sessions (cashier_id, opening_amount, register_id) values (auth.uid(), v_opening, v_register) returning id into v_id;
  exception when unique_violation then
    if exists (select 1 from sales.cash_sessions where cashier_id = auth.uid() and closed_at is null) then
      raise exception 'ya tienes un turno de caja abierto' using errcode = '23505';
    end if;
    raise exception 'esa caja ya tiene un turno abierto' using errcode = '23505';
  end;
  update sales.orders set cash_session_id = v_id, updated_at = now()
   where channel = 'web' and payment_method = 'tarjeta' and payment_status = 'pagado'
     and cash_session_id is null and status <> 'cancelado';
  update sales.orders set refund_session_id = v_id, updated_at = now()
   where payment_method = 'tarjeta' and payment_status = 'reembolsado' and refund_session_id is null;
  perform private.write_audit('cash_session.opened', 'cash_session', v_id::text, null,
    jsonb_build_object('opening', v_opening, 'register', v_register));
  return v_id;
end $$;

-- Entregas de efectivo ------------------------------------------------------------------------------------------------------
create table sales.cash_handoffs (
  id uuid primary key default gen_random_uuid(),
  courier_id uuid not null references identity.couriers(id),
  session_id uuid not null references sales.cash_sessions(id),
  register_id uuid references sales.cash_registers(id),
  cashier_id uuid not null references identity.profiles(id),
  declared_amount numeric(12, 2) not null check (declared_amount > 0),
  counted_amount numeric(12, 2) check (counted_amount is null or counted_amount >= 0),
  difference numeric(12, 2),
  status text not null default 'pendiente' check (status in ('pendiente', 'confirmada', 'con_diferencia', 'rechazada', 'vencida')),
  note text check (note is null or char_length(note) <= 200),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  resolved_at timestamptz,
  resolved_by uuid
);
create unique index cash_handoffs_one_pending on sales.cash_handoffs (courier_id) where status = 'pendiente';
create index cash_handoffs_session_idx on sales.cash_handoffs (session_id, status);
create index cash_handoffs_courier_idx on sales.cash_handoffs (courier_id, created_at desc);
alter table sales.cash_handoffs enable row level security;

create table sales.cash_handoff_items (
  handoff_id uuid not null references sales.cash_handoffs(id),
  order_id uuid not null references sales.orders(id),
  amount numeric(12, 2) not null check (amount >= 0),
  primary key (handoff_id, order_id)
);
create index cash_handoff_items_order_idx on sales.cash_handoff_items (order_id);
alter table sales.cash_handoff_items enable row level security;

alter table sales.orders add column cash_handoff_id uuid references sales.cash_handoffs(id);

-- Historial que no se modifica: una entrega pendiente solo pasa a un estado final, y de ahí no cambia.
create or replace function private.guard_cash_handoff()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'las entregas de efectivo no se borran' using errcode = '42501';
  end if;
  if old.status <> 'pendiente' or new.status = 'pendiente'
     or new.courier_id <> old.courier_id or new.session_id <> old.session_id or new.cashier_id <> old.cashier_id
     or new.declared_amount <> old.declared_amount or new.created_at <> old.created_at or new.expires_at <> old.expires_at then
    raise exception 'una entrega de efectivo resuelta no se modifica' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger cash_handoffs_guard before update or delete on sales.cash_handoffs for each row execute function private.guard_cash_handoff();

create or replace function private.guard_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'este registro no se modifica' using errcode = '42501';
end $$;
create trigger cash_handoff_items_guard before update or delete on sales.cash_handoff_items for each row execute function private.guard_immutable();

-- Responsabilidades ---------------------------------------------------------------------------------------------------------
create table sales.cash_accountability (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('entrega_vencida', 'entrega_rechazada', 'faltante_entrega', 'sobrante_entrega',
                                     'efectivo_retenido', 'faltante_arqueo', 'sobrante_arqueo')),
  responsible text not null check (responsible in ('repartidor', 'cajero')),
  courier_id uuid references identity.couriers(id),
  cashier_id uuid references identity.profiles(id),
  handoff_id uuid references sales.cash_handoffs(id),
  session_id uuid references sales.cash_sessions(id),
  order_id uuid references sales.orders(id),
  amount numeric(12, 2) not null check (amount >= 0),
  detail text not null check (char_length(detail) between 1 and 300),
  created_at timestamptz not null default now(),
  status text not null default 'abierta' check (status in ('abierta', 'resuelta')),
  decision text check (decision is null or decision in ('sin_medida', 'llamado_atencion', 'reposicion', 'suspension')),
  decision_note text check (decision_note is null or char_length(decision_note) between 5 and 300),
  decided_at timestamptz,
  decided_by uuid,
  check ((responsible = 'repartidor' and courier_id is not null) or (responsible = 'cajero' and cashier_id is not null))
);
create index cash_accountability_open_idx on sales.cash_accountability (status, created_at);
-- El efectivo retenido de un pedido se anota una sola vez.
create unique index cash_accountability_retained_once on sales.cash_accountability (order_id) where kind = 'efectivo_retenido';
alter table sales.cash_accountability enable row level security;

create or replace function private.guard_cash_accountability()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'las responsabilidades de efectivo no se borran' using errcode = '42501';
  end if;
  if old.status <> 'abierta' or new.status <> 'resuelta' or new.kind <> old.kind or new.responsible <> old.responsible
     or new.amount <> old.amount or new.detail <> old.detail or new.created_at <> old.created_at
     or new.courier_id is distinct from old.courier_id or new.cashier_id is distinct from old.cashier_id then
    raise exception 'una responsabilidad de efectivo solo se resuelve una vez' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger cash_accountability_guard before update or delete on sales.cash_accountability for each row execute function private.guard_cash_accountability();

-- Custodia ------------------------------------------------------------------------------------------------------------------
-- Pedidos en efectivo ya entregados cuyo dinero sigue con el repartidor: registrados, sin recibir en caja.
create or replace function private.courier_custody(p_courier uuid)
returns table (order_id uuid, order_number bigint, store_name text, amount numeric, delivered_at timestamptz, in_handoff boolean)
language sql stable security definer set search_path = '' as $$
  select o.id, o.number, o.store_name, coalesce(o.cash_collected, o.total), o.delivered_at,
         exists (select 1 from sales.cash_handoff_items i join sales.cash_handoffs h on h.id = i.handoff_id
                  where i.order_id = o.id and h.status = 'pendiente')
    from sales.orders o
   where o.courier_id = p_courier and o.channel = 'web' and o.payment_method = 'efectivo' and o.status = 'entregado'
     and o.payment_ref is not null and o.cash_received_at is null
   order by o.delivered_at;
$$;

-- ¿Puede el repartidor recibir otro pedido en efectivo? Devuelve el motivo si no puede.
create or replace function private.courier_cash_block(p_courier uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v sales.cash_settings;
  v_total numeric;
  v_oldest timestamptz;
begin
  select * into v from sales.cash_settings;
  select coalesce(sum(c.amount), 0), min(c.delivered_at) into v_total, v_oldest from private.courier_custody(p_courier) c;
  if v_total > v.max_hold_amount then
    return 'el repartidor tiene C$ ' || to_char(v_total, 'FM999999990.00') || ' en efectivo sin entregar (máximo C$ '
           || to_char(v.max_hold_amount, 'FM999999990.00') || '): primero debe entregarlo en caja';
  end if;
  if v_oldest is not null and v_oldest < now() - make_interval(hours => v.max_hold_hours) then
    return 'el repartidor tiene efectivo de hace más de ' || v.max_hold_hours || ' horas sin entregar: primero debe entregarlo en caja';
  end if;
  return null;
end $$;

-- Las reglas de asignación de siempre más el freno de efectivo: solo para asignaciones nuevas de pedidos en efectivo
-- (no para el pedido que el repartidor ya lleva).
create or replace function private.assert_courier_fits(p_order sales.orders, p_courier uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
declare
  v_courier identity.couriers;
  v_block text;
begin
  select * into v_courier from identity.couriers where id = p_courier and status = 'activo';
  if not found then
    raise exception 'repartidor no disponible' using errcode = 'P0002';
  end if;
  if p_order.delivery_class = 'programado' then
    if v_courier.vehicle_class is distinct from 'vehiculo' then
      raise exception 'este pedido es programado: solo lo lleva un repartidor con vehículo' using errcode = '22023';
    end if;
    if p_order.origin_department is not null and v_courier.department is distinct from p_order.origin_department then
      raise exception 'el repartidor debe trabajar en el departamento de la tienda' using errcode = '22023';
    end if;
  end if;
  if p_order.payment_method = 'efectivo' and p_order.courier_id is distinct from p_courier then
    v_block := private.courier_cash_block(p_courier);
    if v_block is not null then
      raise exception '%', v_block using errcode = '22023';
    end if;
  end if;
end $$;
revoke all on function private.assert_courier_fits(sales.orders, uuid) from public, anon, authenticated;

-- Barrido: vence las entregas sin confirmar y anota el efectivo retenido de más. Lo llaman las funciones de efectivo al leer
-- o escribir, así no depende de una tarea programada.
create or replace function private.sweep_cash()
returns void language plpgsql security definer set search_path = '' as $$
declare
  h sales.cash_handoffs;
  v sales.cash_settings;
begin
  for h in select * from sales.cash_handoffs where status = 'pendiente' and expires_at <= now() for update skip locked loop
    update sales.cash_handoffs set status = 'vencida', resolved_at = h.expires_at where id = h.id;
    insert into sales.cash_accountability (kind, responsible, courier_id, handoff_id, session_id, amount, detail)
    values ('entrega_vencida', 'repartidor', h.courier_id, h.id, h.session_id, h.declared_amount,
            'Entrega de efectivo sin confirmar a tiempo: el efectivo sigue a cargo del repartidor');
    insert into sales.cash_accountability (kind, responsible, cashier_id, handoff_id, session_id, amount, detail)
    values ('entrega_vencida', 'cajero', h.cashier_id, h.id, h.session_id, h.declared_amount,
            'Entrega de efectivo enviada a su caja y no confirmada ni rechazada a tiempo');
    perform private.write_audit('cash_handoff.expired', 'cash_handoff', h.id::text, null,
      jsonb_build_object('courier', h.courier_id, 'session', h.session_id, 'declared', h.declared_amount));
  end loop;

  select * into v from sales.cash_settings;
  insert into sales.cash_accountability (kind, responsible, courier_id, order_id, amount, detail)
  select 'efectivo_retenido', 'repartidor', o.courier_id, o.id, coalesce(o.cash_collected, o.total),
         'Pedido ' || o.number || ': efectivo sin entregar en caja después de ' || v.max_hold_hours || ' horas'
    from sales.orders o
   where o.channel = 'web' and o.payment_method = 'efectivo' and o.status = 'entregado' and o.courier_id is not null
     and o.payment_ref is not null and o.cash_received_at is null
     and o.delivered_at < now() - make_interval(hours => v.max_hold_hours)
  on conflict do nothing;
end $$;

-- Cajas abiertas a las que se puede entregar efectivo (para el repartidor y coordinación).
create or replace function public.open_cash_points()
returns table (session_id uuid, register_name text, register_code text, cashier_name text, opened_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (private.current_courier_id() is not null or private.is_coordination_console() or private.is_cashier()) then
    raise exception 'no puedes ver las cajas abiertas' using errcode = '42501';
  end if;
  return query
    select s.id, coalesce(r.name, 'Caja de ' || private.cashier_name(s.cashier_id)), r.code,
           split_part(private.cashier_name(s.cashier_id), ' ', 1), s.opened_at
      from sales.cash_sessions s
      left join sales.cash_registers r on r.id = s.register_id
     where s.closed_at is null
     order by 2;
end $$;

-- Crea la entrega. p_orders null: todo el efectivo a cargo del repartidor que no esté ya en una entrega pendiente.
create or replace function private.start_cash_handoff(p_courier uuid, p_session uuid, p_orders uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_session sales.cash_sessions;
  v_set sales.cash_settings;
  v_total numeric(12, 2);
  v_count int;
  v_id uuid;
begin
  perform private.sweep_cash();
  select * into v_session from sales.cash_sessions where id = p_session and closed_at is null for share;
  if not found then
    raise exception 'esa caja ya no tiene un turno abierto: elige otra' using errcode = 'P0002';
  end if;
  if exists (select 1 from sales.cash_handoffs where courier_id = p_courier and status = 'pendiente') then
    raise exception 'ya hay una entrega esperando confirmación del cajero' using errcode = '23505';
  end if;
  perform 1 from sales.orders o where o.id in (select c.order_id from private.courier_custody(p_courier) c) for update;
  select count(*), coalesce(sum(c.amount), 0) into v_count, v_total
    from private.courier_custody(p_courier) c
   where not c.in_handoff and (p_orders is null or c.order_id = any (p_orders));
  if v_count = 0 or (p_orders is not null and v_count <> cardinality(array(select distinct unnest(p_orders)))) then
    raise exception 'no hay efectivo para entregar en esos pedidos' using errcode = '22023';
  end if;
  if v_total <= 0 then
    raise exception 'esos pedidos no tienen efectivo cobrado' using errcode = '22023';
  end if;
  select * into v_set from sales.cash_settings;
  insert into sales.cash_handoffs (courier_id, session_id, register_id, cashier_id, declared_amount, created_by, expires_at)
  values (p_courier, v_session.id, v_session.register_id, v_session.cashier_id, v_total, auth.uid(), now() + make_interval(mins => v_set.confirm_minutes))
  returning id into v_id;
  insert into sales.cash_handoff_items (handoff_id, order_id, amount)
  select v_id, c.order_id, c.amount from private.courier_custody(p_courier) c
   where not c.in_handoff and (p_orders is null or c.order_id = any (p_orders));
  perform private.write_audit('cash_handoff.sent', 'cash_handoff', v_id::text, null,
    jsonb_build_object('courier', p_courier, 'session', v_session.id, 'register', v_session.register_id, 'declared', v_total, 'orders', v_count));
  return v_id;
end $$;

create or replace function public.courier_start_cash_handoff(p_session uuid, p_orders uuid[] default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_courier uuid := private.current_courier_id();
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa entrega su efectivo' using errcode = '42501';
  end if;
  return private.start_cash_handoff(v_courier, p_session, p_orders);
end $$;

-- Coordinación la envía solo por un repartidor que no tiene cuenta (quien la tiene lo hace desde su aplicación).
create or replace function public.start_cash_handoff_for(p_courier uuid, p_session uuid, p_orders uuid[] default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_courier identity.couriers;
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes enviar entregas de efectivo' using errcode = '42501';
  end if;
  select * into v_courier from identity.couriers where id = p_courier;
  if not found then
    raise exception 'repartidor no encontrado' using errcode = 'P0002';
  end if;
  if v_courier.user_id is not null then
    raise exception 'ese repartidor tiene cuenta: él envía la entrega desde su aplicación' using errcode = '22023';
  end if;
  return private.start_cash_handoff(p_courier, p_session, p_orders);
end $$;

-- Entregas esperando al cajero. Sin montos: el cajero cuenta a ciegas.
create or replace function public.cashier_pending_handoffs()
returns table (handoff_id uuid, courier_name text, orders_count int, order_numbers bigint[], created_at timestamptz, expires_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_cashier();
  perform private.sweep_cash();
  return query
    select h.id, c.full_name, count(i.order_id)::int, array_agg(o.number order by o.number), h.created_at, h.expires_at
      from sales.cash_handoffs h
      join sales.cash_sessions s on s.id = h.session_id
      join identity.couriers c on c.id = h.courier_id
      join sales.cash_handoff_items i on i.handoff_id = h.id
      join sales.orders o on o.id = i.order_id
     where h.status = 'pendiente' and s.cashier_id = auth.uid() and s.closed_at is null
     group by h.id, c.full_name
     order by h.created_at;
end $$;

create or replace function public.confirm_cash_handoff(p_handoff uuid, p_counted numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  h sales.cash_handoffs;
  v_session sales.cash_sessions;
  v_note text := nullif(btrim(p_note), '');
  v_diff numeric(12, 2);
  v_status text;
begin
  perform private.require_cashier();
  perform private.sweep_cash();
  select * into h from sales.cash_handoffs where id = p_handoff for update;
  if not found then
    raise exception 'entrega no encontrada' using errcode = 'P0002';
  end if;
  select * into v_session from sales.cash_sessions where id = h.session_id;
  if v_session.cashier_id <> auth.uid() then
    raise exception 'esta entrega es para otra caja' using errcode = '42501';
  end if;
  if h.status = 'vencida' then
    raise exception 'la entrega venció: pide al repartidor que la envíe de nuevo' using errcode = '22023';
  end if;
  if h.status <> 'pendiente' then
    raise exception 'esta entrega ya fue resuelta' using errcode = '23505';
  end if;
  if v_session.closed_at is not null then
    raise exception 'tu turno ya está cerrado' using errcode = '22023';
  end if;
  if p_counted is null or p_counted < 0 or p_counted >= 100000000 or p_counted <> round(p_counted, 2) then
    raise exception 'el efectivo contado debe ser 0 o más, con dos decimales' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'la nota admite hasta 200 caracteres' using errcode = '22023';
  end if;
  v_diff := p_counted - h.declared_amount;
  v_status := case when v_diff = 0 then 'confirmada' else 'con_diferencia' end;
  update sales.cash_handoffs set status = v_status, counted_amount = p_counted, difference = v_diff, note = v_note,
         resolved_at = clock_timestamp(), resolved_by = auth.uid()
   where id = h.id;
  update sales.orders o set cash_received_at = now(), cash_received_session = h.session_id, cash_handoff_id = h.id, updated_at = now()
    from sales.cash_handoff_items i where i.handoff_id = h.id and o.id = i.order_id;
  if v_diff < 0 then
    insert into sales.cash_accountability (kind, responsible, courier_id, handoff_id, session_id, amount, detail)
    values ('faltante_entrega', 'repartidor', h.courier_id, h.id, h.session_id, -v_diff,
            'El cajero contó ' || p_counted || ' de ' || h.declared_amount || ' declarados por el repartidor');
  elsif v_diff > 0 then
    insert into sales.cash_accountability (kind, responsible, courier_id, handoff_id, session_id, amount, detail)
    values ('sobrante_entrega', 'repartidor', h.courier_id, h.id, h.session_id, v_diff,
            'El cajero contó ' || p_counted || ', más que los ' || h.declared_amount || ' declarados: revisar el cobro al cliente');
  end if;
  perform private.write_audit('cash_handoff.confirmed', 'cash_handoff', h.id::text, null,
    jsonb_build_object('declared', h.declared_amount, 'counted', p_counted, 'difference', v_diff, 'session', h.session_id), v_note);
  return jsonb_build_object('status', v_status, 'declared', h.declared_amount, 'counted', p_counted, 'difference', v_diff);
end $$;

create or replace function public.reject_cash_handoff(p_handoff uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  h sales.cash_handoffs;
  v_reason text := nullif(btrim(p_reason), '');
begin
  perform private.require_cashier();
  perform private.sweep_cash();
  if v_reason is null or char_length(v_reason) not between 5 and 200 then
    raise exception 'cuenta por qué la rechazas (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into h from sales.cash_handoffs where id = p_handoff for update;
  if not found then
    raise exception 'entrega no encontrada' using errcode = 'P0002';
  end if;
  if not exists (select 1 from sales.cash_sessions s where s.id = h.session_id and s.cashier_id = auth.uid()) then
    raise exception 'esta entrega es para otra caja' using errcode = '42501';
  end if;
  if h.status = 'vencida' then
    raise exception 'la entrega ya venció' using errcode = '22023';
  end if;
  if h.status <> 'pendiente' then
    raise exception 'esta entrega ya fue resuelta' using errcode = '23505';
  end if;
  update sales.cash_handoffs set status = 'rechazada', note = v_reason, resolved_at = clock_timestamp(), resolved_by = auth.uid() where id = h.id;
  insert into sales.cash_accountability (kind, responsible, courier_id, handoff_id, session_id, amount, detail)
  values ('entrega_rechazada', 'repartidor', h.courier_id, h.id, h.session_id, h.declared_amount, 'El cajero rechazó la entrega: ' || v_reason);
  perform private.write_audit('cash_handoff.rejected', 'cash_handoff', h.id::text, null,
    jsonb_build_object('declared', h.declared_amount, 'session', h.session_id), v_reason);
end $$;

-- El efectivo ya no se «recibe» directo: se confirma la entrega del repartidor, contando el monto.
create or replace function public.receive_courier_cash(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_cashier();
  raise exception 'el efectivo se recibe confirmando la entrega que envía el repartidor' using errcode = '0A000';
end $$;

-- Lo que ve el repartidor de su efectivo.
create or replace function public.courier_cash_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_courier uuid := private.current_courier_id();
  v sales.cash_settings;
  v_pending jsonb;
  v_last jsonb;
begin
  if v_courier is null then
    raise exception 'solo un repartidor con sesión activa ve su efectivo' using errcode = '42501';
  end if;
  perform private.sweep_cash();
  select * into v from sales.cash_settings;
  select jsonb_build_object('id', h.id, 'register_name', coalesce(r.name, 'Caja de ' || private.cashier_name(s.cashier_id)),
                            'declared', h.declared_amount, 'created_at', h.created_at, 'expires_at', h.expires_at)
    into v_pending
    from sales.cash_handoffs h join sales.cash_sessions s on s.id = h.session_id left join sales.cash_registers r on r.id = h.register_id
   where h.courier_id = v_courier and h.status = 'pendiente';
  select jsonb_build_object('id', h.id, 'status', h.status, 'register_name', coalesce(r.name, 'Caja de ' || private.cashier_name(s.cashier_id)),
                            'declared', h.declared_amount, 'counted', h.counted_amount, 'difference', h.difference,
                            'note', h.note, 'resolved_at', h.resolved_at)
    into v_last
    from sales.cash_handoffs h join sales.cash_sessions s on s.id = h.session_id left join sales.cash_registers r on r.id = h.register_id
   where h.courier_id = v_courier and h.status <> 'pendiente'
   order by h.resolved_at desc nulls last limit 1;
  return jsonb_build_object(
    'custody_total', (select coalesce(sum(c.amount), 0) from private.courier_custody(v_courier) c),
    'orders', (select coalesce(jsonb_agg(jsonb_build_object('order_id', c.order_id, 'number', c.order_number, 'store_name', c.store_name,
                                                            'amount', c.amount, 'delivered_at', c.delivered_at, 'in_handoff', c.in_handoff)
                                         order by c.delivered_at), '[]'::jsonb)
                 from private.courier_custody(v_courier) c),
    'pending', v_pending,
    'last', v_last,
    'block', private.courier_cash_block(v_courier),
    'confirm_minutes', v.confirm_minutes, 'max_hold_hours', v.max_hold_hours, 'max_hold_amount', v.max_hold_amount,
    'open_items', (select count(*)::int from sales.cash_accountability a where a.courier_id = v_courier and a.status = 'abierta'));
end $$;

-- Coordinación: efectivo a cargo de cada repartidor.
create or replace function public.couriers_cash_overview()
returns table (courier_id uuid, full_name text, has_account boolean, custody_total numeric, custody_orders int, oldest_delivered_at timestamptz,
               pending_handoff uuid, pending_register text, pending_expires_at timestamptz, blocked text)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes ver el efectivo de los repartidores' using errcode = '42501';
  end if;
  perform private.sweep_cash();
  return query
    select c.id, c.full_name, c.user_id is not null, k.total, k.n, k.oldest, h.id,
           case when h.id is null then null else coalesce(r.name, 'Caja de ' || private.cashier_name(s.cashier_id)) end,
           h.expires_at, private.courier_cash_block(c.id)
      from identity.couriers c
      cross join lateral (select coalesce(sum(x.amount), 0) as total, count(*)::int as n, min(x.delivered_at) as oldest from private.courier_custody(c.id) x) k
      left join sales.cash_handoffs h on h.courier_id = c.id and h.status = 'pendiente'
      left join sales.cash_sessions s on s.id = h.session_id
      left join sales.cash_registers r on r.id = h.register_id
     where k.n > 0 or h.id is not null
     order by k.oldest nulls last;
end $$;

-- Historial de entregas: coordinación y administración ven todas; el cajero, las de sus turnos.
create or replace function public.cash_handoffs_history(p_session uuid default null, p_limit int default 100)
returns table (handoff_id uuid, status text, courier_name text, register_name text, cashier_name text, session_id uuid,
               declared numeric, counted numeric, difference numeric, note text, orders_count int, order_numbers bigint[],
               created_at timestamptz, expires_at timestamptz, resolved_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare v_all boolean := private.is_coordination_console();
begin
  if not (v_all or private.is_cashier()) then
    raise exception 'no puedes ver las entregas de efectivo' using errcode = '42501';
  end if;
  perform private.sweep_cash();
  return query
    select h.id, h.status, c.full_name, coalesce(r.name, 'Caja de ' || private.cashier_name(h.cashier_id)), private.cashier_name(h.cashier_id),
           h.session_id, h.declared_amount, h.counted_amount, h.difference, h.note,
           (select count(*)::int from sales.cash_handoff_items i where i.handoff_id = h.id),
           (select array_agg(o.number order by o.number) from sales.cash_handoff_items i join sales.orders o on o.id = i.order_id where i.handoff_id = h.id),
           h.created_at, h.expires_at, h.resolved_at
      from sales.cash_handoffs h
      join identity.couriers c on c.id = h.courier_id
      left join sales.cash_registers r on r.id = h.register_id
     where (p_session is null or h.session_id = p_session)
       and (v_all or h.cashier_id = auth.uid())
     order by h.created_at desc
     limit least(greatest(coalesce(p_limit, 100), 1), 500);
end $$;

-- Responsabilidades: coordinación y administración las ven; solo la administración decide la medida.
create or replace function public.cash_accountability_list(p_status text default 'abierta')
returns table (id uuid, kind text, responsible text, person_name text, amount numeric, detail text, created_at timestamptz,
               status text, decision text, decision_note text, decided_at timestamptz, register_name text, order_number bigint)
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_console_session();
  if not private.is_coordination_console() then
    raise exception 'no puedes ver las responsabilidades de efectivo' using errcode = '42501';
  end if;
  perform private.sweep_cash();
  return query
    select a.id, a.kind, a.responsible,
           case when a.responsible = 'repartidor' then c.full_name else private.cashier_name(a.cashier_id) end,
           a.amount, a.detail, a.created_at, a.status, a.decision, a.decision_note, a.decided_at,
           coalesce(r.name, r2.name), o.number
      from sales.cash_accountability a
      left join identity.couriers c on c.id = a.courier_id
      left join sales.cash_handoffs h on h.id = a.handoff_id
      left join sales.cash_registers r on r.id = h.register_id
      left join sales.cash_sessions s on s.id = a.session_id
      left join sales.cash_registers r2 on r2.id = s.register_id
      left join sales.orders o on o.id = a.order_id
     where p_status is null or a.status = p_status
     order by a.created_at desc
     limit 300;
end $$;

create or replace function public.decide_cash_accountability(p_id uuid, p_decision text, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v sales.cash_accountability;
  v_note text := nullif(btrim(p_note), '');
begin
  perform private.require_admin_console();
  if p_decision is null or p_decision not in ('sin_medida', 'llamado_atencion', 'reposicion', 'suspension') then
    raise exception 'elige una medida válida' using errcode = '22023';
  end if;
  if v_note is null or char_length(v_note) not between 5 and 300 then
    raise exception 'explica la decisión (entre 5 y 300 caracteres)' using errcode = '22023';
  end if;
  select * into v from sales.cash_accountability where id = p_id for update;
  if not found then
    raise exception 'registro no encontrado' using errcode = 'P0002';
  end if;
  if v.status <> 'abierta' then
    raise exception 'este registro ya tiene una decisión' using errcode = '23505';
  end if;
  update sales.cash_accountability set status = 'resuelta', decision = p_decision, decision_note = v_note, decided_at = now(), decided_by = auth.uid()
   where id = p_id;
  perform private.write_audit('cash_accountability.decided', 'cash_accountability', p_id::text, null,
    jsonb_build_object('kind', v.kind, 'responsible', v.responsible, 'decision', p_decision, 'amount', v.amount), v_note);
end $$;

-- Arqueo --------------------------------------------------------------------------------------------------------------------
-- El efectivo web recibido es lo que el cajero contó en cada entrega (no el total del pedido). Los pedidos recibidos antes de
-- este cambio, sin entrega, cuentan por su total, como antes.
create or replace function private.cash_received_web_total(p_session uuid)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce((select sum(h.counted_amount) from sales.cash_handoffs h
                    where h.session_id = p_session and h.status in ('confirmada', 'con_diferencia')), 0)
       + coalesce((select sum(o.total) from sales.orders o
                    where o.cash_received_session = p_session and o.cash_handoff_id is null and o.status <> 'cancelado'), 0);
$$;
grant execute on function private.cash_received_web_total(uuid) to authenticated;

create or replace function private.cash_breakdown(p_session uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'efectivo_mostrador', coalesce(sum(o.total) filter (where o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.cash_session_id = p_session and o.status <> 'cancelado'), 0),
    'efectivo_web_recibido', private.cash_received_web_total(p_session),
    'efectivo_devuelto', (select coalesce(sum(x.total), 0) from sales.return_requests r join sales.orders x on x.id = r.order_id where r.cash_return_session = p_session),
    'tarjeta_mostrador', coalesce(sum(o.total) filter (where o.channel = 'mostrador' and o.payment_method = 'tarjeta' and o.cash_session_id = p_session and o.status <> 'cancelado'), 0),
    'tarjeta_web', coalesce(sum(o.total) filter (where o.channel = 'web' and o.payment_method = 'tarjeta' and o.cash_session_id = p_session
                                                    and o.payment_status in ('pagado', 'reembolso_pendiente', 'reembolsado')), 0),
    'reembolsos_tarjeta', coalesce(sum(o.total) filter (where o.refund_session_id = p_session and o.payment_status = 'reembolsado'), 0))
  from sales.orders o
  where o.cash_session_id = p_session or o.cash_received_session = p_session or o.refund_session_id = p_session;
$$;

-- Cierre: no se cierra con entregas esperando, y la diferencia del arqueo queda a nombre del cajero del turno.
create or replace function public.close_cash_session(p_counted numeric, p_note text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_session sales.cash_sessions;
  v_expected numeric(12, 2);
  v_diff numeric(12, 2);
  v_note text := nullif(btrim(p_note), '');
  v_end timestamptz := clock_timestamp();
  v_incidents integer;
  v_register text;
begin
  perform private.require_cashier();
  perform private.sweep_cash();
  select * into v_session from sales.cash_sessions where cashier_id = auth.uid() and closed_at is null for update;
  if not found then
    raise exception 'no tienes un turno de caja abierto' using errcode = 'P0002';
  end if;
  if exists (select 1 from sales.cash_handoffs where session_id = v_session.id and status = 'pendiente') then
    raise exception 'hay una entrega de efectivo esperando tu confirmación: confírmala o recházala antes de cerrar' using errcode = '22023';
  end if;
  if p_counted is null or p_counted < 0 or p_counted >= 100000000 or p_counted <> round(p_counted, 2) then
    raise exception 'el efectivo contado debe ser 0 o más, con dos decimales' using errcode = '22023';
  end if;
  v_expected := private.expected_cash(v_session.id);
  v_diff := p_counted - v_expected;

  update sales.cash_sessions
     set closed_at = v_end, expected_amount = v_expected, counted_amount = p_counted, difference = v_diff, note = v_note
   where id = v_session.id;

  if v_diff <> 0 then
    insert into sales.cash_session_incidents (session_id, kind, detail)
    values (v_session.id, 'diferencia_efectivo', 'Diferencia de efectivo: ' || v_diff);
    select name into v_register from sales.cash_registers where id = v_session.register_id;
    insert into sales.cash_accountability (kind, responsible, cashier_id, session_id, amount, detail)
    values (case when v_diff < 0 then 'faltante_arqueo' else 'sobrante_arqueo' end, 'cajero', v_session.cashier_id, v_session.id, abs(v_diff),
            case when v_diff < 0 then 'Faltan ' else 'Sobran ' end || abs(v_diff) || ' en el arqueo de ' || coalesce(v_register, 'su caja')
            || ': esperado ' || v_expected || ', contado ' || p_counted);
  end if;
  v_incidents := private.record_cash_incidents(v_session.id, v_end);

  if v_incidents > 0 and (v_note is null or char_length(v_note) < 5) then
    raise exception 'hay incidencias de caja: explica el motivo (mínimo 5 caracteres)' using errcode = '22023';
  end if;

  perform private.write_audit('cash_session.closed', 'cash_session', v_session.id::text, null,
    jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff, 'incidents', v_incidents, 'register', v_session.register_id), v_note);
  return jsonb_build_object('expected', v_expected, 'counted', p_counted, 'difference', v_diff,
                            'incidents_count', v_incidents, 'por_medio', private.cash_breakdown(v_session.id));
end $$;

-- La vista de turnos muestra la caja.
create or replace view public.cash_sessions_list with (security_invoker = true) as
  select s.id, s.cashier_id, s.opened_at, s.opening_amount, s.closed_at, s.expected_amount, s.counted_amount, s.difference, s.note,
         (select count(*) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_count,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado') as sales_total,
         (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.status <> 'cancelado' and o.payment_method = 'efectivo') as cash_total,
         coalesce(s.expected_amount, s.opening_amount
           + (select coalesce(sum(o.total), 0) from sales.orders o where o.cash_session_id = s.id and o.channel = 'mostrador' and o.payment_method = 'efectivo' and o.status <> 'cancelado')
           + private.cash_received_web_total(s.id)
           - private.cash_returned_total(s.id)) as cash_expected,
         s.register_id,
         private.cash_register_name(s.register_id) as register_name
  from sales.cash_sessions s;

-- Permisos ------------------------------------------------------------------------------------------------------------------
revoke all on function
  private.cashier_name(uuid), private.require_cashier_profile(uuid), private.courier_custody(uuid), private.courier_cash_block(uuid),
  private.sweep_cash(), private.start_cash_handoff(uuid, uuid, uuid[]), private.guard_cash_handoff(), private.guard_immutable(),
  private.guard_cash_accountability()
from public, anon, authenticated;

revoke all on function
  public.cash_settings(), public.set_cash_settings(int, int, numeric),
  public.create_cash_register(text, text, uuid), public.update_cash_register(uuid, text, uuid, boolean),
  public.cash_registers_admin(), public.my_cash_registers(), public.open_cash_session(numeric, uuid),
  public.open_cash_points(), public.courier_start_cash_handoff(uuid, uuid[]), public.start_cash_handoff_for(uuid, uuid, uuid[]),
  public.cashier_pending_handoffs(), public.confirm_cash_handoff(uuid, numeric, text), public.reject_cash_handoff(uuid, text),
  public.receive_courier_cash(uuid), public.courier_cash_status(), public.couriers_cash_overview(),
  public.cash_handoffs_history(uuid, int), public.cash_accountability_list(text), public.decide_cash_accountability(uuid, text, text),
  public.close_cash_session(numeric, text)
from public, anon;
grant execute on function
  public.cash_settings(), public.set_cash_settings(int, int, numeric),
  public.create_cash_register(text, text, uuid), public.update_cash_register(uuid, text, uuid, boolean),
  public.cash_registers_admin(), public.my_cash_registers(), public.open_cash_session(numeric, uuid),
  public.open_cash_points(), public.courier_start_cash_handoff(uuid, uuid[]), public.start_cash_handoff_for(uuid, uuid, uuid[]),
  public.cashier_pending_handoffs(), public.confirm_cash_handoff(uuid, numeric, text), public.reject_cash_handoff(uuid, text),
  public.receive_courier_cash(uuid), public.courier_cash_status(), public.couriers_cash_overview(),
  public.cash_handoffs_history(uuid, int), public.cash_accountability_list(text), public.decide_cash_accountability(uuid, text, text),
  public.close_cash_session(numeric, text)
to authenticated;

revoke all on public.cash_sessions_list from public, anon;
grant select on public.cash_sessions_list to authenticated;
