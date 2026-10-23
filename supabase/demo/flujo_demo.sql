-- Flujo completo de Rapitrip con datos de DEMOSTRACIÓN (no es una semilla de producción; no se ejecuta con `db reset`).
-- Recorre, con las funciones reales y con la sesión de cada persona, lo que haría el negocio:
--   solicitud de afiliación → aprobación → catálogo maestro → tienda, horario y envío → productos, variantes e inventario
--   → publicación → dirección y pedido del cliente → comercio confirma, prepara y deja listo → coordinación asigna, despacha y entrega.
-- Cuentas (clave de todas: Demo-12345): ver el último SELECT. Para repetirlo, hay que borrar antes los datos *@demo.rapitrip.test.
-- Las fotos no se cargan aquí (necesitan Storage): se suben desde la consola del comercio.

create or replace function pg_temp.as_user(p_user uuid, p_aal text default 'aal2') returns void language plpgsql as $$
declare
  v_now bigint := extract(epoch from now())::bigint;
  v_amr jsonb := case p_aal
    when 'aal2' then jsonb_build_array(jsonb_build_object('method', 'totp', 'timestamp', v_now), jsonb_build_object('method', 'password', 'timestamp', v_now - 30))
    else jsonb_build_array(jsonb_build_object('method', 'password', 'timestamp', v_now)) end;
begin
  insert into auth.sessions (id, user_id, created_at, updated_at) values (p_user, p_user, now(), now()) on conflict (id) do nothing;
  insert into private.session_activity (session_id, user_id, last_activity_at) values (p_user, p_user, now())
    on conflict (session_id) do update set last_activity_at = excluded.last_activity_at;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal, 'amr', v_amr, 'session_id', p_user)::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

