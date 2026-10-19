# Referencia del backend de Rapitrip

> **Estado de este documento.** La especificación y el plan originales del backend (`docs/superpowers/specs/2026-10-10-fundacion-backend-design.md` y `docs/superpowers/plans/2026-10-11-fundacion-backend.md`) se perdieron al reemplazar la carpeta del proyecto. Este documento los reemplaza como **referencia técnica**: se reconstruyó el 17 de octubre de 2026 a partir de las migraciones 1 a 28, de la base de datos viva y de `docs/informe/Informe_Backend_Rapitrip.md`. Describe lo que existe, no lo que se planeó; ante una diferencia, manda el código.

## 1. Principios

- **La base de datos decide.** Cada tabla tiene RLS activo y ninguna se escribe directamente desde las apps: las escrituras pasan por funciones `security definer` con `search_path` fijo, y las lecturas por vistas `security_invoker` en `public`. Solo `public` se expone por la API.
- **Sesión de consola.** Las acciones del personal y de los comercios exigen contraseña, segundo factor (aal2) y actividad en los últimos 15 minutos (`private.has_strong_session`, alimentada por `touch_session`). Los clientes usan una sesión de hasta 24 horas.
- **Auditoría sin datos personales.** `private.write_audit` rechaza claves como email, teléfono o token en los datos que guarda; se registran ids, campos cambiados y el motivo.
- **Nada se borra por la interfaz.** Los estados (`activo`, `suspendido`, `inactiva`, `archivado`…) reemplazan al borrado; la única eliminación es la anonimización de cuentas inactivas (12 meses).
- **Motivo obligatorio** (mínimo 5 caracteres) en las acciones que suspenden, desactivan, archivan o ajustan inventario.
- **Errores con código.** Las funciones lanzan `42501` (sin permiso o sin sesión de consola), `22023` (dato inválido), `P0002` (no existe) y `23505` (duplicado); las apps muestran el mensaje solo con esos códigos.

## 2. Esquemas

| Esquema | Contenido |
|---|---|
| `identity` | Cuentas, datos personales, roles, comercios, solicitudes, invitaciones y repartidores |
| `audit` | Eventos de auditoría, inicios de sesión e incidentes de TI |
| `commerce` | Tiendas, horarios, catálogo maestro, productos, variantes, imágenes e inventario (Fase 2) |
| `sales` | Pedidos (web y de mostrador), renglones, historial de estados, datos de entrega, eventos de pago de Stripe y turnos de caja (Fase 3) |
| `private` | Funciones internas, bandeja de correos, actividad de sesión y matriz de gestión de roles |
| `public` | Única superficie expuesta: funciones (RPC) y vistas |

## 3. Roles

`superadmin` (Director), `admin`, `cajero`, `coordinador`, `comercio` y `cliente` (`identity.app_role`). El rol `comercio` está ligado a un comercio (`commerce_id`) y a una sola cuenta activa por comercio. `superadmin` solo se otorga por código (`bootstrap_superadmin`). Quién gestiona a quién está en `private.role_management`: el director gestiona a todos los demás; el administrador, a cajero, coordinador, comercio y cliente. Un comercio suspendido (`identity.commerces.status`) deja a su cuenta sin rol efectivo.

Permisos por área de la consola: `admin` y `superadmin` → `/admin`; `cajero` → `/caja`; `coordinador` → `/coordinacion`; `comercio` → `/comercio`; `cliente` → solo la tienda.

## 4. Tablas

