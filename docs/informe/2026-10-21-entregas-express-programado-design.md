# Entregas express y programadas, y compra con varias tiendas

Fecha de diseño: 21 de octubre de 2026
Estado: diseño acordado, sin código escrito. Falta la luz verde para empezar por la etapa 1.
Alcance: clasificación de productos en express y programado, repartidores por tipo de vehículo, y carrito y checkout con varias tiendas dividido en varios pedidos.
Documentos relacionados: `docs/backend-referencia.md`, `docs/informe/Informe_Fase_4_Tienda_Publica.md`.

## 1. Intención

Hoy una compra es de una sola tienda (decisión D1): un carrito, un pedido, un envío y un pago de Stripe. Se quiere:

1. Que cada producto se catalogue como **express** (pequeño, en horas, repartidor en moto) o **programado** (grande o con validación, en días o semanas, repartidor con carro o camión).
2. Que el cliente pueda comprar a **varias tiendas** en una sola compra, y que el sistema la divida en pedidos.

La clase **final** la decide el pedido, no solo el producto: el producto dice si *puede* ser express (por tamaño, peso y validación), y el destino del cliente confirma si de verdad lo es. Como la tienda opera a nivel nacional, un pedido a otro departamento o a más de 20 km nunca es express, aunque el producto sea pequeño. El comercio declara la elegibilidad con criterios visibles y el sistema bloquea lo que no cabe en una moto.

## 2. Decisiones acordadas

| # | Decisión | Resultado |
|---|---|---|
| 1 | Pago con tarjeta | Una sola sesión de Stripe para toda la compra |
| 2 | Fallos al crear la compra | Todo o nada; cada tienda se valida antes, al cotizar |
| 3 | Envío | Se cobra el envío completo por cada pedido |
| 4 | Tope de tiendas | 4 por compra |
| 5 | Clave de división | Tienda × clase de entrega (express / programado) |
| 6 | Repartidores | Express solo `moto`; programado solo `vehiculo` |
| 7 | Quién clasifica el producto | El comercio declara si *puede* ser express, con criterios visibles; la administración limita y reclasifica |
| 8 | Quién decide la clase del pedido | El sistema, al cotizar, según producto **y destino** (sección 3.1) |
| 9 | Pedidos fuera de cobertura local | Dejan de rechazarse: pasan a programado con plazo en días y tarifa nacional |
| 10 | Quién entrega fuera del departamento | Repartidores propios con vehículo en cada departamento (cada repartidor tiene un departamento asignado) |
| 11 | Traslado entre departamentos | Un solo repartidor recoge en la tienda y viaja hasta el cliente; sin relevo en esta versión (`orders.courier_id` sigue siendo uno) |

Referencia comercial: el modelo se parece a Amazon y Mercado Libre (un pago, varios envíos), no a PedidosYa (una tienda por carrito). Esa comparación es de conocimiento general y conviene verificarla antes de usarla como argumento externo.

## 3. Límites propuestos para express

Un producto solo puede ser **express** si cumple todo lo siguiente (valores iniciales, ajustables por la administración sin tocar código):

| Criterio | Límite |
|---|---|
| Peso por unidad | hasta 5 kg |
| Lado más largo | hasta 45 cm |
| Suma de largo + ancho + alto | hasta 100 cm |
| Peso total de un pedido express | hasta 10 kg |
| No frágil de gran formato | pantallas, espejos, vidrio grande: siempre programado |

Razón: una caja o mochila de reparto de moto ronda los 40 cm por lado y un motorizado carga con seguridad entre 10 y 15 kg. Los límites quedan por debajo para dejar margen. Son un punto de partida, no un dato medido: hay que ajustarlos con los primeros pedidos reales.

Todo lo que no cumpla es **programado**. Un producto pequeño también puede ser programado si requiere validación (importación, armado, bajo pedido).

### Cómo se aplica

- El comercio declara en el producto: peso (kg) y largo, ancho y alto (cm).
- Si las medidas superan un límite, la opción Express aparece bloqueada con el motivo, y el producto queda programado.
- Si cumple, el comercio puede elegir Express o Programado. Junto a la opción se muestra el criterio completo.
- La administración puede marcar categorías del catálogo maestro como **solo programado** (televisores, sillones, refrigeradores). En ellas el comercio no puede elegir Express.
- Si el repartidor ve que un pedido express no cabe, coordinación lo **reclasifica** a programado, con motivo y registro de auditoría. Se cuenta cuántas reclasificaciones tiene cada comercio.
- El peso total de 10 kg se valida al crear la compra; si se excede, el mensaje pide reducir cantidades.

## 3.1 Clase del pedido: se valida por destino

La clase se calcula **por cada tienda**, al cotizar el envío, con el producto y el destino juntos. El pedido es **express** solo si se cumplen las tres condiciones; si falla cualquiera, es **programado**:

1. Todos sus productos pueden ser express (sección 3).
2. La distancia por calle de la tienda al pin es de hasta 20 km (el tope actual de `sales.delivery_zones`).
3. La tienda y el destino están en el **mismo departamento**.