create or replace function pg_temp.new_user(p_email text, p_name text) returns uuid language plpgsql as $$
declare v_id uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                          created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_email,
          extensions.crypt('Demo-12345', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', p_name), now(), now(), '', '', '', '');
  return v_id;
end $$;

do $demo$
declare
  v_admin uuid; v_ana uuid; v_carlos uuid; v_luis uuid;
  v_req uuid; v_commerce uuid; v_store uuid;
  v_abarr uuid; v_granos uuid; v_beb uuid; v_gas uuid; v_lac uuid;
  v_p uuid; v_v uuid; v_courier uuid; v_o1 uuid; v_o2 uuid; v_var_cafe uuid; v_var_arroz uuid; v_var_leche uuid;
  r record;
begin
  if exists (select 1 from auth.users where email like '%@demo.rapitrip.test') then
    raise exception 'La demostración ya existe: borra antes los datos *@demo.rapitrip.test';
  end if;

  v_admin := pg_temp.new_user('admin@demo.rapitrip.test', 'Administración Demo');
  v_ana := pg_temp.new_user('ana@demo.rapitrip.test', 'Ana Martínez');
  v_carlos := pg_temp.new_user('carlos@demo.rapitrip.test', 'Carlos Reyes');
  v_luis := pg_temp.new_user('luis@demo.rapitrip.test', 'Luis Coordinador');
  insert into identity.user_roles (user_id, role) values (v_admin, 'admin'), (v_luis, 'coordinador');

  -- 1. Ana solicita afiliar su negocio desde la tienda (/vende) y la administración la aprueba confirmando el convenio.
  perform pg_temp.as_user(v_ana, 'aal1');
  v_req := public.submit_commerce_request('Pulpería Doña Ana',
    '{"contact_name":"Ana Martínez","phone":"+505 8888 1425","address":"Barrio Central, de la iglesia 2 cuadras al sur","category":"Abarrotes"}'::jsonb);
  reset role;
  perform pg_temp.as_user(v_admin);
  v_commerce := public.approve_commerce_request(v_req, true);

  -- 2. Catálogo maestro (lo carga la administración): categorías con un nivel de subcategorías.
  v_abarr := public.create_master_item('categoria', 'Abarrotes');
  v_granos := public.create_master_item('categoria', 'Granos y cereales', v_abarr);
  v_beb := public.create_master_item('categoria', 'Bebidas');
  v_gas := public.create_master_item('categoria', 'Gaseosas', v_beb);
  v_lac := public.create_master_item('categoria', 'Lácteos y huevos');
  perform public.create_master_item('categoria', 'Café y té', v_abarr);
  perform public.create_master_item('marca', 'Doña Ana');
  perform public.create_master_item('marca', 'Cafetalera del Norte');
  reset role;

  -- 3. Ana entra a la consola: tienda, horario (abierto todo el día, para que la demo funcione a cualquier hora) y costo de envío.
  perform pg_temp.as_user(v_ana);
  v_store := public.create_store(v_commerce, 'Pulpería Doña Ana - Central', 'Barrio Central, de la iglesia 2 cuadras al sur, Managua', '88881425');
  perform public.set_store_location(v_store, 12.136400, -86.251400);
  perform public.set_store_hours(v_store, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', '00:00', 'closes', '23:59')) from generate_series(0, 6) d));
  perform public.set_store_delivery_fee(v_store, 35);

  -- 4. Productos con variantes (precio en córdobas), inventario controlado y publicación.
  for r in select * from (values
    ('Arroz blanco', 'Arroz de grano largo, calidad superior.', v_granos, 'Libra', 'ARROZ-1LB', 14.00, 80, 'Bolsa de 5 libras', 'ARROZ-5LB', 66.00, 40),
    ('Frijoles rojos', 'Frijol rojo de seda, seleccionado.', v_granos, 'Libra', 'FRIJOL-1LB', 30.00, 60, null, null, null, null),
    ('Café molido', 'Tostado medio, molido para filtro.', v_abarr, '250 g', 'CAFE-250', 72.00, 25, '500 g', 'CAFE-500', 135.00, 15),
    ('Gaseosa cola', 'Refresco de cola bien frío.', v_gas, '600 ml', 'COLA-600', 28.00, 48, '2 litros', 'COLA-2L', 58.00, 24),
    ('Leche entera', 'Leche entera pasteurizada.', v_lac, '1 litro', 'LECHE-1L', 40.00, 30, null, null, null, null),
    ('Huevos', 'Huevos frescos de granja.', v_lac, 'Docena', 'HUEVOS-12', 75.00, 20, 'Cartón de 30', 'HUEVOS-30', 175.00, 8),
    ('Aceite vegetal', 'Aceite vegetal para cocinar.', v_abarr, '1 litro', 'ACEITE-1L', 66.00, 0, null, null, null, null)
  ) as t(name, descr, cat, v1, s1, p1, q1, v2, s2, p2, q2)
  loop
    v_p := public.create_product(v_store, r.name, r.descr, r.cat);
    v_v := public.create_variant(v_p, r.v1, r.s1, r.p1);
    perform public.set_stock_tracking(v_v, true, 5);
    if r.q1 > 0 then perform public.count_stock(v_v, r.q1, 'Conteo inicial de la demostración'); end if;
    if r.s1 = 'CAFE-250' then v_var_cafe := v_v; end if;
    if r.s1 = 'ARROZ-1LB' then v_var_arroz := v_v; end if;
    if r.s1 = 'LECHE-1L' then v_var_leche := v_v; end if;
    if r.s2 is not null then
      v_v := public.create_variant(v_p, r.v2, r.s2, r.p2);
      perform public.set_stock_tracking(v_v, true, 3);
      perform public.count_stock(v_v, r.q2, 'Conteo inicial de la demostración');
    end if;
    perform public.set_product_status(v_p, 'publicado');
  end loop;
  -- Un producto queda en borrador a propósito (no debe verse en la tienda).
  v_p := public.create_product(v_store, 'Queso fresco (borrador)', 'Todavía sin precio definitivo.', v_lac);
  perform public.create_variant(v_p, 'Libra', 'QUESO-1LB', 55.00);
  reset role;

  -- 5. Carlos, cliente, guarda su dirección y hace dos pedidos en efectivo (como lo haría el checkout).
  perform pg_temp.as_user(v_carlos, 'aal1');
  perform public.save_address(null, 'Casa', 'Residencial Las Palmas, casa 12, frente al parque', 'portón verde', '88885566', true);
  v_o1 := public.create_order(v_store,
    jsonb_build_array(jsonb_build_object('variant_id', v_var_cafe, 'quantity', 2), jsonb_build_object('variant_id', v_var_arroz, 'quantity', 5)),
    'efectivo', 'Residencial Las Palmas, casa 12, frente al parque', '88885566', 'Tocar el timbre', gen_random_uuid(), 12.136400, -86.251400);
  v_o2 := public.create_order(v_store,
    jsonb_build_array(jsonb_build_object('variant_id', v_var_leche, 'quantity', 3)),
    'efectivo', 'Residencial Las Palmas, casa 12, frente al parque', '88885566', null, gen_random_uuid(), 12.136400, -86.251400);
  reset role;

  -- 6. Ana atiende el primer pedido: confirma, prepara y lo deja listo (el segundo queda por confirmar).
  perform pg_temp.as_user(v_ana);
  perform public.set_order_status(v_o1, 'confirmado');
  perform public.set_order_status(v_o1, 'preparando');
  perform public.set_order_status(v_o1, 'listo');
  reset role;

  -- 7. Administración registra al repartidor; coordinación lo asigna, despacha y entrega.
  perform pg_temp.as_user(v_admin);
  v_courier := public.create_courier('Pedro Repartidor', '88887777', 'moto');
  reset role;
  perform pg_temp.as_user(v_luis);
  perform public.assign_order_courier(v_o1, v_courier);
  perform public.set_order_status(v_o1, 'en_camino');
  perform public.set_order_status(v_o1, 'entregado');
  reset role;
end $demo$;

select o.number, o.status, o.payment_status, o.total, s.name as tienda
from sales.orders o join commerce.stores s on s.id = o.store_id
where o.client_id in (select id from auth.users where email = 'carlos@demo.rapitrip.test') order by o.number;
