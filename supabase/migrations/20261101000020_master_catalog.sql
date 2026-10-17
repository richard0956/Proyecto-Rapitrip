-- Fase 2, etapa 3: catálogo maestro (categorías, marcas, tipos de producto y atributos).
-- Es orientativo: el comercio lo consulta para clasificar sus productos, pero publicar no lo exige.
-- Lo administra la dirección o la administración; las apps escriben solo por funciones auditadas.

create table commerce.master_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('categoria', 'marca', 'tipo_producto', 'atributo')),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  parent_id uuid references commerce.master_items(id),
  status text not null default 'activo' check (status in ('activo', 'inactivo')),
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index master_items_unique_name on commerce.master_items (kind, lower(btrim(name)), coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index master_items_parent_idx on commerce.master_items (parent_id);

alter table commerce.master_items enable row level security;

-- Lectura: administración y cuentas de comercio (solo elementos activos para el comercio).
create policy master_items_select_admin on commerce.master_items
  for select to authenticated using (private.is_admin_console());
create policy master_items_select_commerce on commerce.master_items
  for select to authenticated using (status = 'activo' and private.has_any_role(array['comercio']::identity.app_role[]));

grant select on commerce.master_items to authenticated;

-- Solo las categorías pueden tener padre, y solo de la misma clase (un nivel de anidación).
create or replace function private.validate_master_item(p_kind text, p_name text, p_parent uuid)
returns void language plpgsql stable set search_path = '' as $$
declare v_parent commerce.master_items;
begin
  if p_kind not in ('categoria', 'marca', 'tipo_producto', 'atributo') then
    raise exception 'clase inválida' using errcode = '22023';
  end if;
  if p_name is null or char_length(btrim(p_name)) not between 2 and 80 then
    raise exception 'el nombre debe tener entre 2 y 80 caracteres' using errcode = '22023';
  end if;
  if p_parent is not null then
    if p_kind <> 'categoria' then
      raise exception 'solo las categorías pueden tener una categoría padre' using errcode = '22023';
    end if;
    select * into v_parent from commerce.master_items where id = p_parent;
    if not found or v_parent.kind <> 'categoria' then
      raise exception 'categoría padre no encontrada' using errcode = 'P0002';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'las categorías admiten un solo nivel de subcategorías' using errcode = '22023';
    end if;
  end if;
end $$;

create or replace function public.create_master_item(p_kind text, p_name text, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_admin_console();
  perform private.validate_master_item(p_kind, p_name, p_parent);
  begin
    insert into commerce.master_items (kind, name, parent_id, created_by)
    values (p_kind, btrim(p_name), p_parent, auth.uid())
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ya existe un elemento con ese nombre' using errcode = '23505';
  end;
  perform private.write_audit('master_item.created', 'master_item', v_id::text, null, jsonb_build_object('kind', p_kind));
  return v_id;
end $$;

create or replace function public.rename_master_item(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item commerce.master_items;
begin
  perform private.require_admin_console();
  select * into v_item from commerce.master_items where id = p_id for update;
  if not found then
    raise exception 'elemento no encontrado' using errcode = 'P0002';
  end if;
  perform private.validate_master_item(v_item.kind, p_name, v_item.parent_id);
  begin
    update commerce.master_items set name = btrim(p_name), updated_at = now() where id = p_id;
  exception when unique_violation then
    raise exception 'ya existe un elemento con ese nombre' using errcode = '23505';
  end;
  perform private.write_audit('master_item.renamed', 'master_item', p_id::text, null,
    jsonb_build_object('kind', v_item.kind, 'changed_fields', jsonb_build_array('name')));
end $$;

-- Desactivar una categoría desactiva también sus subcategorías.
create or replace function public.set_master_item_status(p_id uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_item commerce.master_items;
begin
  perform private.require_admin_console();
  if p_status not in ('activo', 'inactivo') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_status = 'inactivo' and (p_reason is null or char_length(btrim(p_reason)) < 5) then
    raise exception 'indica el motivo (mínimo 5 caracteres)' using errcode = '22023';
  end if;
  select * into v_item from commerce.master_items where id = p_id for update;
  if not found then
    raise exception 'elemento no encontrado' using errcode = 'P0002';
  end if;
  if p_status = 'activo' and v_item.parent_id is not null
     and exists (select 1 from commerce.master_items where id = v_item.parent_id and status = 'inactivo') then
    raise exception 'activa primero la categoría padre' using errcode = '22023';
  end if;
  update commerce.master_items set status = p_status, updated_at = now()
    where id = p_id or (p_status = 'inactivo' and parent_id = p_id);
  perform private.write_audit('master_item.status_changed', 'master_item', p_id::text, null,
    jsonb_build_object('kind', v_item.kind, 'status', p_status), p_reason);
end $$;

create view public.master_items_list with (security_invoker = true) as
  select m.id, m.kind, m.name, m.parent_id, p.name as parent_name, m.status, m.created_at, m.updated_at
  from commerce.master_items m
  left join commerce.master_items p on p.id = m.parent_id;

revoke all on function public.create_master_item(text, text, uuid), public.rename_master_item(uuid, text),
  public.set_master_item_status(uuid, text, text) from public, anon;
grant execute on function public.create_master_item(text, text, uuid), public.rename_master_item(uuid, text),
  public.set_master_item_status(uuid, text, text) to authenticated;

revoke all on public.master_items_list from public, anon;
grant select on public.master_items_list to authenticated;