Hoy un destino a más de 20 km se rechaza con "el envío no está disponible". Con este cambio deja de rechazarse: se cotiza como programado, con plazo y tarifa propios.

### Plazo y tarifa del programado (implementado así)
Se calculan por **tramos de distancia** (`sales.programmed_bands`: hasta cuántos km, días mínimo y máximo, pago al repartidor y margen), igual que las zonas del express pero sin tope de 20 km. Se descartó clasificar por departamentos limítrofes para no depender de un mapa de vecindades que habría que mantener y que se podía equivocar.

El plazo final suma tres cosas: el tramo, los **días extra del departamento de destino** (`sales.departments.extra_days`, para zonas de acceso lento como la Costa Caribe) y los **días de validación** del producto (el mayor del envío).

La tabla de tramos **nace vacía**: los precios y plazos reales los define la operación, y mientras no cubran la distancia del pedido el sistema responde "el envío programado a esa distancia aún no está disponible" en vez de inventar un precio. Ejemplo de estructura, con valores de **marcador de posición**:

| Tramo | Plazo de ejemplo |
|---|---|
| Hasta 50 km | 1 a 3 días |
| Hasta 400 km | 3 a 7 días |

### Cómo se conoce el departamento
La base de datos hoy solo sabe latitud y longitud, y solo comprueba que el punto caiga dentro de Nicaragua. No hay departamento en tiendas ni direcciones. Se agrega:
- `department` en cada tienda (lista cerrada de los 15 departamentos y las 2 regiones autónomas).
- `department` en cada dirección del cliente, elegido en el formulario junto al pin, con una comprobación de coherencia.
- El pedido guarda origen, destino, distancia y tramo, para liquidar y auditar.

### Qué ve el cliente
- En catálogo y producto: "Express disponible" solo como posibilidad, porque la clase real depende de su dirección.
- En el carrito: un selector "Entregar en" (departamento) para anticipar la clase y el plazo de cada entrega.
- En el checkout: la clase, el plazo y el costo definitivos de cada entrega, ya con el pin.

## 4. Cambios en la base de datos

Cada cambio va en una migración nueva, con pruebas pgTAP en `supabase/tests/database`.

1. **Producto:** `express_eligible boolean` (puede ser express), `weight_kg`, `length_cm`, `width_cm`, `height_cm`, y opcional `validation_days`. Un `check` impide marcarlo elegible si supera los límites vigentes. La clase final **no** se guarda en el producto: la calcula la cotización.
2. **Categoría maestra:** `programado_only boolean`.
3. **Ajustes de clase:** tabla `sales.delivery_class_settings` con los límites de la sección 3 (patrón de `sales.delivery_settings`).
4. **Repartidor:** `vehicle_type` pasa a valor controlado `moto` | `vehiculo`, y se agrega `department` (zona donde trabaja). Migración de los existentes (clasificación manual por la administración).
5. **Tarifa:** `sales.delivery_zones` sigue siendo el tabulador del express local. Tabla nueva de tramos programados (origen, destino, plazo mínimo y máximo, costo al cliente, pago al transportista, margen) editable por la administración.
5b. **Departamento:** columna `department` en `commerce.stores` y `sales.customer_addresses`, con lista cerrada.
5c. **Cotización:** `record_delivery_quote` y `private.delivery_quote` devuelven la clase, el plazo y el costo. Los destinos a más de 20 km o en otro departamento dejan de lanzar "fuera de cobertura" y se cotizan como programado. `create_order` recibe esa cotización y guarda la clase.
6. **Pedido:** `sales.orders.delivery_class`, `origin_department`, `destination_department`, `eta_min_days`, `eta_max_days` y `sales.orders.checkout_id`; el pedido registra quién y por qué lo reclasificó.
7. **Compra:** tabla `sales.checkouts` (cliente, método de pago, referencia de idempotencia, total, vencimiento).
8. **Creación:** función `create_checkout` que recibe los grupos (tienda × clase), valida todo y crea todos los pedidos en una transacción reutilizando `create_order_core`. `create_order` queda intacta.
9. **Despacho:** la asignación solo acepta repartidores de la clase de vehículo del pedido.
10. **Programados:** estado "en validación" antes de `confirmado`; el stock se reserva al validar; vencimiento propio, más largo que el actual.

## 5. Cambios en la aplicación

**Tienda**
- Carrito `v2`: cada línea lleva su tienda y su clase; sin conflicto de tienda. Migración del formato `rapitrip-cart-v1`. Reescribir `cart.test.ts`.
- Pantalla del carrito agrupada por entrega, con la clase y el costo de envío de cada una.
- Checkout con una dirección y un pin; una cotización de envío por entrega y el desglose antes de pagar.
- Pantalla de confirmación con todos los pedidos de la compra; listado de pedidos agrupado.