| Tabla | Columnas | Políticas RLS |
|---|---|---|
| `audit.events` | id, occurred_at, actor_id, actor_role, action, target_type, target_id, before_data, after_data, reason, device, metadata | 0 |
| `audit.it_incidents` | id, type, origin, severity, description, status, resolution, reported_by, handled_by, metadata, created_at, updated_at, resolved_at | 1 |
| `audit.login_events` | id, source_audit_id, user_id, occurred_at, result, provider, ip_address, user_agent | 1 |
| `commerce.inventory` | variant_id, store_id, track_stock, quantity, low_stock_threshold, updated_at | 2 |
| `commerce.master_items` | id, kind, name, parent_id, status, created_by, created_at, updated_at | 2 |
| `commerce.product_images` | id, product_id, path, position, created_at | 2 |
| `commerce.product_variants` | id, product_id, store_id, name, sku, price, status, created_at, updated_at | 2 |
| `commerce.products` | id, store_id, name, description, category_id, brand_id, product_type_id, status, created_by, created_at, updated_at | 2 |
| `commerce.stock_movements` | id, variant_id, store_id, kind, delta, quantity_after, reason, created_by, created_at | 2 |
| `commerce.store_exceptions` | id, store_id, on_date, closed, opens, closes, note | 2 |
| `commerce.store_hours` | id, store_id, weekday, opens, closes | 2 |
| `commerce.stores` | id, commerce_id, name, address, contact_phone, status, closed_until, closed_reason, created_by, created_at, updated_at, delivery_fee | 2 |
| `identity.commerce_requests` | id, requester_id, business_name, details, status, decision_reason, reviewed_by, reviewed_at, commerce_id, created_at | 2 |
| `identity.commerces` | id, name, status, created_at | 2 |
| `identity.couriers` | id, full_name, phone, vehicle_type, document_path, status, user_id, created_by, created_at, updated_at | 1 |
| `identity.invitations` | id, email, role, invited_by, token_hash, status, expires_at, created_at, accepted_at, accepted_by | 1 |
| `identity.profile_pii` | user_id, full_name, email, phone, updated_at | 2 |
| `identity.profiles` | id, status, created_at, last_sign_in_at, anonymization_candidate_since, anonymized_at, anonymized_by | 2 |
| `identity.user_roles` | id, user_id, role, commerce_id, status, granted_by, granted_at, status_reason, status_changed_at, status_changed_by | 2 |
| `private.email_outbox` | id, to_email, template, data, status, attempts, last_error, claimed_at, created_at, sent_at | 0 |
| `private.role_management` | manager, target | 0 |
| `private.session_activity` | session_id, user_id, last_activity_at | 0 |
| `sales.cash_sessions` | id, cashier_id, opened_at, opening_amount, closed_at, expected_amount, counted_amount, difference, note | 2 |
| `sales.order_delivery` | order_id, address, phone, notes | 2 |
| `sales.order_events` | id, order_id, from_status, to_status, reason, actor_id, created_at | 1 |
| `sales.order_items` | id, order_id, variant_id, product_name, variant_name, sku, unit_price, quantity, line_total, stock_reserved | 1 |
| `sales.orders` | id, number, client_id, store_id, commerce_id, store_name, status, payment_method, payment_status, subtotal, delivery_fee, total, courier_id, status_reason, expires_at, created_at, updated_at, confirmed_at, delivered_at, payment_session_id, payment_intent_id, payment_amount, payment_currency, refund_id, channel, cashier_id, cash_session_id | 4 |
| `sales.payment_events` | event_id, event_type, order_id, outcome, received_at, updated_at | 1 |

Las políticas de lectura se limitan a: la propia fila (cliente o comercio), el alcance del comercio (`private.has_role('comercio', id)`) o la administración con sesión de consola (`private.is_admin_console()`). `audit.events` no tiene política: solo se lee por `audit_events_page`.

## 5. Funciones públicas (RPC)

**Tiendas**

- `close_store_temporarily(p_store uuid, p_until timestamp with time zone, p_reason text)`
- `create_store(p_commerce uuid, p_name text, p_address text, p_phone text)`
- `delete_store_exception(p_store uuid, p_date date)`
- `reopen_store(p_store uuid)`
- `set_store_delivery_fee(p_store uuid, p_fee numeric)`
- `set_store_exception(p_store uuid, p_date date, p_closed boolean, p_opens time without time zone, p_closes time without time zone, p_note text)`
- `set_store_hours(p_store uuid, p_hours jsonb)`
- `set_store_status(p_store uuid, p_status text, p_reason text)`
- `update_store(p_store uuid, p_name text, p_address text, p_phone text)`

