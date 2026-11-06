-- Ubicación de referencia del repartidor (latitud y longitud). Por ahora es fija y se carga a mano para probar los mapas;
-- cuando la app del repartidor publique su GPS real, escribirá en estas mismas columnas.
alter table identity.couriers
  add column latitude numeric(9, 6) check (latitude between -90 and 90),
  add column longitude numeric(9, 6) check (longitude between -180 and 180),
  add column location_updated_at timestamptz,
  add constraint couriers_location_pair check ((latitude is null) = (longitude is null));

-- La consola lee la ubicación por la vista del listado (las columnas nuevas van al final, como exige `create or replace`).
create or replace view public.couriers_list with (security_invoker = true) as
  select id, full_name, phone, vehicle_type, status, user_id, created_at, vehicle_class, department, available, available_since,
         private.user_has_push(user_id) as push_enabled,
         latitude, longitude, location_updated_at
    from identity.couriers;