**Consola**
- Editor de producto del comercio (`comercio/catalogo/[id]/product-editor.tsx`): medidas, selector de clase y criterios.
- Catálogo maestro (admin): marcar categorías "solo programado" y editar los límites.
- Coordinación: filtro de repartidores por vehículo, reclasificación y etiqueta "misma compra".
- Repartidores (admin): tipo de vehículo como lista cerrada.

**Pagos**
- `stripe-checkout`, `record_order_checkout_session` y el webhook pasan a operar sobre la compra.
- Reembolso parcial por pedido si una tienda rechaza o el cliente cancela: `process-refunds` y el webhook se revisaron y adaptaron en la etapa 5 (ver 5.5).

## 5.1 Estado de la etapa 1 (base de datos): construida y probada el 22 de octubre de 2026

Migraciones `20261101000057_delivery_classes_geography.sql`, `…058_delivery_assessment.sql` y `…059_checkouts.sql`; pruebas en `supabase/tests/database/400_delivery_classes_and_checkout.test.sql` (67 pruebas). La suite completa (825 pruebas) pasa sobre una base limpia.

Qué quedó y qué se decidió al construir:
- **Departamentos** (`sales.departments`, 15 + 2 regiones) en tiendas, direcciones del cliente y repartidores; `set_store_department`.
- **Elegibilidad del producto:** `express_eligible`, peso, medidas y `validation_days`; `set_product_delivery` exige peso y medidas para ser express y bloquea lo que supera los límites o está en una categoría «solo programado» (`set_master_item_programado_only`). Los productos anteriores quedan elegibles y sin medidas hasta que el comercio las complete.
- **Límites de express** en `sales.delivery_class_settings` (5 kg, 45 cm, 100 cm, 10 kg por pedido); `set_delivery_class_limits`. El tope de 20 km sale de la última zona de `sales.delivery_zones`.
- **Repartidores:** `vehicle_class` (`moto` | `vehiculo`) y `department`; `set_courier_coverage`. Los existentes se clasificaron por su texto cuando contenía «moto» o un tipo de vehículo; el resto queda sin clase.
- **Cotización:** `quote_delivery_group` y `private.delivery_assess` deciden la clase por producto, distancia y departamento. Si la tienda o el destino no tienen departamento, esa condición no se aplica (así el flujo actual sigue igual hasta que el checkout lo pida).
- **Compra:** `sales.checkouts`, `create_checkout` (todo o nada, hasta 4 tiendas, idempotente por `client_ref`, el error nombra la tienda) y nuevas columnas en `sales.orders` (clase, razón, origen, destino, tramo, plazo). `create_order` sigue funcionando y ahora rechaza productos que no pueden ir en moto.

Límites conocidos de esta etapa:
- `create_order_core` limita a 5 los pedidos sin resolver por cliente; una compra de varias tiendas con envíos express y programados puede acercarse a ese tope. Conviene revisarlo en la etapa 4.
- Los programados todavía pasan por el mismo flujo de estados que los express (sin «en validación», con el vencimiento corto actual y reserva de stock inmediata). Eso se resuelve en la etapa 6.
- La distancia de destinos a más de 20 km se calcula en línea recta por el factor de ruta; la función de borde con Mapbox solo cotiza dentro de cobertura express.
- Todavía no hay pantalla para editar `sales.programmed_bands` ni `sales.departments.extra_days`: hoy se cambian por migración o SQL.
- Reclasificar un pedido en ruta (con motivo y auditoría) y filtrar el despacho por vehículo y departamento quedan para la etapa 6.

## 5.2 Estado de la etapa 2 (editor de producto y catálogo maestro): construida el 22 de octubre de 2026

- **Comercio** (`/comercio/catalogo/[id]`): nueva tarjeta «Tipo de entrega» ([product-delivery-card.tsx](../../apps/console/src/app/comercio/catalogo/[id]/product-delivery-card.tsx)). Explica los dos tipos con los límites vigentes, pide peso y medidas, bloquea Express si no cabe en una moto (con el motivo) o si la categoría es «solo programado», y avisa a los productos anteriores que se entregan como express sin medidas. Programado admite días de validación.
- **Administración** (`/admin/catalogo`): tarjeta de límites de express ([delivery-limits-card.tsx](../../apps/console/src/app/admin/catalogo/delivery-limits-card.tsx)) y botón «Solo programado» / «Permitir express» en cada categoría principal (las subcategorías heredan la marca).
- **Validación compartida** (`@rapitrip/validation`): `productDeliverySchema`, `deliveryLimitsSchema` y `expressLimitProblem`, con la misma regla que `set_product_delivery`; la base de datos sigue siendo la que decide.
- **Auditoría:** las acciones nuevas tienen texto legible en la consola.
- Pendiente de esta parte: al crear un producto nuevo hoy nace «elegible sin medidas» (como los anteriores); el aviso del editor es lo que empuja a completarlas. Falta pantalla para departamento de tiendas (`set_store_department`), vehículo y departamento de repartidores (`set_courier_coverage`) y las tarifas programadas; entran con las etapas 3 y 6.
- No se probó a mano en el navegador: se verificó con pruebas de componentes (11 nuevas), pruebas del esquema, tipos y lint.

