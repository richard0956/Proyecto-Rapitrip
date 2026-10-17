-- Fase 2, etapa 5: inventario por variante con control opcional, alertas de stock bajo y ajustes manuales con motivo.
-- Una variante sin control de stock se vende sin límite. Con control, 0 unidades = agotada (el catálogo público la oculta en F4).
-- La reserva de stock en el checkout llega con F3; aquí solo hay entradas, salidas y conteos manuales, todos con historial.

create table commerce.inventory (
  variant_id uuid primary key references commerce.product_variants(id) on delete cascade,
  store_id uuid not null references commerce.stores(id),
  track_stock boolean not null default false,
  quantity int not null default 0 check (quantity >= 0 and quantity < 1000000),
  low_stock_threshold int not null default 5 check (low_stock_threshold >= 0 and low_stock_threshold < 1000000),
  updated_at timestamptz not null default now()
);
create index inventory_store_idx on commerce.inventory (store_id);

create table commerce.stock_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references commerce.product_variants(id) on delete cascade,
  store_id uuid not null references commerce.stores(id),
  kind text not null check (kind in ('entrada', 'salida', 'conteo')),
  delta int not null,
  quantity_after int not null check (quantity_after >= 0),
  reason text not null check (char_length(btrim(reason)) between 5 and 200),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index stock_movements_variant_idx on commerce.stock_movements (variant_id, id desc);

alter table commerce.inventory enable row level security;
alter table commerce.stock_movements enable row level security;

create policy inventory_select_own on commerce.inventory
  for select to authenticated using (exists (
    select 1 from commerce.stores s where s.id = inventory.store_id and private.has_role('comercio', s.commerce_id)));
create policy inventory_select_admin on commerce.inventory
  for select to authenticated using (private.is_admin_console());
create policy movements_select_own on commerce.stock_movements
  for select to authenticated using (exists (
    select 1 from commerce.stores s where s.id = stock_movements.store_id and private.has_role('comercio', s.commerce_id)));
create policy movements_select_admin on commerce.stock_movements
  for select to authenticated using (private.is_admin_console());

grant select on commerce.inventory, commerce.stock_movements to authenticated;

-- Activa o desactiva el control y fija el umbral de alerta. La fila nace aquí, con cantidad 0.
create or replace function public.set_stock_tracking(p_variant uuid, p_track boolean, p_threshold int default 5)
returns void language plpgsql security definer set search_path = '' as $$
declare v_variant commerce.product_variants;
begin
  select * into v_variant from commerce.product_variants where id = p_variant;
  if not found then
    raise exception 'variante no encontrada' using errcode = 'P0002';
  end if;
  perform private.require_store_manager(private.store_commerce(v_variant.store_id));
  if p_threshold is null or p_threshold < 0 or p_threshold >= 1000000 then
    raise exception 'el umbral de stock bajo debe estar entre 0 y 999 999' using errcode = '22023';
  end if;
  insert into commerce.inventory (variant_id, store_id, track_stock, low_stock_threshold)
  values (p_variant, v_variant.store_id, coalesce(p_track, false), p_threshold)
  on conflict (variant_id) do update
    set track_stock = excluded.track_stock, low_stock_threshold = excluded.low_stock_threshold, updated_at = now();
  perform private.write_audit('inventory.tracking_changed', 'variant', p_variant::text, null,
    jsonb_build_object('track', coalesce(p_track, false), 'threshold', p_threshold));
end $$;

create or replace function private.apply_stock_change(p_variant uuid, p_kind text, p_amount int, p_reason text)
returns int language plpgsql security definer set search_path = '' as $$
declare
  v_inv commerce.inventory;
  v_new int;
  v_delta int;
