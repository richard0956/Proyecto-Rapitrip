-- 10 comercios para el Supabase local: 7 empresas (con RUC) y 3 vendedores propios, cada uno con su convenio (porcentaje de
-- liquidación, plazo y quién asume las devoluciones), una tienda con ubicación para el ruteo y su horario. Sin productos todavía.
-- Idempotente: se puede correr de nuevo (reconoce el comercio por su nombre).
--   docker exec -i supabase_db_rapitrip psql -U postgres -v ON_ERROR_STOP=1 < scripts/dev/seed-commerces.sql
-- Las coordenadas son aproximadas, solo para probar el ruteo. En producción los comercios entran por solicitud aprobada.
do $$
declare
  r record;
  v_commerce uuid;
  v_store uuid;
begin
  for r in
    select * from (values
      -- nombre, tipo, RUC, % liquidación, plazo (días), costo de devolución, dirección, teléfono, depto, lat, lng, envío, abre, cierra, días
      ('Distribuidora El Progreso', 'empresa', 'J0310000200011', 10.00, 7,  'comercio', 'Carretera Norte, km 6, frente a Zona Franca, Managua',   '+505 2255 0101', 'managua', 12.1475, -86.2145, 45.00, '07:30', '17:30', '1-6'),
      ('Farmacia Central Salud',    'empresa', 'J0310000200022', 8.00,  15, 'rapitrip', 'Barrio Linda Vista, 2 c. al sur de la rotonda, Managua',   '+505 2266 0202', 'managua', 12.1232, -86.2850, 35.00, '08:00', '21:00', '0-6'),
      ('Electrohogar Metro',        'empresa', 'J0310000200033', 12.00, 10, 'comercio', 'Frente a Metrocentro, Managua',                             '+505 2270 0303', 'managua', 12.1330, -86.2510, 50.00, '09:00', '19:00', '0-6'),
      ('Tecnomarket Rotonda',       'empresa', 'J0310000200044', 11.00, 7,  'rapitrip', 'Rotonda Centroamérica, 1 c. al este, Managua',              '+505 2278 0404', 'managua', 12.1180, -86.2150, 40.00, '09:00', '20:00', '1-6'),
      ('Ferretería Los Pinos',      'empresa', 'J0310000200055', 9.00,  15, 'comercio', 'Calle Real, 3 c. al norte del parque, Masaya',               '+505 2522 0505', 'masaya',  11.9740, -86.0950, 55.00, '07:00', '17:00', '1-6'),
      ('Boutique Casa Bella',       'empresa', 'J0310000200066', 13.00, 10, 'comercio', 'Calle La Calzada, esquina del hotel, Granada',              '+505 2552 0606', 'granada', 11.9344, -85.9560, 60.00, '09:00', '18:00', '1-6'),
      ('Papelería El Estudiante',   'empresa', 'J0310000200077', 10.00, 15, 'rapitrip', 'Frente a la Catedral, 1 c. al sur, León',                    '+505 2311 0707', 'leon',    12.4379, -86.8780, 55.00, '08:00', '18:00', '1-6'),
      ('Repostería Doña Marta',     'informal', null,            12.00, 7,  'comercio', 'Residencial Altamira, casa 14, Managua',                    '+505 8851 0808', 'managua', 12.1140, -86.2380, 30.00, '08:00', '16:00', '1-6'),
      ('Verduras Don Chepe',        'informal', null,            14.00, 7,  'comercio', 'Mercado Oriental, pabellón 3, puesto 22, Managua',          '+505 8852 0909', 'managua', 12.1380, -86.2380, 30.00, '06:00', '14:00', '0-6'),
      ('Artesanías Rosa',           'informal', null,            15.00, 15, 'comercio', 'Mercado Nacional de Artesanías, local 9, Masaya',           '+505 8853 1010', 'masaya',  11.9738, -86.0937, 45.00, '09:00', '17:00', '0-6')
    ) as t(name, kind, ruc, pct, period, bearer, address, phone, dept, lat, lng, fee, opens, closes, days)
  loop
    select id into v_commerce from identity.commerces where name = r.name;
    if v_commerce is null then
      insert into identity.commerces (name, kind, ruc) values (r.name, r.kind, r.ruc) returning id into v_commerce;
    end if;

    insert into sales.commerce_agreements (commerce_id, commission_pct, period_days, return_cost_bearer)
    values (v_commerce, r.pct, r.period, r.bearer)
    on conflict (commerce_id) do update
      set commission_pct = excluded.commission_pct, period_days = excluded.period_days, return_cost_bearer = excluded.return_cost_bearer, updated_at = now();

    select id into v_store from commerce.stores where commerce_id = v_commerce and name = r.name;
    if v_store is null then
      insert into commerce.stores (commerce_id, name, address, contact_phone, delivery_fee, latitude, longitude, department)
      values (v_commerce, r.name, r.address, r.phone, r.fee, r.lat, r.lng, r.dept) returning id into v_store;
    else
      update commerce.stores set address = r.address, contact_phone = r.phone, delivery_fee = r.fee, latitude = r.lat, longitude = r.lng, department = r.dept, updated_at = now() where id = v_store;
    end if;

    delete from commerce.store_hours where store_id = v_store;
    insert into commerce.store_hours (store_id, weekday, opens, closes)
    select v_store, d, r.opens::time, r.closes::time
      from generate_series(split_part(r.days, '-', 1)::int, split_part(r.days, '-', 2)::int) d;
  end loop;
end $$;

select c.name, c.kind, c.ruc, a.commission_pct as "liquid_%", a.period_days as dias, a.return_cost_bearer as devolucion,
       s.department, s.latitude, s.longitude, s.delivery_fee as envio, (select count(*) from commerce.store_hours h where h.store_id = s.id) as dias_horario
  from identity.commerces c
  join sales.commerce_agreements a on a.commerce_id = c.id
  join commerce.stores s on s.commerce_id = c.id
 where c.ruc like 'J03100002000%' or c.name in ('Repostería Doña Marta', 'Verduras Don Chepe', 'Artesanías Rosa')
 order by c.kind desc, c.name;