## 5.3 Estado de la etapa 3 (carrito v2 con varias tiendas): construida el 22 de octubre de 2026

- **Modelo** ([cart.ts](../../apps/store/src/lib/cart.ts)): cada línea lleva su `storeId` y `storeName`; el carrito ya no tiene una tienda única. Tope de 4 tiendas y 30 líneas en total (`too_many_stores` y `full` dejan el carrito intacto). Helpers nuevos: `storeGroups`, `storeGroup`, `storeCount`, `removeStore`, `setStoreName`.
- **Almacenamiento** ([cart-store.ts](../../apps/store/src/lib/cart-store.ts)): clave `rapitrip-cart-v2`. Un carrito guardado con la versión anterior (`rapitrip-cart-v1`, una sola tienda) se migra solo la primera vez y la clave vieja se borra; comprobado en el navegador con tres tiendas reales.
- **Pantalla del carrito** ([cart-view.tsx](../../apps/store/src/app/(tienda)/carrito/cart-view.tsx)): una sección por tienda con su subtotal, sus avisos (precio cambiado, sin stock, tienda cerrada) y «Quitar tienda»; cada tienda se cotiza por separado. El resumen lista el subtotal por tienda y un botón de pago por tienda, bloqueado solo para la que tenga avisos.
- **Agregar al carrito** (ficha y tarjeta): se acabó el diálogo «vaciar y agregar»; las tiendas se suman hasta el tope, y al pasarse se avisa. «Repetir pedido» ahora suma al carrito actual en vez de reemplazarlo.
- **Pago, de forma transitoria:** `/checkout?tienda=<id>` paga una tienda y deja las demás en el carrito; sin `tienda` y con varias en el carrito, ofrece elegir. Con una sola tienda todo sigue como antes. Esto se reemplaza en la etapa 4 por una sola compra (`create_checkout`).
- **Pruebas:** `cart.test.ts` reescrito (24), nuevas pruebas de agregar con varias tiendas y de pago por tienda; las 106 pruebas de la tienda pasan, con tipos y lint limpios. Los dos e2e que sembraban el carrito (`tienda-pedido`, `mapas`) pasaron al formato v2 pero **no se ejecutaron** (necesitan los servicios completos).
- Pendiente de esta parte: el selector «Entregar en» y la insignia Express/Programado por entrega en el carrito (necesitan el departamento del cliente y la cotización por grupo, etapa 4); desglose de envío por entrega.

## 5.4 Estado de la etapa 4 (checkout único en efectivo): construida el 22 de octubre de 2026

- **Una sola compra** ([checkout-form.tsx](../../apps/store/src/app/(tienda)/checkout/checkout-form.tsx)): una dirección, un punto y un **departamento de entrega** para todo el carrito. Cada tienda se cotiza por separado y sale en uno o dos envíos; el resumen muestra, por envío, la clase (Express / Programado), el plazo («Llega en pocas horas», «Llega en 3 a 7 días»), por qué es programado, sus productos y su costo, y al final productos + envíos = total. Una tienda con error de envío (por ejemplo, sin tarifa programada) se puede quitar para seguir con las demás. Reemplaza el pago transitorio por tienda de la etapa 3; el carrito ahora tiene un solo botón «Continuar con la compra».
- **Acciones** ([actions.ts](../../apps/store/src/app/(tienda)/checkout/actions.ts)): `quoteGroupAction` pide primero la distancia por calle (`quote-delivery`) y cotiza con `quote_delivery_group`; `placeCheckout` llama a `create_checkout` (todo o nada, idempotente por `client_ref`).
- **Después de comprar:** un solo pedido lleva a su pantalla (`/pedidos/<id>`, como antes); varios llevan a la nueva pantalla de la compra ([/compras/[id]](../../apps/store/src/app/(tienda)/compras/[id]/page.tsx)) con sus pedidos, clase, plazo y estado.
- **Tarjeta:** solo se ofrece cuando la compra tiene una sola entrega (se paga con el flujo actual de ese pedido). Con varias entregas queda para la etapa 5 (una sesión de Stripe para toda la compra).
- **Departamento en todas partes:** migración `…060_address_department.sql` (`set_address_department`), libreta de direcciones del cliente (obligatorio en las nuevas; las anteriores muestran un aviso) y editor de tienda de la consola (departamento junto a la ubicación, con aviso si falta). Mientras una tienda no tenga departamento, la regla «otro departamento» no se aplica a sus envíos.
- **Validación compartida:** `departments`, `purchaseSchema` y `deliveryGroupQuoteSchema` en `@rapitrip/validation`.
- **Verificación:** 117 pruebas de la tienda (14 del checkout, 4 de la libreta, 5 de `delivery-class`), 42 de validación y 56 de la consola; tipos y lint limpios; 833 pruebas de base de datos sobre una base limpia. Además se probó **de punta a punta en el navegador contra la base local** con una cuenta de prueba (ya eliminada): dos tiendas, una express en Managua a C$50 y una programada por estar en Granada (1 a 3 días, C$120), total C$300, compra creada con dos pedidos y su pantalla. Los datos de prueba (tarifas, departamentos, pedidos, usuario) se borraron después.
- **Sin ejecutar:** los e2e `tienda-pedido` y `mapas` se adaptaron (departamento y texto de plazo) pero no se corrieron.
- Pendiente de esta etapa: la función de borde `quote-delivery` no estaba levantada en la prueba local, así que la distancia por calle de Mapbox no se ejerció (se usó la línea recta); la edición de las tarifas programadas sigue siendo por SQL.