**Catálogo y productos**

- `add_product_image(p_product uuid, p_path text)`
- `create_master_item(p_kind text, p_name text, p_parent uuid)`
- `create_product(p_store uuid, p_name text, p_description text, p_category uuid, p_brand uuid, p_type uuid)`
- `create_variant(p_product uuid, p_name text, p_sku text, p_price numeric)`
- `remove_product_image(p_image uuid)`
- `rename_master_item(p_id uuid, p_name text)`
- `set_master_item_status(p_id uuid, p_status text, p_reason text)`
- `set_product_status(p_product uuid, p_status text, p_reason text)`
- `set_variant_status(p_variant uuid, p_status text)`
- `update_product(p_product uuid, p_name text, p_description text, p_category uuid, p_brand uuid, p_type uuid)`
- `update_variant(p_variant uuid, p_name text, p_sku text, p_price numeric)`

**Inventario**

- `add_stock(p_variant uuid, p_amount integer, p_reason text)`
- `count_stock(p_variant uuid, p_quantity integer, p_reason text)`
- `remove_stock(p_variant uuid, p_amount integer, p_reason text)`
- `set_stock_tracking(p_variant uuid, p_track boolean, p_threshold integer)`

**Pedidos y pagos**

- `apply_stripe_event(p_event_id text, p_type text, p_order uuid, p_session text, p_intent text, p_amount bigint, p_currency text, p_paid boolean)`
- `assign_order_courier(p_order uuid, p_courier uuid)`
- `claim_pending_refunds(p_limit integer)`
- `create_order(p_store uuid, p_items jsonb, p_payment_method text, p_address text, p_phone text, p_notes text)`
- `mark_order_paid(p_order uuid)`
- `mark_order_refunded(p_order uuid, p_refund text)`
- `record_order_checkout_session(p_order uuid, p_session text, p_currency text)`
- `set_order_status(p_order uuid, p_to text, p_reason text)`
- `set_payment_event_outcome(p_event_id text, p_outcome text)`

**Caja y venta de mostrador**

- `close_cash_session(p_counted numeric, p_note text)`
- `counter_catalog()`
- `create_counter_sale(p_store uuid, p_items jsonb, p_payment_method text)`
- `open_cash_session(p_opening numeric)`
- `void_counter_sale(p_order uuid, p_reason text)`

**Comercios y solicitudes**

- `approve_commerce_request(p_request uuid, p_convenio_confirmed boolean)`
- `reject_commerce_request(p_request uuid, p_reason text)`
- `set_commerce_status(p_commerce uuid, p_status text, p_reason text)`
- `submit_commerce_request(p_business_name text, p_details jsonb)`

**Auditoría**

- `audit_events_page(p_action text, p_actor uuid, p_target_type text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_before bigint)`
- `audit_script_action(p_action text, p_target uuid, p_reason text)`

**Identidad, roles y cuenta**

- `begin_accept_invitation(p_token_hash text)`
- `bootstrap_superadmin(p_user uuid)`
- `cancel_invitation(p_id uuid)`
- `confirm_anonymization(p_user uuid, p_reason text, p_holder_request boolean)`
- `create_courier(p_full_name text, p_phone text, p_vehicle_type text, p_document_path text)`
- `create_invitation(p_email text, p_role identity.app_role, p_token_hash text)`
- `export_dataset(p_dataset text, p_reason text, p_from timestamp with time zone, p_to timestamp with time zone)`
- `finish_accept_invitation(p_token_hash text, p_user uuid)`
- `get_client_detail(p_user uuid)`
- `list_anonymization_candidates()`
- `login_events_page(p_user uuid, p_result text, p_from timestamp with time zone, p_to timestamp with time zone, p_limit integer, p_before bigint)`
- `reactivate_role(p_user uuid, p_role identity.app_role, p_reason text)`
- `read_courier_document(p_id uuid)`
- `report_incident(p_type audit.incident_type, p_severity audit.incident_severity, p_description text)`
- `reset_mfa(p_target uuid, p_reason text)`
- `revoke_role(p_user uuid, p_role identity.app_role, p_reason text)`
- `set_courier_status(p_id uuid, p_status text, p_reason text)`
- `set_incident_status(p_id uuid, p_status audit.incident_status, p_resolution text)`
- `suspend_role(p_user uuid, p_role identity.app_role, p_reason text)`
- `touch_session()`
- `update_courier(p_id uuid, p_full_name text, p_phone text, p_vehicle_type text, p_document_path text)`
- `update_my_profile(p_full_name text, p_phone text)`

