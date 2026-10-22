-- Datos de DEMOSTRACIÓN (no es una semilla de producción; no se ejecuta con `db reset`). Se corre DESPUÉS de `flujo_demo.sql`
-- (usa la cuenta de administración admin@demo.rapitrip.test).
-- Crea 10 clientes que ya pidieron afiliarse y fueron aprobados (4 como empresa con RUC y 6 como vendedor propio), cada uno con su comercio, una tienda, horario, envío y productos con
-- variantes e inventario; más un cliente (pendiente@demo.rapitrip.test) cuya solicitud queda PENDIENTE como ejemplo de afiliación.
-- Clave de todas las cuentas: Demo-12345. Las fotos no se cargan aquí (necesitan Storage).

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
  v_admin uuid; v_owner uuid; v_req uuid; v_commerce uuid; v_store uuid; v_p uuid; v_v uuid;
  c jsonb; pr jsonb; va jsonb; i int; j int; k int := 0; v_cat uuid; v_qty int;
  v_data jsonb := $json$[
   {"owner":"Marta Gómez","commerce":"Panadería La Espiga","cat":"Panadería","store":"La Espiga - Centro","addr":"Costado norte del parque central, Masaya","phone":"22522001","fee":30,"open":"05:00","close":"19:00","track":true,"products":[
     {"n":"Pan francés","d":"Pan crujiente recién horneado.","v":[["Unidad",5],["Bolsa de 6",25]]},
     {"n":"Pan dulce surtido","d":"Variedad de pan dulce tradicional.","v":[["Bolsa de 6",40]]},
     {"n":"Rosquillas","d":"Rosquillas de maíz y queso.","v":[["Bolsa",45]]},
     {"n":"Tres leches","d":"Pastel tres leches casero.","v":[["Porción",60],["Torta completa",380]]},
     {"n":"Pan de molde","d":"Pan blanco rebanado.","v":[["Paquete",55]]},
     {"n":"Queque de zanahoria","d":"Con nueces y glaseado.","v":[["Porción",50]],"draft":true}]},
   {"owner":"Rafael Mendoza","commerce":"Farmacia San Rafael","ruc":"J0310000011223","cat":"Farmacia y salud","store":"Farmacia San Rafael","addr":"Frente al hospital, Carretera Norte, Managua","phone":"22701144","fee":40,"open":"00:00","close":"23:59","track":true,"products":[
     {"n":"Acetaminofén 500 mg","d":"Analgésico y antifebril.","v":[["Caja 10 tabletas",35],["Caja 20 tabletas",60]]},
     {"n":"Ibuprofeno 400 mg","d":"Antiinflamatorio.","v":[["Caja 10 tabletas",55]]},
     {"n":"Suero oral","d":"Sales de rehidratación.","v":[["Sobre",25]]},
     {"n":"Alcohol 70%","d":"Antiséptico de uso externo.","v":[["120 ml",40],["500 ml",90]]},
     {"n":"Vitamina C","d":"Tabletas masticables.","v":[["Frasco 60 tabletas",120]]},
     {"n":"Mascarillas desechables","d":"Caja de mascarillas de 3 capas.","v":[["Caja de 50",150]]}]},
   {"owner":"Julio Pérez","commerce":"Ferretería El Tornillo","ruc":"J0310000044556","cat":"Ferretería","store":"Ferretería El Tornillo","addr":"Mercado Israel Lewites, módulo 14, Managua","phone":"22663355","fee":50,"open":"07:00","close":"17:00","track":true,"products":[
     {"n":"Martillo de uña","d":"Mango de fibra de vidrio.","v":[["Unidad",220]]},
     {"n":"Clavos de 2 pulgadas","d":"Clavos de acero.","v":[["Libra",28]]},
     {"n":"Cinta métrica","d":"Cinta de acero con freno.","v":[["5 metros",95]]},
     {"n":"Pintura blanca","d":"Pintura de látex para interiores.","v":[["Cuarto de galón",190],["Galón",650]]},
     {"n":"Juego de destornilladores","d":"Puntas planas y de estrella.","v":[["Set de 6 piezas",180]]},
     {"n":"Cemento gris","d":"Cemento de uso general.","v":[["Bolsa 42.5 kg",380]]},
     {"n":"Taladro inalámbrico (borrador)","d":"Pendiente de precio.","v":[["Unidad",1850]],"draft":true}]},
   {"owner":"Elena Castillo","commerce":"Verdulería Los Naranjos","cat":"Verduras y frutas","store":"Los Naranjos - Mercado","addr":"Mercado Oriental, sector de verduras, Managua","phone":"22440909","fee":30,"open":"00:00","close":"23:59","track":true,"products":[
     {"n":"Tomate","d":"Tomate fresco de la zona.","v":[["Libra",14]]},
     {"n":"Cebolla blanca","d":"Cebolla seleccionada.","v":[["Libra",16]]},
     {"n":"Plátano maduro","d":"Para freír o asar.","v":[["Unidad",8],["Manojo de 6",40]]},
     {"n":"Aguacate","d":"Aguacate criollo.","v":[["Unidad",25]]},
     {"n":"Limón","d":"Limón agrio.","v":[["Docena",20]]},
     {"n":"Papa","d":"Papa lavada.","v":[["Libra",18]]}]},
   {"owner":"José Pérez","commerce":"Carnicería Don Pepe","cat":"Carnes","store":"Carnicería Don Pepe","addr":"Barrio San Judas, de la farmacia 1 cuadra abajo, Managua","phone":"22660808","fee":35,"open":"06:00","close":"18:00","track":true,"products":[
     {"n":"Carne molida de res","d":"Molida fresca del día.","v":[["Libra",95]]},
     {"n":"Pollo entero","d":"Pollo fresco sin menudos.","v":[["Unidad",190]]},
     {"n":"Chuleta de cerdo","d":"Chuleta fresca.","v":[["Libra",85]]},
     {"n":"Chorizo criollo","d":"Chorizo artesanal.","v":[["Libra",80]]},
     {"n":"Costilla de cerdo","d":"Costilla para asar.","v":[["Libra",110]]}]},
   {"owner":"Silvia Ramos","commerce":"Librería Papel y Lápiz","ruc":"J0310000099001","cat":"Librería y papelería","store":"Papel y Lápiz","addr":"Frente a la UNAN, Managua","phone":"22780707","fee":35,"open":"08:00","close":"19:00","track":true,"products":[
     {"n":"Cuaderno cosido","d":"100 hojas, rayado.","v":[["100 hojas",35]]},
     {"n":"Lápices de grafito","d":"Caja de lápices HB.","v":[["Docena",60]]},
     {"n":"Resma de papel carta","d":"Papel bond blanco.","v":[["500 hojas",280]]},
     {"n":"Marcadores de colores","d":"Punta media, lavables.","v":[["Set de 12",150]]},
     {"n":"Mochila escolar","d":"Resistente, con dos compartimentos.","v":[["Unidad",450]]},
     {"n":"Calculadora científica (borrador)","d":"Pendiente de precio.","v":[["Unidad",520]],"draft":true}]},
   {"owner":"Daniel Ortiz","commerce":"Veterinaria Patitas","cat":"Mascotas","store":"Patitas - Altamira","addr":"Altamira, del Colegio Alemán 1 cuadra al lago, Managua","phone":"22770606","fee":45,"open":"08:00","close":"18:00","track":true,"products":[
     {"n":"Concentrado para perro adulto","d":"Alimento balanceado.","v":[["4 kg",280],["15 kg",950]]},
     {"n":"Concentrado para gato","d":"Con pollo y pescado.","v":[["1.5 kg",200]]},
     {"n":"Shampoo para mascotas","d":"Hipoalergénico.","v":[["250 ml",110]]},
     {"n":"Collar ajustable","d":"Nylon reforzado.","v":[["Talla M",85],["Talla L",105]]},
     {"n":"Juguete de hueso","d":"Hule resistente.","v":[["Unidad",60]]}]},
   {"owner":"Carmen Solís","commerce":"Comedor Sabor Nica","cat":"Comida preparada","store":"Sabor Nica","addr":"Rotonda Rubén Darío, 2 cuadras al sur, Managua","phone":"22510404","fee":40,"open":"07:00","close":"21:00","track":false,"products":[
     {"n":"Gallo pinto con huevo","d":"Con tajadas y cuajada.","v":[["Plato",90]]},
     {"n":"Nacatamal","d":"Tradicional, con cerdo.","v":[["Unidad",80]]},
     {"n":"Vigorón","d":"Yuca, chicharrón y repollo.","v":[["Plato",85]]},
     {"n":"Fresco de cacao","d":"Bien frío.","v":[["Vaso",30],["Jarra",100]]},
     {"n":"Tajadas con queso","d":"Plátano frito con queso frito.","v":[["Plato",95]]}]},
   {"owner":"Pablo Navarro","commerce":"Café Los Volcanes","cat":"Café y té","store":"Café Los Volcanes","addr":"Plaza Inter, local 12, Managua","phone":"22790303","fee":35,"open":"06:00","close":"20:00","track":false,"products":[
     {"n":"Café americano","d":"Café de altura recién preparado.","v":[["12 oz",40],["16 oz",50]]},
     {"n":"Capuchino","d":"Espresso con leche espumada.","v":[["12 oz",45],["16 oz",60]]},
     {"n":"Muffin de arándano","d":"Horneado en el día.","v":[["Unidad",55]]},
     {"n":"Sándwich de jamón y queso","d":"Pan artesanal.","v":[["Unidad",95]]},
     {"n":"Jugo natural","d":"De temporada.","v":[["16 oz",60]]}]},
   {"owner":"Rosa Aguilar","commerce":"Tienda Hogar Plus","ruc":"J0310000077889","cat":"Hogar y limpieza","store":"Hogar Plus","addr":"Metrocentro, calle de acceso norte, Managua","phone":"22740202","fee":40,"open":"00:00","close":"23:59","track":true,"products":[
     {"n":"Escoba","d":"Cerdas firmes.","v":[["Unidad",70]]},
     {"n":"Detergente en polvo","d":"Para ropa blanca y de color.","v":[["1 kg",85],["3 kg",235]]},
     {"n":"Cloro","d":"Desinfectante.","v":[["Galón",55]]},
     {"n":"Trapeador","d":"Microfibra.","v":[["Unidad",110]]},
     {"n":"Bolsas para basura","d":"Resistentes.","v":[["Rollo de 30",60]]}]}
  ]$json$::jsonb;