## 5.5 Estado de la etapa 5 (pago con tarjeta de toda la compra): construida el 22 de octubre de 2026

Migración `20261101000061_checkout_payment.sql` y pruebas `supabase/tests/database/420_checkout_payment.test.sql` (54).

- **Una sola sesión de Stripe por compra.** Una compra con tarjeta y varios pedidos queda en `payment_status = 'pendiente'` (con un solo pedido se sigue pagando el pedido, como antes). La función de borde `stripe-checkout` acepta `checkout_id`: arma un renglón por producto y uno de envío por entrega, con exactamente la suma de los pedidos que aún esperan pago, y registra la sesión con `record_checkout_payment_session`. Los pedidos de esa compra ya no abren sesión propia (`record_order_checkout_session` lo rechaza; la función de borde responde 409 y la pantalla del pedido remite a la compra).
- **Webhook por compra.** `stripe-webhook` reconoce `metadata.checkout_id` y llama a `apply_stripe_checkout_event`: marca pagados todos los pedidos incluidos; si el cliente canceló uno entre crear la sesión y pagar, el pago se aplica a los demás (`pagado_parcial`) y la parte cancelada queda en la cola de reembolsos; un cobro tardío, doble o de otro monto se reembolsa completo; los eventos repetidos no se aplican dos veces.
- **Vencimiento.** Si la sesión vence sin pago se cancelan los pedidos pendientes, se libera su stock y la compra pasa a `vencido`. También vence cuando el cliente cancela el último pedido pendiente.
- **Reembolso parcial.** `claim_pending_refunds` devuelve ahora el monto: los pedidos de una compra pagada de una vez se reembolsan por su parte (`amount` en centavos sobre el mismo cobro); los demás, completos. `process-refunds` lo envía a Stripe con la clave de idempotencia por pedido, y el índice del cobro dejó de ser único porque varios pedidos lo comparten.
- **Tienda.** El checkout ofrece tarjeta también con varias entregas («Pagas ahora toda la compra, en un solo cobro»). Tras crear la compra se abre Stripe; si no abre, la pantalla de la compra muestra «Falta pagar con tarjeta» con el monto, el tiempo restante y el botón **Pagar con tarjeta**, y se actualiza sola mientras se confirma el pago (`?pago=ok`). Un pedido de una compra pendiente de pago no muestra su propio botón de pago.
- **Consola.** La pantalla de excepciones lista también los cobros de una compra por reembolsar («Compra con varios pedidos»).
- **Verificación:** 887 pruebas de base de datos (sobre una base limpia), 34 de Deno (13 de Stripe, con la sesión de compra, el ruteo del evento y el reembolso parcial), 120 de la tienda, 56 de la consola y 42 de validación; tipos y lint limpios; las tres funciones de borde compilan con `deno check`. En el navegador, con datos reales y una cuenta de prueba (ya eliminada): compra con tarjeta de dos tiendas → compra pendiente de pago con 300 NIO, pedidos «Esperando pago», aviso en el pedido; la confirmación de Stripe se simuló en la base de datos (pedidos a «Por confirmar», compra pagada) y la cancelación de un pedido pagado dejó un reembolso de 150 NIO (su parte).
- **No se ejercitó:** el cobro real contra Stripe (no hay claves de prueba en el entorno local ni las funciones de borde estaban levantadas), ni el `process-refunds` real. Antes de producción conviene una prueba con claves de prueba de Stripe y el webhook reenviado con `stripe listen`.

## 5.6 Estado de la etapa 6 (despacho por vehículo, en validación y reclasificación): construida el 22 de octubre de 2026

Migración `20261101000062_dispatch_validation.sql` y pruebas `supabase/tests/database/430_dispatch_validation.test.sql` (49).