**Otras**

- `claim_outbox(p_limit integer)`
- `lookup_auth_user(p_email text)`
- `mark_outbox(p_id uuid, p_ok boolean, p_error text)`

## 6. Vistas (lectura para las apps)

`accounts_staff`, `cash_sessions_list`, `commerce_requests_list`, `commerces_list`, `couriers_list`, `inventory_list`, `invitations_list`, `it_incidents_list`, `master_items_list`, `my_commerce_requests`, `my_profile`, `my_roles`, `order_delivery_list`, `order_events_list`, `order_items_list`, `orders_list`, `payment_events_list`, `product_images_list`, `product_variants_list`, `products_list`, `stock_movements_list`, `store_exceptions_list`, `store_hours_list`, `stores_list`.

Todas son `security_invoker`: respetan las políticas RLS de quien consulta. `stores_list` calcula `open_now` (hora de Nicaragua, `America/Managua`) e `inventory_list` calcula `stock_state` y `available`.

## 7. Funciones de borde (`supabase/functions`)

- `accept-invitation`: acepta una invitación y crea el acceso del personal.
- `invite-staff`: crea invitaciones y encola el correo.
- `courier-document-url`: enlace firmado de 60 segundos al documento de un repartidor (lectura auditada).
- `export-data`: exportación cifrada de datos, con motivo.
- `purge-exports`: elimina exportaciones vencidas.
- `send-outbox`: envía los correos encolados (con `MAIL_MODE=log` solo los imprime).
- `stripe-checkout`: crea la sesión de pago de Stripe de un pedido propio (el navegador solo envía el id; el monto sale de la base de datos).
- `stripe-webhook`: recibe los eventos de Stripe (`checkout.session.completed` y `checkout.session.expired`), verifica la firma y aplica el resultado; reembolsa pagos tardíos, dobles o de otro monto. Sin verificación JWT.
- `process-refunds`: reembolsa en Stripe los pedidos pagados con tarjeta que se cancelaron o rechazaron; lo dispara un programador con `x-outbox-secret`.

## 8. Almacenamiento

- `courier-documents` (privado): documentos de identidad de repartidores; sube la administración.
- `product-images` (público, 2 MB, JPEG/PNG/WebP): imágenes de productos bajo la ruta `<tienda>/<producto>/<archivo>`; escribe el comercio dueño de la tienda o la administración, con sesión de consola.

## 9. Migraciones

- `20261101000001_baseline.sql`
- `20261101000002_identity_tables.sql`
- `20261101000003_audit_core.sql`
- `20261101000004_security_functions.sql`
- `20261101000005_rls_and_views.sql`
- `20261101000006_role_management.sql`
- `20261101000007_profile_rpc.sql`
- `20261101000008_email_outbox.sql`
- `20261101000009_invitations.sql`
- `20261101000010_commerce_requests.sql`
- `20261101000011_couriers_and_sensitive_reads.sql`
- `20261101000012_access_token_hook.sql`
- `20261101000013_incidents_and_login_events.sql`
- `20261101000014_anonymization.sql`
- `20261101000015_mfa_reset_and_export.sql`
- `20261101000016_client_session_timebox.sql`
- `20261101000017_admin_reads.sql`
- `20261101000018_commerce_request_views.sql`
- `20261101000019_stores.sql`
- `20261101000020_master_catalog.sql`
- `20261101000021_products.sql`
- `20261101000022_inventory.sql`
- `20261101000023_commerce_status.sql`
- `20261101000024_store_timezone_nicaragua.sql`
- `20261101000025_orders.sql`
- `20261101000026_stripe_payments.sql`
- `20261101000027_counter_sales.sql`
- `20261101000028_payment_events_admin.sql`
- `20261101000029_public_catalog.sql` (Fase 4: lectura pública del catálogo)
- `20261101000030_order_idempotency.sql` (Fase 4: `create_order` con `p_client_ref`)
- `20261101000031_customer_addresses.sql` (Fase 4: libreta de direcciones)
- `20261101000032_order_emails.sql` (Fase 4: correos «pedido recibido» y «pedido cancelado»)

