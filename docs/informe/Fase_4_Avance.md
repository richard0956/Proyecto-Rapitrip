# Fase 4: cierre

**Estado: cerrada para pasar a la Fase 5**, con tres pendientes del equipo que no bloquean el código: probar el pago con tarjeta en Stripe, correr `pnpm e2e:backend` con Supabase local y la lista de puesta en producción (sección 11 del informe). El mapa queda para otra fase.

Managua, Nicaragua, 18 de octubre de 2026
Rama: `claude/inspiring-galileo-sft8jk` (no toca `main`). Base: `Informe_Fase_4_Tienda_Publica.md`.

## Decisiones aplicadas

D1 a D11 con las recomendaciones del informe. Además, por indicación del equipo: **D4 (libreta de direcciones) y D5 (correos mínimos) entran en la Fase 4**, y el **mapa queda para otra fase** con un espacio reservado (columnas `latitude`/`longitude` ya aceptadas por la base y el esquema, y un bloque «Ubicación en el mapa — próximamente» en el formulario de direcciones, con `data-slot="address-map"`).

## Qué se construyó

| Etapa del informe | Estado | Dónde |
|---|---|---|
| 1. Backend de lectura pública | Escrito, **sin ejecutar contra una base** | `20261101000029_public_catalog.sql`, `290_public_catalog.test.sql`, `010_baseline_guards.test.sql` |
| 2. Catálogo público | Hecho (compila, lint y pruebas de componentes) | `/tiendas`, `/tiendas/[id]`, `/productos/[id]`, portada, `sitemap` dinámico |
| 3. Carrito | Hecho, con pruebas unitarias | `lib/cart.ts`, `cart-store.ts`, `/carrito`, contador en la navegación |
| 3.5 Libreta de direcciones (D4) | Backend escrito sin ejecutar; pantalla hecha | `20261101000031_customer_addresses.sql`, `310_...`, `/perfil/direcciones` |
| 4. Checkout con efectivo | Backend escrito sin ejecutar; pantalla hecha | `20261101000030_order_idempotency.sql`, `300_...`, `/checkout` |
| 5. Pago con tarjeta | Código hecho; **no probado con Stripe** | `startCardPayment`, retorno en `/pedidos/[id]` |
| 6. Mis pedidos y seguimiento | Hecho | `/pedidos`, `/pedidos/[id]` |
| 7. Correos (D5) | Hecho; migración y pruebas ejecutadas en Supabase, plantillas probadas con Deno | `20261101000032_order_emails.sql`, `320_...`, `templates.ts` |
| 8. E2E, accesibilidad y estados de carga/error | Hecho salvo lo listado en «No verificado» | `e2e/tests/tienda-catalogo.spec.ts`, `tienda-pedido.spec.ts`, `loading.tsx`, `error.tsx` |
| Puesta en marcha | **Pendiente (la hace el equipo)** | sección 11 del informe |

## Verificado

- `pnpm -r typecheck` y `pnpm -r lint`: sin errores. `next build` de la tienda: compila.
- `pnpm test`: validación 23, interfaz 25, supabase 14, consola 36, tienda 64 pruebas. `deno test supabase/functions`: 25 pruebas.
- **Base de datos real** (proyecto Supabase "Rapitrip", `zhbupsxupwrlsklrbdvd`): las migraciones 1 a 32 se aplicaron y **todas las suites pgTAP pasan** (de la 010 a la 320, incluidas las cuatro nuevas de esta fase). Antes de aplicar, los datos de la app móvil se movieron al esquema `mobile_backup` (33 tablas, 1.672 filas, 43 funciones; comparadas por hash de cada tabla). El chequeo de seguridad de Supabase solo marca lo esperado: únicamente `anon` ejecuta las 6 funciones del catálogo público.
- **Accesibilidad (axe, WCAG 2.2 AA)** en escritorio y móvil sobre tiendas, tienda, producto y carrito vacío, más las pantallas públicas anteriores: 37 pruebas Playwright pasan.
- **Flujo sin sesión**: de `/tiendas` a la tienda, al producto, agregar al carrito, cambiar cantidad, recargar y conservar el carrito, y «Pagar» lleva a ingresar con `next=/checkout`. Corre contra un Supabase de mentira (`e2e/support/catalog-mock.mjs`) que levanta `playwright.config.ts` cuando no hay Supabase local.
- Estados de carga (`loading.tsx`) y de error (`error.tsx`, con «Reintentar») para las páginas de la tienda. Efecto conocido: con el estado de carga la respuesta va en streaming, así que una tienda inexistente responde HTTP 200 con la página «No encontramos esa página» y `noindex`.

## No verificado (y por qué)

- `e2e/tests/tienda-pedido.spec.ts` (compra en efectivo, pedido, cancelación y regreso del stock) está escrito y tipado, pero **no se ejecutó**: necesita Supabase local o la llave `service_role`, y este entorno no pudo levantar Docker. Se corre con `pnpm e2e:backend` en una base con las migraciones 1 a 32.
- El pago con tarjeta no se probó con Stripe (requiere claves de prueba y `STORE_URL` exacta).
- Los tipos de `packages/db-types` se editaron a mano; coinciden con los que genera el servidor para las funciones y vistas nuevas, pero conviene regenerarlos con `pnpm db:types` (el CI comprueba que no haya diferencias).
- Las migraciones 14, 15, 19, 21, 25 y 31 se aplicaron al proyecto con los `DELETE` reescritos como CTE por una limitación de la herramienta de SQL remota. Los archivos del repositorio no cambian y siguen siendo la referencia.
- Quedan en el proyecto Supabase el esquema auxiliar `tests` (con el acceso revocado) y la extensión `pgtap`; hay que borrarlos desde el editor SQL. También falta activar `custom_access_token_hook` en los ajustes de Auth.

## Decisiones de diseño a revisar

- `quote_cart` acepta un `seen_price` opcional por línea para poder avisar «el precio cambió» (el informe pide ese aviso pero también que el carrito no guarde precios). El navegador guarda solo el último precio visto, para avisar; nunca se cobra.
- Se agregó `catalog_store(p_store)` (horario de la tienda), que el informe no listaba, para la cabecera de `/tiendas/[id]`.
- El pago con tarjeta se inicia desde una acción de servidor (no desde el navegador), así la restricción de origen de `stripe-checkout` no depende del navegador.
- Con tarjeta, el carrito se vacía al crear el pedido (ya reservó el stock); «Repetir pedido» lo vuelve a armar.

## Pendiente fuera de esta fase (como se acordó)

Mapa y coordenadas en las direcciones. Y la lista de puesta en marcha de la sección 11 del informe (legal, Stripe en producción, dominios, límite de tasa, etc.).