- **Despacho por vehículo y departamento.** `assign_order_courier` exige compatibilidad: un express lo lleva cualquiera (moto, vehículo o un repartidor aún sin clasificar); un programado, solo un repartidor con `vehiculo` que trabaje en el departamento de la tienda (si la tienda ya tiene departamento). Los mensajes de error dicen qué falta. En la consola, el selector de repartidores de coordinación solo ofrece los compatibles y avisa cuántos quedaron fuera ([dispatch-workspace.tsx](../../apps/console/src/app/coordinacion/dispatch-workspace.tsx), regla en [courier-fit.ts](../../apps/console/src/lib/courier-fit.ts), que replica la de la base de datos).
- **Estado «en validación».** Nuevo estado entre «por confirmar» y «confirmado», solo para pedidos programados: el comercio lo marca cuando empieza a revisar disponibilidad, armado o proveedor (también puede confirmar directo). Plazos propios: 24 horas para que el comercio responda (en efectivo al crear el pedido y con tarjeta al llegar el pago; un express sigue en 45 minutos) y, en validación, los días máximos de la entrega. Si nadie responde, el pedido vence con su motivo («validación vencida») y se devuelve el stock y, si había pago, el dinero. El cliente puede cancelar mientras se valida. **Decisión:** el stock sigue reservándose al crear el pedido (no al validar), para no vender dos veces lo que se está validando.
- **Reclasificación.** `reclassify_order` (coordinación y administración) pasa a programado un express que todavía no salió (por confirmar, confirmado, preparando o listo), con motivo de 5 a 200 caracteres. Se conserva lo que pagó el cliente; el pago al repartidor y el plazo salen del tramo programado de la distancia del pedido (si aún no hay tramo cargado, quedan sin plazo y se muestra «se entrega en días»); el margen puede quedar negativo y eso se ve. Se le quita el repartidor en moto. Queda auditado (`order.reclassified`) y a la vista del cliente y del comercio.
- **Métrica por comercio.** `commerce_reclassification_stats` (últimos 30 días, solo coordinación y administración) se muestra en el detalle del comercio de la consola: «X de Y pedidos express reclasificados».
- **Pantallas.** Comercio: insignia Express/Programado y plazo, acciones «Empezar a validar» y «Confirmar (validado)», fecha límite de validación y aviso de reclasificación. Coordinación: clase en cada pedido y botón «Reclasificar a programado». Administración: la alerta «sin respuesta del comercio» espera 12 horas en los programados (20 minutos en los express). Tienda: el cliente ve la clase, el plazo («Llega en 1 a 3 días»), el estado «En validación» y cuánto tiempo le queda al comercio (ahora en horas o días cuando es largo).
- **Verificación:** 936 pruebas de base de datos sobre una base limpia, 123 de la tienda, 74 de la consola (incluye pruebas de componente del despacho y de la validación del comercio), 42 de validación y 34 de Deno; tipos y lint limpios. En el navegador, con datos reales y una cuenta de prueba (ya eliminada): una compra de dos tiendas creó un pedido express con 45 minutos para el comercio y uno programado con 24 horas; con el programado puesto en validación, la pantalla del cliente mostró «En validación», «Programado · Llega en 1 a 3 días» y «El comercio tiene hasta 3 días para terminar de validar tu pedido». Los datos de prueba se borraron.
- **No se verificó a mano:** las pantallas de consola (coordinación y comercio) con un usuario real, porque exigen segundo factor; sí tienen pruebas de componente. Tampoco se avisa por correo al cliente de la reclasificación ni de la validación (los correos actuales solo cubren «recibido» y «cancelado»).

## 5.7 Estado de la etapa 7 (confirmación y listado de pedidos agrupado): construida el 22 de octubre de 2026

Migración `20261101000063_my_order_units.sql` y pruebas `supabase/tests/database/440_my_order_units.test.sql` (11).

- **Listado agrupado por compra** ([pedidos/page.tsx](../../apps/store/src/app/(tienda)/pedidos/page.tsx), [order-unit-card.tsx](../../apps/store/src/app/(tienda)/pedidos/order-unit-card.tsx)). Una compra con varios pedidos aparece como un grupo («Compra de 2 pedidos», con fecha, cuántos siguen abiertos, total y «Falta pagar» si la tarjeta está pendiente) y, dentro, un renglón por entrega con su clase, plazo, estado y total, cada uno enlazado a su pedido. Un pedido suelto, o una compra de un solo pedido, se ve como una tarjeta normal, ahora también con su clase y su plazo.
- **Paginación sin partir compras.** La vista `my_order_units` entrega «unidades» (una compra completa o un pedido suelto) y la página pagina sobre ellas; después pide los pedidos de esas unidades. Solo la ve el cliente dueño (con su sesión vigente). La lógica de unir unidades y pedidos está en [purchases.ts](../../apps/store/src/lib/purchases.ts) con pruebas.
- **Pantalla de la compra** (`/compras/[id]`, creada en la etapa 4 y ampliada en la 5): ahora muestra además la dirección y el teléfono de entrega y los productos de cada pedido.
- **Verificación:** 947 pruebas de base de datos sobre una base limpia, 134 de la tienda, 74 de la consola, 42 de validación y 34 de Deno; tipos y lint limpios. En el navegador, con datos reales y una cuenta de prueba (ya eliminada): el listado mostró el grupo «Compra de 2 pedidos» (Express «Llega en pocas horas» y Programado «Llega en 1 a 3 días») seguido del pedido suelto, y la pantalla de la compra mostró la dirección, los productos y el plazo de cada entrega. Los datos de prueba se borraron.

