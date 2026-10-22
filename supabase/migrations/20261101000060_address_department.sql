-- Entregas express y programadas, etapa 4: el departamento de la dirección del cliente.
-- `sales.customer_addresses.department` existe desde la migración 57; `save_address` no cambia (su firma ya es larga y tiene pruebas),
-- así que el departamento se fija con esta función aparte, tras guardar la dirección. Nulo lo quita.

create or replace function public.set_address_department(p_id uuid, p_department text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_valid_session();
  if not private.has_role('cliente') then
    raise exception 'solo los clientes guardan direcciones' using errcode = '42501';
  end if;
  if p_department is not null and not exists (select 1 from sales.departments where code = p_department) then
    raise exception 'departamento no válido' using errcode = '22023';
  end if;
  update sales.customer_addresses set department = p_department, updated_at = now()
   where id = p_id and client_id = auth.uid();
  if not found then
    raise exception 'dirección no encontrada' using errcode = 'P0002';
  end if;
end $$;

revoke all on function public.set_address_department(uuid, text) from public, anon, authenticated;
grant execute on function public.set_address_department(uuid, text) to authenticated;
