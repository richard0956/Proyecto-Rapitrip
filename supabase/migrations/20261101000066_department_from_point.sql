-- Entregas express y programadas: el departamento de entrega sale del punto marcado en el mapa; el cliente ya no lo elige.
-- `public.department_for_point(lat, lng)` devuelve el departamento cuyo punto de referencia (cabeceras y ciudades principales)
-- queda más cerca del pin. Es una aproximación: sin polígonos de límites, un pin pegado a la frontera entre dos departamentos
-- puede caer en el vecino. Si la operación carga los polígonos oficiales, solo hay que cambiar esta función.

create table sales.department_anchors (
  department text not null references sales.departments (code),
  name text not null,
  latitude numeric(9, 6) not null,
  longitude numeric(9, 6) not null,
  primary key (department, name),
  check (private.valid_ni_point(latitude, longitude))
);
alter table sales.department_anchors enable row level security;
create policy department_anchors_select_ops on sales.department_anchors for select to authenticated using (private.is_ops_console());
grant select on sales.department_anchors to authenticated;

insert into sales.department_anchors (department, name, latitude, longitude) values
  ('boaco', 'Boaco', 12.470, -85.660), ('boaco', 'Camoapa', 12.388, -85.513), ('boaco', 'Teustepe', 12.417, -85.796),
  ('carazo', 'Jinotepe', 11.850, -86.200), ('carazo', 'Diriamba', 11.857, -86.240), ('carazo', 'San Marcos', 11.906, -86.202),
  ('chinandega', 'Chinandega', 12.629, -87.131), ('chinandega', 'Corinto', 12.483, -87.173), ('chinandega', 'El Viejo', 12.661, -87.165), ('chinandega', 'Somotillo', 13.040, -86.904),
  ('chontales', 'Juigalpa', 12.106, -85.364), ('chontales', 'Acoyapa', 11.974, -85.175), ('chontales', 'Santo Tomás', 12.068, -85.085), ('chontales', 'La Libertad', 12.218, -85.171),
  ('esteli', 'Estelí', 13.091, -86.354), ('esteli', 'Condega', 13.345, -86.407), ('esteli', 'Pueblo Nuevo', 13.372, -86.489), ('esteli', 'La Trinidad', 12.974, -86.220),
  ('granada', 'Granada', 11.930, -85.956), ('granada', 'Nandaime', 11.760, -86.050), ('granada', 'Diriomo', 11.882, -86.045),
  ('jinotega', 'Jinotega', 13.091, -86.001), ('jinotega', 'San Rafael del Norte', 13.206, -86.110), ('jinotega', 'Wiwilí', 13.623, -85.820), ('jinotega', 'El Cuá', 13.392, -85.690),
  ('leon', 'León', 12.438, -86.878), ('leon', 'Nagarote', 12.263, -86.570), ('leon', 'La Paz Centro', 12.322, -86.674), ('leon', 'Telica', 12.530, -86.870),
  ('madriz', 'Somoto', 13.479, -86.584), ('madriz', 'Palacagüina', 13.442, -86.426), ('madriz', 'Totogalpa', 13.560, -86.490),
  ('managua', 'Managua', 12.136, -86.251), ('managua', 'Ciudad Sandino', 12.160, -86.350), ('managua', 'Tipitapa', 12.196, -86.095), ('managua', 'Ticuantepe', 11.940, -86.200),
  ('managua', 'Mateare', 12.233, -86.430), ('managua', 'San Rafael del Sur', 11.847, -86.438), ('managua', 'Villa El Carmen', 11.970, -86.340),
  ('masaya', 'Masaya', 11.974, -86.094), ('masaya', 'Nindirí', 12.010, -86.100), ('masaya', 'Catarina', 11.918, -86.064), ('masaya', 'Tisma', 12.085, -85.970),
  ('matagalpa', 'Matagalpa', 12.930, -85.918), ('matagalpa', 'Sébaco', 12.847, -86.097), ('matagalpa', 'Ciudad Darío', 12.730, -86.125), ('matagalpa', 'Rancho Grande', 13.230, -85.560),
  ('matagalpa', 'Matiguás', 12.840, -85.456), ('matagalpa', 'Río Blanco', 12.939, -85.213),
  ('nueva_segovia', 'Ocotal', 13.630, -86.480), ('nueva_segovia', 'Jalapa', 13.920, -86.125), ('nueva_segovia', 'Quilalí', 13.643, -86.031), ('nueva_segovia', 'Mozonte', 13.690, -86.410),
  ('rio_san_juan', 'San Carlos', 11.123, -84.775), ('rio_san_juan', 'El Castillo', 11.007, -84.398), ('rio_san_juan', 'San Miguelito', 11.400, -84.900),
  ('rivas', 'Rivas', 11.437, -85.828), ('rivas', 'Tola', 11.430, -86.060), ('rivas', 'Belén', 11.518, -86.000), ('rivas', 'Moyogalpa', 11.538, -85.686),
  ('raccn', 'Puerto Cabezas', 14.039, -83.387), ('raccn', 'Siuna', 13.728, -84.779), ('raccn', 'Rosita', 13.917, -84.400), ('raccn', 'Waspam', 14.736, -83.971), ('raccn', 'Bonanza', 13.957, -84.580),
  ('raccs', 'Bluefields', 12.013, -83.764), ('raccs', 'Nueva Guinea', 11.687, -84.453), ('raccs', 'El Rama', 12.163, -84.254), ('raccs', 'Corn Island', 12.170, -83.040), ('raccs', 'Laguna de Perlas', 12.343, -83.670);

create or replace function public.department_for_point(p_latitude numeric, p_longitude numeric)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_department text;
begin
  perform private.require_valid_session();
  if p_latitude is null or p_longitude is null or not private.valid_ni_point(p_latitude, p_longitude) then
    return null;
  end if;
  -- Un grado de longitud mide menos que uno de latitud en Nicaragua (cos 12° ≈ 0,98); no hace falta corregirlo para esta aproximación.
  select department into v_department
    from sales.department_anchors
   order by power(latitude - p_latitude, 2) + power(longitude - p_longitude, 2)
   limit 1;
  return v_department;
end $$;

revoke all on function public.department_for_point(numeric, numeric) from public, anon, authenticated;
grant execute on function public.department_for_point(numeric, numeric) to authenticated;
