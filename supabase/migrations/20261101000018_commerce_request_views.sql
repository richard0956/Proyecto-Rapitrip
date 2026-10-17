-- Solicitudes de comercio: lo que la consola necesitaba ver y lo que el cliente necesitaba saber.

-- La consola muestra los datos que el solicitante envió (representante, teléfono, dirección, categoría).
-- La columna nueva va al final: `create or replace view` no permite reordenar las existentes. Sigue limitada a administradores por RLS.
create or replace view public.commerce_requests_list with (security_invoker = true) as
  select id, requester_id, business_name, status, decision_reason, created_at, reviewed_at, commerce_id, details
  from identity.commerce_requests;

-- El cliente consulta el estado de sus propias solicitudes (con sesión de menos de un día, como el resto de vistas propias).
-- No expone `details`: el cliente ya conoce lo que escribió y la vista no necesita devolverlo.
create view public.my_commerce_requests with (security_invoker = true) as
  select id, business_name, status, decision_reason, created_at, reviewed_at
  from identity.commerce_requests
  where requester_id = auth.uid() and private.has_valid_session();

revoke all on public.my_commerce_requests from public, anon;
grant select on public.my_commerce_requests to authenticated;
