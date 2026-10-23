-- Datos de DEMOSTRACIÓN de ventas (no es una semilla de producción; no se ejecuta con `db reset`). Se corre DESPUÉS de
-- `flujo_demo.sql` y `comercios_demo.sql`. Con las funciones reales y la sesión de cada persona crea:
--   · 12 clientes compradores con su libreta de direcciones;
--   · unos 60 pedidos a domicilio repartidos entre las tiendas ABIERTAS en el momento de correr el script, con efectivo y tarjeta,
--     en todos los estados (entregados, cancelados por el cliente, rechazados por el comercio, pendientes de pago, por confirmar,
--     confirmados, preparando, listos y en camino), con repartidores asignados por coordinación;
--   · 2 cajeros con turnos de caja cerrados (con diferencias de efectivo) y ventas de mostrador, una anulada, y un turno abierto.
-- Las fechas de lo ya terminado se reparten en los últimos 30 días para que haya historial. Clave de las cuentas: Demo-12345.
-- Los pedidos «por confirmar» creados aquí no vencen solos (se les quita la fecha de vencimiento).

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

-- Cambia el estado de un pedido con la sesión de quien corresponde y vuelve al rol de base.
create or replace function pg_temp.step(p_user uuid, p_aal text, p_order uuid, p_to text, p_reason text default null) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(p_user, p_aal);
  perform public.set_order_status(p_order, p_to, p_reason);
  reset role;
end $$;

do $demo$
declare
  v_admin uuid; v_luis uuid;
  v_clients uuid[] := '{}'; v_names text[] := array['Ana Lucía Torres','Bayardo Cruz','Cecilia Montoya','Dennis Blandón','Esther Calero','Fabio Zeledón','Gabriela Obando','Hugo Sandino','Ivonne Rivas','Jairo Lacayo','Karla Mejía','Luis Espinoza'];
  v_addr text[] := array['Barrio Monseñor Lezcano, casa 45','Residencial Bolonia, casa 8','Altamira D''Este, del semáforo 2 cuadras al lago','Reparto Schick, bloque C casa 22','Villa Fontana, frente al parque','Barrio Santa Ana, de la iglesia 1 cuadra arriba','Ciudad Jardín, calle principal casa 130','Colonia Centroamérica, casa K-12','Las Colinas, pista principal casa 3','San Judas, de la Cruz Roja 2 cuadras al sur','Carretera Sur km 8, casa azul','Linda Vista, casa 77'];
  v_couriers uuid[]; v_cashiers uuid[] := '{}';
  v_u uuid; i int; n int; v_store uuid; v_owner uuid; v_items jsonb; v_client uuid; v_order uuid; v_method text; v_r float; v_cour uuid;
  v_session uuid; v_cnt int; v_sale uuid; v_sales uuid[]; v_expected numeric; v_diff numeric; v_close jsonb; v_cat record; shift_days int;
  v_made int := 0; v_skipped int := 0;
