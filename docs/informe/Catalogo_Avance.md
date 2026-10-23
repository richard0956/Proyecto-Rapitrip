# Catálogo de productos y tipo de vendedor: avance

Managua, Nicaragua, 19 de octubre de 2026
Rama: `claude/catalogo-productos` (sale de `claude/flujo-demo`, que sale de `main`).

## Qué cambia

1. **Catálogo de productos** en `/catalogo`: todos los productos de todas las tiendas, no solo la lista de tiendas.
   - **Tarjetas nuevas:** foto grande con esquinas redondeadas y etiquetas encima (categoría, «Empresa», «Pocas unidades»); tienda con un punto verde si está abierta; nombre; cantidad de presentaciones; precio («Desde» si hay varias presentaciones); y un botón redondo para agregar al carrito. Con una sola presentación el botón agrega 1 unidad de inmediato; con varias, la tarjeta lleva a la ficha para elegir. Sin foto se muestra la inicial del producto sobre un degradado.
   - **Barra de filtros** (columna lateral en pantallas anchas, botón «Filtros» desplegable en móvil): búsqueda, categorías con su cantidad, tienda, rango de precio, tipo de vendedor y «solo tiendas abiertas». Orden por nombre, precio o más recientes. Los filtros activos se ven como chips que se pueden quitar. Cada combinación tiene su propia dirección (se puede compartir) y funciona sin JavaScript.
   - La página de cada tienda usa la misma barra y las mismas tarjetas. `/tiendas` también filtra (nombre, categoría, tipo de vendedor, abiertas) y la portada muestra «Novedades del catálogo».
2. **Tipo de vendedor.** Al pedir afiliarse (`/vende`) se elige entre *vendedor propio o informal* (lo de siempre) y *empresa o negocio formal*; las empresas indican su **RUC** (8 a 20 letras o números; se normaliza sin espacios ni guiones y en mayúsculas). Al aprobar, el comercio nace con su tipo y su RUC. El RUC es único por comercio y solo lo ve la administración (`/admin/solicitudes`, `/admin/comercios`); el público ve solo la insignia «Empresa».

## Base de datos (migraciones 33 y 34)

- `20261101000033_commerce_kind.sql`: `identity.commerces.kind` y `ruc` (con restricciones), `submit_commerce_request` y `approve_commerce_request` actualizadas, `commerces_list` con tipo y RUC.
- `20261101000034_catalog_filters.sql`: funciones públicas nuevas `catalog_search_products` y `catalog_search_stores` (las anteriores no cambian) y `catalog_product` con marca y tipo de comercio. Siguen sin devolver SKU, existencias exactas ni RUC.

## Verificado

- Migraciones 33 y 34 aplicadas al proyecto Supabase; prueba pgTAP nueva `330_commerce_kind_and_catalog_search.test.sql` (18 de 18) corrida allí en una transacción que se revierte, sin dejar rastro. La prueba de guardas `010` se actualizó con las dos funciones públicas nuevas (no se corrió de nuevo).
- Tienda: typecheck, lint y 76 pruebas unitarias. Consola: typecheck, lint y 36 pruebas. E2E (Playwright con un Supabase de mentira): 54 pruebas, incluidas 9 de filtros, el botón de agregar, el aviso de otra tienda y accesibilidad (axe, WCAG 2.2 AA) del catálogo en escritorio y móvil.

## No verificado

- `next build` no se pudo correr en este entorno (no descarga las fuentes de Google). Typecheck, lint y las pruebas sí pasan.
- Las demás suites pgTAP no se volvieron a correr tras las migraciones 33 y 34; los cambios no tocan funciones que ellas usen, salvo `010`.
- El formulario de afiliación con RUC se probó a nivel de componente y de base de datos, no con un inicio de sesión real.
- Los tipos de `packages/db-types` se editaron a mano; conviene regenerarlos con `pnpm db:types`.

## Pendiente

- El catálogo maestro sigue sin marcas cargadas, así que el filtro por marca no existe aún (la marca se muestra si el producto la tiene).
- Fotos de productos reales (hoy se ve la inicial).
