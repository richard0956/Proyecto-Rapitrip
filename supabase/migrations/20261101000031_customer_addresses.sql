-- Fase 4, etapa 3: libreta de direcciones del cliente (decisión D4).
-- Cada cliente guarda hasta 10 direcciones de entrega, una predeterminada. Son datos personales: solo las ve su dueño y
-- se borran al anonimizar la cuenta. El pedido sigue copiando la dirección como texto (`create_order` no cambia).
--
-- Mapa (pendiente, otra fase): `latitude` y `longitude` quedan reservadas y opcionales. Hoy ninguna pantalla las llena;
-- cuando llegue el mapa bastará con enviarlas en `save_address`, sin migrar nada.

create table sales.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  label text not null check (char_length(btrim(label)) between 1 and 40),
  address text not null check (char_length(btrim(address)) between 5 and 240),
  reference text check (reference is null or char_length(reference) <= 240),
  phone text check (phone is null or phone ~ '^[0-9+() -]{8,20}$'),
  latitude numeric(9, 6) check (latitude is null or latitude between -90 and 90),
  longitude numeric(9, 6) check (longitude is null or longitude between -180 and 180),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);
create index customer_addresses_client_idx on sales.customer_addresses (client_id, created_at desc);
create unique index customer_addresses_one_default on sales.customer_addresses (client_id) where is_default;
create unique index customer_addresses_unique_label on sales.customer_addresses (client_id, lower(btrim(label)));

alter table sales.customer_addresses enable row level security;
create policy customer_addresses_select_own on sales.customer_addresses
  for select to authenticated using (client_id = auth.uid() and private.has_valid_session());
grant select on sales.customer_addresses to authenticated;

create view public.my_addresses with (security_invoker = true) as
  select id, label, address, reference, phone, latitude, longitude, is_default, created_at, updated_at
  from sales.customer_addresses;
revoke all on public.my_addresses from public, anon;
grant select on public.my_addresses to authenticated;

-- Crea (p_id nulo) o edita una dirección propia. La primera que se guarda queda como predeterminada.
create or replace function public.save_address(
  p_id uuid, p_label text, p_address text, p_reference text default null, p_phone text default null,
  p_make_default boolean default false, p_latitude numeric default null, p_longitude numeric default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_first boolean;
  v_default boolean;
begin
  perform private.require_valid_session();
  if not private.has_role('cliente') then
    raise exception 'solo los clientes guardan direcciones' using errcode = '42501';
  end if;
  if p_label is null or char_length(btrim(p_label)) not between 1 and 40 then
    raise exception 'el nombre de la dirección debe tener entre 1 y 40 caracteres' using errcode = '22023';
  end if;
  if p_address is null or char_length(btrim(p_address)) not between 5 and 240 then
    raise exception 'la dirección debe tener entre 5 y 240 caracteres' using errcode = '22023';
  end if;
  if p_reference is not null and char_length(p_reference) > 240 then
    raise exception 'la referencia es demasiado larga' using errcode = '22023';
  end if;
  if p_phone is not null and p_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'teléfono inválido' using errcode = '22023';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'coordenadas inválidas' using errcode = '22023';
  end if;

  -- Serializa por cliente para que el tope y la dirección predeterminada no se crucen entre pestañas.
  perform pg_advisory_xact_lock(hashtextextended('addr:' || auth.uid()::text, 0));

  if p_id is null then
    if (select count(*) from sales.customer_addresses where client_id = auth.uid()) >= 10 then
      raise exception 'puedes guardar hasta 10 direcciones: elimina alguna para agregar otra' using errcode = '22023';
    end if;
    v_first := not exists (select 1 from sales.customer_addresses where client_id = auth.uid());
    v_default := v_first or coalesce(p_make_default, false);
    if v_default then
      update sales.customer_addresses set is_default = false, updated_at = now() where client_id = auth.uid() and is_default;
    end if;
    begin
      insert into sales.customer_addresses (client_id, label, address, reference, phone, latitude, longitude, is_default)
      values (auth.uid(), btrim(p_label), btrim(p_address), nullif(btrim(p_reference), ''), p_phone, p_latitude, p_longitude, v_default)
      returning id into v_id;
    exception when unique_violation then
      raise exception 'ya tienes una dirección con ese nombre' using errcode = '23505';
    end;
  else
    if not exists (select 1 from sales.customer_addresses where id = p_id and client_id = auth.uid()) then
      raise exception 'dirección no encontrada' using errcode = 'P0002';
    end if;
    if coalesce(p_make_default, false) then
      update sales.customer_addresses set is_default = false, updated_at = now()
       where client_id = auth.uid() and is_default and id <> p_id;
    end if;
    begin
      update sales.customer_addresses
         set label = btrim(p_label), address = btrim(p_address), reference = nullif(btrim(p_reference), ''), phone = p_phone,
             latitude = p_latitude, longitude = p_longitude,
             is_default = is_default or coalesce(p_make_default, false), updated_at = now()
       where id = p_id and client_id = auth.uid();
    exception when unique_violation then
      raise exception 'ya tienes una dirección con ese nombre' using errcode = '23505';
    end;
    v_id := p_id;
  end if;
  return v_id;
end $$;

-- Marca una dirección propia como predeterminada.
create or replace function public.set_default_address(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_valid_session();
  perform pg_advisory_xact_lock(hashtextextended('addr:' || auth.uid()::text, 0));
  if not exists (select 1 from sales.customer_addresses where id = p_id and client_id = auth.uid()) then
    raise exception 'dirección no encontrada' using errcode = 'P0002';
  end if;
  update sales.customer_addresses set is_default = false, updated_at = now() where client_id = auth.uid() and is_default and id <> p_id;
  update sales.customer_addresses set is_default = true, updated_at = now() where id = p_id and client_id = auth.uid() and not is_default;
end $$;

-- Elimina una dirección propia. Si era la predeterminada, la más reciente que quede pasa a serlo.
create or replace function public.delete_address(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_was_default boolean;
begin
  perform private.require_valid_session();
  perform pg_advisory_xact_lock(hashtextextended('addr:' || auth.uid()::text, 0));
  delete from sales.customer_addresses where id = p_id and client_id = auth.uid() returning is_default into v_was_default;
  if not found then
    raise exception 'dirección no encontrada' using errcode = 'P0002';
  end if;
  if v_was_default then
    update sales.customer_addresses set is_default = true, updated_at = now()
     where id = (select id from sales.customer_addresses where client_id = auth.uid() order by created_at desc, id limit 1);
  end if;
end $$;

revoke all on function public.save_address(uuid, text, text, text, text, boolean, numeric, numeric),
  public.set_default_address(uuid), public.delete_address(uuid) from public, anon, authenticated;
grant execute on function public.save_address(uuid, text, text, text, text, boolean, numeric, numeric),
  public.set_default_address(uuid), public.delete_address(uuid) to authenticated;

-- Al anonimizar una cuenta se borra su libreta de direcciones.
create or replace function private.wipe_customer_addresses()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from sales.customer_addresses where client_id = new.id;
  return new;
end $$;

create trigger wipe_customer_addresses_on_anonymize
  after update of status on identity.profiles
  for each row when (new.status = 'anonimizada' and old.status is distinct from new.status)
  execute function private.wipe_customer_addresses();
