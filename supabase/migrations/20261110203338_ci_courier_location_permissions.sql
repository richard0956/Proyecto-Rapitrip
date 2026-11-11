-- couriers_list es security_invoker: además de RLS, necesita permisos sobre cada columna que proyecta.
-- La migración de ubicación agregó estas columnas a la vista, pero omitió conceder su lectura.
grant select (latitude, longitude, location_updated_at) on identity.couriers to authenticated;
