-- Fase 2, cierre: la administración puede suspender y reactivar un comercio completo.
-- Un comercio suspendido pierde el acceso de su cuenta (private.has_role exige comercio activo) y sus tiendas dejan de estar abiertas.
-- Nada se borra: al reactivar, todo vuelve como estaba.

create or replace function public.set_commerce_status(p_commerce uuid, p_status text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_old text;
begin
  perform private.require_admin_console();
  if not private.can_manage('comercio') then
    raise exception 'no tienes permiso para gestionar comercios' using errcode = '42501';
  end if;
  if p_status not in ('activo', 'suspendido') then
    raise exception 'estado inválido' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) < 5 or char_length(p_reason) > 500 then
    raise exception 'el motivo es obligatorio (entre 5 y 500 caracteres)' using errcode = '22023';
  end if;
  select status into v_old from identity.commerces where id = p_commerce for update;
  if not found then
    raise exception 'comercio no encontrado' using errcode = 'P0002';
  end if;
  if v_old = p_status then
    raise exception 'el comercio ya está en ese estado' using errcode = '22023';
  end if;
  update identity.commerces set status = p_status where id = p_commerce;
  perform private.write_audit('commerce.status_changed', 'commerce', p_commerce::text, null,
    jsonb_build_object('status', p_status), p_reason);
end $$;

-- Una tienda de un comercio suspendido no está abierta, aunque su horario diga lo contrario.
create or replace function private.store_open_at(p_store commerce.stores, p_at timestamptz default now())
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  v_local timestamp := p_at at time zone 'America/Costa_Rica';
  v_exc commerce.store_exceptions;
begin
  if p_store.status <> 'activa' then return false; end if;
  if not exists (select 1 from identity.commerces where id = p_store.commerce_id and status = 'activo') then return false; end if;
  if p_store.closed_until is not null and p_store.closed_until > p_at then return false; end if;
  select * into v_exc from commerce.store_exceptions where store_id = p_store.id and on_date = v_local::date;
  if found then
    return not v_exc.closed and v_local::time >= v_exc.opens and v_local::time < v_exc.closes;
  end if;
  return exists (
    select 1 from commerce.store_hours h
    where h.store_id = p_store.id and h.weekday = extract(dow from v_local)::smallint
      and v_local::time >= h.opens and v_local::time < h.closes);
end $$;

revoke all on function public.set_commerce_status(uuid, text, text) from public, anon;
grant execute on function public.set_commerce_status(uuid, text, text) to authenticated;