## 5.8 Cierre del plan

Las siete etapas están construidas y verificadas por separado. Lo que **no** se ha ejercitado de punta a punta y conviene probar antes de producción:

1. El cobro real con Stripe (claves de prueba, `stripe listen` y `process-refunds` reales): las pruebas cubren la base de datos, la construcción de la sesión y el ruteo del evento, no la llamada a Stripe.
2. Las pantallas de la consola (comercio, coordinación y administración) con usuarios reales con segundo factor: tienen pruebas de componente, no una pasada manual.
3. Los dos e2e adaptados (`tienda-pedido` y `mapas`) y el resto de la suite e2e, que necesitan los servicios completos.
4. La distancia por calle de Mapbox (`quote-delivery`) dentro del checkout único: en las pruebas locales se usó la línea recta.

Pendientes de operación (no de código): cargar las tarifas y plazos reales de `sales.programmed_bands` y los días extra por departamento; completar el departamento de cada tienda y de cada repartidor y la clase de vehículo de los repartidores existentes; pedir a los comercios que completen peso y medidas de sus productos; y decidir cuándo se cobra un programado con tarjeta (sección 8).

## 6. Etapas

1. Base de datos: elegibilidad del producto, departamentos, clase del pedido por destino, tramos programados, vehículos, `sales.checkouts`, `create_checkout`, pruebas.
2. Editor de producto y catálogo maestro (clasificación con medidas y criterios).
3. Carrito `v2` y su pantalla agrupada.
4. Checkout con cotización por entrega y compra en efectivo.
5. Pago con tarjeta: sesión única, webhook, vencimiento y reembolso parcial.
6. Despacho por vehículo, estado "en validación" y programados.
7. Confirmación y listado agrupado de pedidos.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Etiqueta rígida: un televisor en stock puede salir hoy; un sillón bajo pedido tarda semanas | Categoría fija el valor por defecto; el pedido se confirma con lo que el comercio valida |
| Comercio marca express lo que no cabe | Medidas obligatorias, bloqueo automático, categorías "solo programado", reclasificación auditada y métrica |
| Tarifa por distancia no cubre artículos grandes | Tarifa propia por clase y repartidores con vehículo |
| Pago y stock por semanas | Reserva al validar; para tarjeta, cobrar al validar con plazo máximo o seña (por decidir) |
| Varias entregas asustan al cliente | Desglose desde el carrito; opción de consolidar más adelante |
| Demasiados casos a la vez | Construir por etapas; la clave tienda × clase es común a ambos cambios |

## 8. Pendientes por decidir

- **Relevo entre departamentos:** descartado por ahora. Si más adelante se necesita (dos repartidores por pedido, pago por tramo, estado "en traslado"), el pedido ya guarda origen y destino, así que se puede añadir sin rehacer el modelo.
- **Despacho del programado (resuelto en la etapa 6):** el repartidor debe tener `vehiculo` y trabajar en el departamento de la tienda; no hay excepción para asignar a uno de otro departamento. Sigue pendiente la liquidación del viaje largo: el pago al repartidor del programado sale del tramo (`courier_pay` de `sales.programmed_bands`), no de la distancia local.
- Plazos y tarifas reales de cada tramo (los de la sección 3.1 son de ejemplo).
- Si el límite de 20 km para express es el correcto o se acorta.
- Si el cliente elige día o ventana de entrega del programado, o recibe una fecha estimada al validarse.
- Prioridad de motos para los express: hoy un repartidor con vehículo (o sin clasificar) puede tomar un express como respaldo y coordinación elige a mano; falta decidir si el sistema debe sugerir primero a las motos.
- Cuándo se cobra el programado con tarjeta: hoy se cobra **al pedir**, junto con el resto de la compra (etapa 5). Queda por decidir si conviene cobrar al validar con plazo máximo o con seña, sobre todo para plazos de semanas (las retenciones de tarjeta caducan en unos 7 días; verificarlo con Stripe).
- Si en efectivo el programado exige seña.
- Si la clase se define por variante además de por producto (propuesta inicial: solo por producto).
- Valores reales de los límites y de la tarifa programada, a ajustar con datos.


## 9. Descuentos de productos (agregado el 22 de octubre de 2026)

Función independiente de las siete etapas. Migración `20261101000064_variant_discounts.sql` y pruebas `supabase/tests/database/450_variant_discounts.test.sql` (29).

