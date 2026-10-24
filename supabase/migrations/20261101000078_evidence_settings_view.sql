-- Repartidor, etapa 8: las pantallas leen las reglas de evidencia por una vista de `public` (PostgREST solo expone ese esquema).
-- La tabla ya limita la lectura a las consolas de operación (`private.is_ops_console()`), y la vista respeta esa política.
create view public.evidence_settings_list with (security_invoker = true) as
  select require_pickup_photo, require_delivery_photo, require_pickup_code, require_delivery_code, alert_distance_m, retention_days, updated_at
  from sales.evidence_settings;
revoke all on public.evidence_settings_list from public, anon;
grant select on public.evidence_settings_list to authenticated;