## 10. Pruebas

Suite pgTAP en `supabase/tests/database` (se corre con `pnpm db:test`; hacer `pnpm db:reset` antes si la base local tiene datos propios) y pruebas de Edge Functions con `pnpm fn:test`. Archivos: `000_smoke.test.sql`, `010_baseline_guards.test.sql`, `020_identity.test.sql`, `030_audit.test.sql`, `040_security_functions.test.sql`, `050_permissions_matrix.test.sql`, `060_role_management.test.sql`, `070_profile.test.sql`, `080_outbox.test.sql`, `090_invitations.test.sql`, `100_commerce_requests.test.sql`, `110_couriers_and_sensitive_reads.test.sql`, `120_access_token_hook.test.sql`, `130_incidents_and_login_events.test.sql`, `140_anonymization.test.sql`, `150_mfa_reset_and_export.test.sql`, `160_client_session.test.sql`, `170_admin_reads.test.sql`, `180_commerce_request_views.test.sql`, `190_stores.test.sql`, `200_master_catalog.test.sql`, `210_products.test.sql`, `220_inventory.test.sql`, `230_commerce_status.test.sql`, `250_orders.test.sql`, `260_stripe_payments.test.sql`, `270_counter_sales.test.sql`, `280_payment_events_admin.test.sql`, `290_public_catalog.test.sql`, `300_order_idempotency.test.sql`, `310_customer_addresses.test.sql`, `320_order_emails.test.sql`.


## 11. Fase 4: tienda pública

**Superficie pública (`anon` y `authenticated`)**, y la única: `catalog_stores`, `catalog_store`, `catalog_categories`, `catalog_products`, `catalog_product` y `quote_cart`. Son de solo lectura, `security definer`, con paginación y topes (48 por página). Nunca devuelven SKU, existencias exactas (solo el máximo comprable, hasta 99, y solo con control de stock), teléfonos ni datos de cuentas. Una tienda cerrada por horario se ve (con motivo y horario); una inactiva, o de un comercio suspendido, no. Los productos agotados se ocultan de los listados y se muestran como «no disponible» en su ficha. La prueba `010` exige que esta sea exactamente la lista de funciones ejecutables por `anon`.

**`quote_cart(p_store, p_items)`**: `p_items` es `[{variant_id, quantity, seen_price?}]`. Devuelve líneas, totales y `problems` con códigos estables: `tienda_no_disponible`, `tienda_cerrada`, `producto_no_disponible`, `sin_stock`, `precio_cambiado`, `cantidad_invalida`. `seen_price` solo sirve para avisar del cambio; el cobro lo decide `create_order` con el precio vigente.

**`create_order(..., p_client_ref uuid default null)`**: con referencia, un reintento del mismo cliente devuelve el pedido ya creado (índice único `(client_id, client_ref)` y bloqueo de asesoría por cliente). El cuerpo anterior pasó intacto a `private.create_order_core`.

**Libreta de direcciones** (`sales.customer_addresses`, vista `my_addresses`): `save_address`, `set_default_address`, `delete_address`. Hasta 10 por cliente, una predeterminada, nombre único por cliente. Se borra al anonimizar la cuenta. `latitude` y `longitude` están reservadas para el mapa y ninguna pantalla las llena todavía.

**Correos del pedido**: el trigger `enqueue_order_email_after_event` encola `order_received` (el pedido queda «por confirmar») y `order_cancelled` (cancelado o rechazado, con motivo) en la bandeja existente. `send-outbox` agrega `store_url` (variable `STORE_URL`) para el enlace al pedido.