- **Regla.** Cuando el comercio baja el precio de una presentación al menos un **5 %** respecto de su precio de lista, la presentación queda en descuento: el precio anterior se guarda en `product_variants.compare_at_price` y el porcentaje se calcula (nunca se escribe a mano). El comercio no puede inventar un «precio antes»: solo existe el que la presentación tuvo de verdad. Una baja de menos de 5 % no cuenta; bajar más conserva el precio de lista original; subir hasta quedar a menos de 5 % de la lista (o por encima) quita el descuento solo. También se puede quitar a mano (`remove_variant_discount`). **Sin fecha de fin**: la administra el comercio.
- **Consola** (editor de producto): cada presentación muestra el precio anterior tachado, la insignia «-X %» y el botón «Quitar descuento»; al editar el precio, un aviso dice si se activará, cambiará o quitará el descuento antes de guardar ([discount.ts](../../apps/console/src/lib/discount.ts) replica la regla de la base de datos).
- **Tienda:** insignia «-X %» y precio tachado en las tarjetas y en la ficha (por presentación), filtro «Solo productos con descuento» y orden «Mayor descuento» en el catálogo, y una sección «Con descuento» en la portada. En una tarjeta con varias presentaciones se muestra el mayor descuento disponible y solo se tacha el precio si la presentación más barata (la del botón rápido) es la que está en descuento.
- **Carrito y pedidos:** se cobra el precio actual, como siempre; el descuento no cambia el flujo de compra.
- **Verificación:** 976 pruebas de base de datos sobre una base limpia; en la tienda y la consola pasan las pruebas nuevas (insignia, tarjeta, ficha, filtros, regla de la consola y editor de variantes). En el navegador, con dos productos reales puestos temporalmente en descuento (ya revertidos): la portada mostró «Con descuento» con «-25 %» y «Antes 40,00 NIO», y el catálogo filtrado y ordenado por descuento mostró solo esos dos.

## 10. Correcciones de la revisión de código (22 de octubre de 2026)

Migración `20261101000065_review_fixes.sql` y pruebas `supabase/tests/database/460_review_fixes.test.sql` (23).

- **Reembolso de dinero no cobrado.** `record_checkout_payment_session` ahora limpia `payment_amount` de los pedidos que ya no esperan pago: un pedido cancelado entre dos sesiones de pago ya no entra en la cola de reembolsos al llegar el pago.
- **Tope de 5 pedidos abiertos.** `create_order_core` recibe `p_enforce_limit`; `create_checkout` comprueba el tope una sola vez sobre lo que el cliente ya tenía abierto y crea todos los pedidos de la compra sin contarlos contra el tope (una compra puede tener hasta 8). Los pedidos sueltos siguen con el tope de siempre.
- **Despacho.** `set_order_status('en_camino')` vuelve a comprobar que el repartidor sirve (clase de vehículo, departamento y que siga activo).
- **Clase de vehículo.** `private.guess_vehicle_class` reconoce palabras completas y deja sin clase lo negado o ambiguo («a pie, sin vehículo», «avanzado»); la migración 57 la usa y la 65 corrige a los repartidores ya clasificados de más.
- **Tienda.** El total de envíos y el conteo de entregas del checkout se calculan solo sobre las tiendas que siguen en el carrito. Se eliminaron `placeOrder`, `quoteDeliveryAction` y `checkoutSchema` (sin uso tras el checkout único). Las acciones del checkout tienen pruebas propias (19).
- **Pagos.** La lógica de `stripe-checkout` pasó a `handler.ts`, con pruebas del manejador (10) que usan un cliente de Supabase de mentira.
- **Duplicados.** `deliveryClassLabel`, `deliveryEtaText` y `toDeliveryClass` viven en `@rapitrip/validation`; la tienda y la consola los reutilizan. La regla de compatibilidad de repartidores sigue escrita en la consola y en SQL a propósito (la base de datos manda; la consola solo filtra la lista).
- **Pendiente a propósito: productos sin peso.** Los productos existentes siguen contando 0 kg en el tope de 10 kg por pedido express. Tratar «sin peso» como incumplimiento pasaría todo el catálogo actual a programado (o bloquearía las compras) hasta que los comercios completen sus medidas; es una decisión de operación. El editor de producto ya avisa a cada comercio.
- **Archivo generado.** `supabase/functions/deno.lock` se borró y se agregó al `.gitignore`.


## 11. El departamento de entrega sale del mapa (22 de octubre de 2026)

**Decisión.** El cliente ya no elige el departamento, ni en el checkout ni en su libreta de direcciones: basta el punto marcado en el mapa, que ya es obligatorio.

**Cómo funciona.** La migración 66 crea `sales.department_anchors` (70 puntos de referencia: cabeceras y ciudades principales de los 15 departamentos y las 2 regiones) y `public.department_for_point(lat, lng)`, que devuelve el departamento cuyo punto queda más cerca del pin, o nulo si el pin está fuera de Nicaragua. Las acciones `quoteGroupAction`, `placeCheckout` y `saveAddress` lo piden a la base de datos y lo pasan a `quote_delivery_group`, `create_checkout` y `set_address_department`, que no cambian. Lo que el navegador mande como departamento se ignora.

**Límite conocido.** Es una aproximación por cercanía, no por polígonos: un pin pegado a la frontera entre dos departamentos puede caer en el vecino. Eso puede cambiar una entrega de express a programado (o al revés) solo en esos casos. Si la operación consigue los polígonos oficiales, basta con reescribir `department_for_point`.