begin
  select id into v_admin from auth.users where email = 'admin@demo.rapitrip.test';
  if v_admin is null then raise exception 'Falta admin@demo.rapitrip.test: corre antes flujo_demo.sql'; end if;
  if exists (select 1 from auth.users where email like 'cliente%@demo.rapitrip.test') then
    raise exception 'Estos comercios de demostración ya existen';
  end if;

  for c in select * from jsonb_array_elements(v_data) loop
    k := k + 1;
    v_owner := pg_temp.new_user(format('cliente%s@demo.rapitrip.test', lpad(k::text, 2, '0')), c ->> 'owner');

    -- El cliente pide afiliar su negocio y la administración aprueba.
    perform pg_temp.as_user(v_owner, 'aal1');
    v_req := public.submit_commerce_request(c ->> 'commerce',
      jsonb_build_object('contact_name', c ->> 'owner', 'phone', c ->> 'phone', 'address', c ->> 'addr', 'category', c ->> 'cat',
        'business_kind', case when c ? 'ruc' then 'empresa' else 'informal' end) || case when c ? 'ruc' then jsonb_build_object('ruc', c ->> 'ruc') else '{}'::jsonb end);
    reset role;
    select id into v_cat from commerce.master_items where kind = 'categoria' and lower(name) = lower(c ->> 'cat') limit 1;
    perform pg_temp.as_user(v_admin);
    v_commerce := public.approve_commerce_request(v_req, true);
    if v_cat is null then v_cat := public.create_master_item('categoria', c ->> 'cat'); end if;
    reset role;

    -- El dueño arma su tienda y su catálogo.
    perform pg_temp.as_user(v_owner);
    v_store := public.create_store(v_commerce, c ->> 'store', c ->> 'addr', c ->> 'phone');
    perform public.set_store_location(v_store, 12.136400, -86.251400);
    perform public.set_store_hours(v_store, (select jsonb_agg(jsonb_build_object('weekday', d, 'opens', c ->> 'open', 'closes', c ->> 'close')) from generate_series(0, 6) d));
    perform public.set_store_delivery_fee(v_store, (c ->> 'fee')::numeric);
    i := 0;
    for pr in select * from jsonb_array_elements(c -> 'products') loop
      i := i + 1;
      v_p := public.create_product(v_store, pr ->> 'n', pr ->> 'd', v_cat);
      j := 0;
      for va in select * from jsonb_array_elements(pr -> 'v') loop
        j := j + 1;
        v_v := public.create_variant(v_p, va ->> 0, format('P%s-%s', lpad(i::text, 2, '0'), j), (va ->> 1)::numeric);
        if (c ->> 'track')::boolean then
          v_qty := 5 + floor(random() * 56)::int;
          perform public.set_stock_tracking(v_v, true, 5);
          perform public.count_stock(v_v, v_qty, 'Conteo inicial de la demostración');
        end if;
      end loop;
      if not coalesce((pr ->> 'draft')::boolean, false) then
        perform public.set_product_status(v_p, 'publicado');
      end if;
    end loop;
    reset role;
  end loop;

  -- Ejemplo de afiliación pendiente: pidió afiliarse y espera que la administración revise.
  v_owner := pg_temp.new_user('pendiente@demo.rapitrip.test', 'Fernando López');
  perform pg_temp.as_user(v_owner, 'aal1');
  perform public.submit_commerce_request('Taller Mecánico Hermanos López',
    '{"contact_name":"Fernando López","phone":"+505 8777 3321","address":"Carretera Masaya km 9, frente a la gasolinera","category":"Repuestos y accesorios"}'::jsonb);
  reset role;
end $demo$;

select cm.name as comercio, s.name as tienda, count(distinct p.id) filter (where p.status = 'publicado') as publicados,
       count(distinct p.id) filter (where p.status = 'borrador') as borradores, count(v.id) as variantes
from identity.commerces cm
join commerce.stores s on s.commerce_id = cm.id
left join commerce.products p on p.store_id = s.id
left join commerce.product_variants v on v.product_id = p.id
where cm.name <> 'Pulpería Doña Ana' or true
group by cm.name, s.name order by cm.name;