begin
  select id into v_admin from auth.users where email = 'admin@demo.rapitrip.test';
  select id into v_luis from auth.users where email = 'luis@demo.rapitrip.test';
  if v_admin is null or v_luis is null then raise exception 'Faltan las cuentas de flujo_demo.sql'; end if;
  if exists (select 1 from auth.users where email like 'comprador%@demo.rapitrip.test') then
    raise exception 'Estas ventas de demostración ya existen';
  end if;

  -- Clientes compradores con su dirección guardada.
  for i in 1..12 loop
    v_u := pg_temp.new_user(format('comprador%s@demo.rapitrip.test', lpad(i::text, 2, '0')), v_names[i]);
    v_clients := v_clients || v_u;
    perform pg_temp.as_user(v_u, 'aal1');
    perform public.save_address(null, 'Casa', v_addr[i], null, format('8%s%s', lpad((1000000 + i * 7919)::text, 7, '0'), ''), true);
    reset role;
  end loop;

  -- Repartidores (se suman a Pedro, de flujo_demo.sql).
  perform pg_temp.as_user(v_admin);
  perform public.create_courier('María Repartidora', '88880011', 'moto');
  perform public.create_courier('Josué Repartidor', '88880022', 'bicicleta');
  perform public.create_courier('Karina Repartidora', '88880033', 'moto');
  reset role;
  select array_agg(id) into v_couriers from identity.couriers where status = 'activo';

  -- Pedidos a domicilio.
  for n in 1..60 loop
    begin
      select id into v_store from public.catalog_stores(true, 100, 0) order by random() limit 1;
      continue when v_store is null;
      select ur.user_id into v_owner from identity.user_roles ur join commerce.stores s on s.commerce_id = ur.commerce_id
       where s.id = v_store and ur.role = 'comercio' and ur.status = 'activo' limit 1;
      select jsonb_agg(jsonb_build_object('variant_id', x.id, 'quantity', 1 + floor(random() * 3)::int)) into v_items
        from (select v.id from commerce.product_variants v
                join commerce.products p on p.id = v.product_id and p.status = 'publicado'
                left join commerce.inventory i on i.variant_id = v.id
               where v.store_id = v_store and v.status = 'activa' and (i.variant_id is null or not i.track_stock or i.quantity >= 3)
               order by random() limit 1 + floor(random() * 3)::int) x;
      continue when v_items is null;

      i := 1 + floor(random() * 12)::int;
      v_client := v_clients[i];
      v_method := case when random() < 0.3 then 'tarjeta' else 'efectivo' end;
      perform pg_temp.as_user(v_client, 'aal1');
      v_order := public.create_order(v_store, v_items, v_method, v_addr[i], '88881234', case when random() < 0.3 then 'Llamar al llegar' end, gen_random_uuid(), 12.136400, -86.251400);
      reset role;
      v_made := v_made + 1;

      v_r := random();
      v_cour := v_couriers[1 + floor(random() * array_length(v_couriers, 1))::int];
      if v_method = 'tarjeta' then
        continue when v_r < 0.06;                       -- se queda esperando el pago (pendiente_pago)
        perform public.mark_order_paid(v_order);        -- lo que haría el webhook de Stripe
      end if;

      if v_r < 0.12 then
        perform pg_temp.step(v_client, 'aal1', v_order, 'cancelado', 'Me equivoqué de dirección');
      elsif v_r < 0.18 then
        perform pg_temp.step(v_owner, 'aal2', v_order, 'rechazado', 'Producto agotado en el local');
      elsif v_r < 0.30 then
        null;                                           -- queda por confirmar
      else
        perform pg_temp.step(v_owner, 'aal2', v_order, 'confirmado');
        continue when v_r < 0.38;
        perform pg_temp.step(v_owner, 'aal2', v_order, 'preparando');
        continue when v_r < 0.45;
        perform pg_temp.step(v_owner, 'aal2', v_order, 'listo');
        continue when v_r < 0.52;
        perform pg_temp.as_user(v_luis);
        perform public.assign_order_courier(v_order, v_cour);
        reset role;
        perform pg_temp.step(v_luis, 'aal2', v_order, 'en_camino');
        continue when v_r < 0.60;
        perform pg_temp.step(v_luis, 'aal2', v_order, 'entregado');
      end if;
    exception when others then
      reset role;
      v_skipped := v_skipped + 1;
      raise notice 'Pedido omitido: %', sqlerrm;
    end;
  end loop;
  raise notice 'Pedidos creados: %, omitidos: %', v_made, v_skipped;

  -- Cajeros y ventas de mostrador: 3 turnos cerrados de la caja 1, 2 de la caja 2 y uno abierto.
  for i in 1..2 loop
    v_u := pg_temp.new_user(format('caja%s@demo.rapitrip.test', i), case i when 1 then 'Cajera Uno' else 'Cajero Dos' end);
    insert into identity.user_roles (user_id, role) values (v_u, 'cajero');
    v_cashiers := v_cashiers || v_u;
  end loop;

  for n in 1..6 loop
    v_u := v_cashiers[case when n <= 3 then 1 else 2 end];
    perform pg_temp.as_user(v_u);
    -- El primer turno de cada cajero pide el monto inicial; los siguientes toman el efectivo del cierre anterior.
    v_session := public.open_cash_session(case when n in (1, 4) then 500 else null end);
    reset role;
    v_sales := '{}';
    for v_cnt in 1..(4 + floor(random() * 5)::int) loop
      begin
        select id into v_store from public.catalog_stores(true, 100, 0) order by random() limit 1;
        continue when v_store is null;
        select jsonb_agg(jsonb_build_object('variant_id', x.id, 'quantity', 1 + floor(random() * 2)::int)) into v_items
          from (select v.id from commerce.product_variants v
                  join commerce.products p on p.id = v.product_id and p.status = 'publicado'
                  left join commerce.inventory i on i.variant_id = v.id
                 where v.store_id = v_store and v.status = 'activa' and (i.variant_id is null or not i.track_stock or i.quantity >= 3)
                 order by random() limit 1 + floor(random() * 3)::int) x;
        continue when v_items is null;
        perform pg_temp.as_user(v_u);
        v_sale := public.create_counter_sale(v_store, v_items, case when random() < 0.35 then 'tarjeta' else 'efectivo' end);
        reset role;
        v_sales := v_sales || v_sale;
      exception when others then
        reset role;
        raise notice 'Venta omitida: %', sqlerrm;
      end;
    end loop;
    if array_length(v_sales, 1) > 2 and random() < 0.7 then
      perform pg_temp.as_user(v_u);
      perform public.void_counter_sale(v_sales[1], 'Cliente se arrepintió de la compra');
      reset role;
    end if;
    continue when n = 6;                                 -- el último turno se deja abierto
    select 500 + coalesce(sum(total), 0) into v_expected from sales.orders
     where cash_session_id = v_session and payment_method = 'efectivo' and status = 'entregado';
    v_diff := (array[0, 0, 0, -10, 5, -25])[1 + floor(random() * 6)::int];
    perform pg_temp.as_user(v_u);
    v_close := public.close_cash_session(v_expected + v_diff, case when v_diff <> 0 then 'Diferencia al contar el efectivo del turno' else 'Cierre de demostración' end);
    reset role;
  end loop;

  -- Historial: lo ya terminado se reparte en los últimos 30 días; lo pendiente se deja vigente.
  update sales.orders set expires_at = null where status in ('por_confirmar', 'confirmado') and expires_at is not null;
  for v_cat in select o.id, o.cash_session_id,
                      case when o.cash_session_id is not null then 1 + abs(hashtext(o.cash_session_id::text)) % 30 else (floor(random() * 30) + 1)::int end as d,
                      case when o.cash_session_id is not null then abs(hashtext(o.cash_session_id::text)) % 6 else (random() * 20)::int end as h
                 from sales.orders o
                where (o.client_id in (select id from auth.users where email like 'comprador%@demo.rapitrip.test')
                       and o.status in ('entregado', 'cancelado', 'rechazado'))
                   or (o.cashier_id = any (v_cashiers) and exists (select 1 from sales.cash_sessions cs where cs.id = o.cash_session_id and cs.closed_at is not null))
  loop
    update sales.orders set created_at = created_at - make_interval(days => v_cat.d, hours => v_cat.h),
           updated_at = updated_at - make_interval(days => v_cat.d, hours => v_cat.h),
           confirmed_at = confirmed_at - make_interval(days => v_cat.d, hours => v_cat.h),
           delivered_at = delivered_at - make_interval(days => v_cat.d, hours => v_cat.h)
     where id = v_cat.id;
    update sales.order_events set created_at = created_at - make_interval(days => v_cat.d, hours => v_cat.h) where order_id = v_cat.id;
  end loop;
  update sales.cash_sessions cs set opened_at = opened_at - make_interval(days => 1 + abs(hashtext(cs.id::text)) % 30, hours => abs(hashtext(cs.id::text)) % 6),
         closed_at = closed_at - make_interval(days => 1 + abs(hashtext(cs.id::text)) % 30, hours => abs(hashtext(cs.id::text)) % 6)
   where cashier_id = any (v_cashiers) and closed_at is not null;
end $demo$;

select channel, status, payment_method, count(*) as pedidos, sum(total) as total
from sales.orders group by channel, status, payment_method order by channel, status, payment_method;