begin
  if p_reason is null or char_length(btrim(p_reason)) < 5 or char_length(p_reason) > 200 then
    raise exception 'indica el motivo (entre 5 y 200 caracteres)' using errcode = '22023';
  end if;
  select * into v_inv from commerce.inventory where variant_id = p_variant for update;
  if not found or not v_inv.track_stock then
    raise exception 'activa primero el control de stock de esta variante' using errcode = '22023';
  end if;
  perform private.require_store_manager(private.store_commerce(v_inv.store_id));
  if p_amount is null or p_amount < 0 or p_amount >= 1000000 then
    raise exception 'la cantidad debe estar entre 0 y 999 999' using errcode = '22023';
  end if;
  if p_kind = 'entrada' then
    if p_amount = 0 then raise exception 'la cantidad debe ser mayor que cero' using errcode = '22023'; end if;
    v_new := v_inv.quantity + p_amount;
  elsif p_kind = 'salida' then
    if p_amount = 0 then raise exception 'la cantidad debe ser mayor que cero' using errcode = '22023'; end if;
    v_new := v_inv.quantity - p_amount;
    if v_new < 0 then
      raise exception 'no hay suficientes unidades: quedan %', v_inv.quantity using errcode = '22023';
    end if;
  else
    v_new := p_amount;
  end if;
  if v_new >= 1000000 then
    raise exception 'el stock no puede pasar de 999 999 unidades' using errcode = '22023';
  end if;
  v_delta := v_new - v_inv.quantity;
  update commerce.inventory set quantity = v_new, updated_at = now() where variant_id = p_variant;
  insert into commerce.stock_movements (variant_id, store_id, kind, delta, quantity_after, reason, created_by)
  values (p_variant, v_inv.store_id, p_kind, v_delta, v_new, btrim(p_reason), auth.uid());
  perform private.write_audit('inventory.' || p_kind, 'variant', p_variant::text, null,
    jsonb_build_object('delta', v_delta, 'quantity_after', v_new), p_reason);
  return v_new;
end $$;

create or replace function public.add_stock(p_variant uuid, p_amount int, p_reason text)
returns int language sql security definer set search_path = '' as $$
  select private.apply_stock_change(p_variant, 'entrada', p_amount, p_reason);
$$;
create or replace function public.remove_stock(p_variant uuid, p_amount int, p_reason text)
returns int language sql security definer set search_path = '' as $$
  select private.apply_stock_change(p_variant, 'salida', p_amount, p_reason);
$$;
-- Conteo físico: fija la cantidad exacta.
create or replace function public.count_stock(p_variant uuid, p_quantity int, p_reason text)
returns int language sql security definer set search_path = '' as $$
  select private.apply_stock_change(p_variant, 'conteo', p_quantity, p_reason);
$$;

-- Estado: sin_control | agotado | bajo | disponible. `available` es lo que usará el catálogo público (F4).
create view public.inventory_list with (security_invoker = true) as
  select v.id as variant_id, v.product_id, p.name as product_name, v.name as variant_name, v.sku,
         v.store_id, s.name as store_name, s.commerce_id,
         p.status as product_status, v.status as variant_status,
         coalesce(i.track_stock, false) as track_stock,
         coalesce(i.quantity, 0) as quantity,
         coalesce(i.low_stock_threshold, 5) as low_stock_threshold,
         case
           when not coalesce(i.track_stock, false) then 'sin_control'
           when i.quantity = 0 then 'agotado'
           when i.quantity <= i.low_stock_threshold then 'bajo'
           else 'disponible'
         end as stock_state,
         (not coalesce(i.track_stock, false) or i.quantity > 0) as available,
         i.updated_at
  from commerce.product_variants v
  join commerce.products p on p.id = v.product_id
  join commerce.stores s on s.id = v.store_id
  left join commerce.inventory i on i.variant_id = v.id
  where p.status <> 'archivado';

create view public.stock_movements_list with (security_invoker = true) as
  select id, variant_id, store_id, kind, delta, quantity_after, reason, created_at
  from commerce.stock_movements;

revoke all on function public.set_stock_tracking(uuid, boolean, int),
  public.add_stock(uuid, int, text), public.remove_stock(uuid, int, text), public.count_stock(uuid, int, text)
from public, anon;
grant execute on function public.set_stock_tracking(uuid, boolean, int),
  public.add_stock(uuid, int, text), public.remove_stock(uuid, int, text), public.count_stock(uuid, int, text)
to authenticated;

revoke all on public.inventory_list, public.stock_movements_list from public, anon;
grant select on public.inventory_list, public.stock_movements_list to authenticated;
