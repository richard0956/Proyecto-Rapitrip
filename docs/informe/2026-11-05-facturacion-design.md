# Diseño: facturas de Rapitrip (registro contable propio)

Managua, 5 de noviembre de 2026
Tipo de documento: diseño propuesto, previo a construir. **No hay código todavía.**

---

## 1. Decisiones ya tomadas con el negocio

| Tema | Decisión |
|---|---|
| País | Nicaragua |
| Validez fiscal | **Ninguna.** Es un registro contable propio de Rapitrip. Cada documento lleva la leyenda «Comprobante interno de Rapitrip, sin validez fiscal». Sin timbrado ni integración con la DGI. |
| Numeración | **Una sola serie de la plataforma.** Si el comercio quiere facturar al cliente, lo hace por fuera; Rapitrip no la guarda. |
| Documentos por pedido | **Dos:** factura de **venta** (productos) y factura de **servicio** (la tarifa de servicio de entrega). |
| Tarifa de servicio | Es el `delivery_fee` del pedido. No se crea una tarifa nueva ni se toca el cobro. |
| Alcance | Efectivo y tarjeta; entrega express y programada. |
| Stripe | Queda como comprobante de pago, no como factura. |

## 2. Qué hay hoy (verificado en el repo)

- No existe nada de facturación.
- `sales.orders` tiene `subtotal`, `delivery_fee` y `total` (`total = subtotal + delivery_fee`), `payment_method` (`efectivo`/`tarjeta`), `payment_status` (`pendiente`, `pagado`, `fallido`, `reembolso_pendiente`, `reembolsado`) y `channel` (`web`/`mostrador`).
- Un pedido **entra a «por_confirmar»** en efectivo al crearse y con tarjeta al confirmarse el pago. Ese es el punto donde ya se manda el correo «pedido recibido» (`private.enqueue_order_email`, trigger sobre `sales.order_events`).
- Una compra con varias tiendas se divide en varios pedidos (`checkouts`, migración 59): **cada pedido tendrá su propio par de facturas.**
- Cancelación, devolución y reembolso ya existen (migraciones 25, 26 y 53, y la función `process-refunds`).
- Las liquidaciones a comercios (migración 91, con `commission_pct`) son otro tema: no se mezclan con estas facturas.
- La última migración es la 93; esta funcionalidad empezaría en la **94**.

## 3. Cuándo se emite

Se emite **en el mismo instante en que el pedido pasa a «por_confirmar»**, desde el mismo punto del historial (`sales.order_events`) que ya dispara el correo.

| Caso | Momento |
|---|---|
| Efectivo (express o programado) | Al crear el pedido |
| Tarjeta (express o programado) | Al confirmarse el pago. **Nunca antes**: un pago fallido o abandonado no genera factura. |

Reglas:

- **Idempotente.** Un pedido no puede tener dos facturas de venta ni dos de servicio (índice único).
- **Solo `channel = 'web'`.** Las ventas de mostrador quedan fuera de esta primera versión (el cliente está presente y no hay envío).
- **La factura de servicio solo se emite si `delivery_fee > 0`.** Si el envío es gratis, el pedido tiene solo la factura de venta.
- **Sin retroactivos.** Los pedidos que ya pasaron de «por_confirmar» antes de la migración no reciben facturas.

## 4. Modelo de datos

Todo en el esquema `sales`, sin acceso directo para nadie (`revoke all`, RLS activo); se lee y se escribe solo con funciones, como `sales.order_codes`.

### `sales.document_counters`
Un contador por serie (`venta`, `servicio`, `nc_venta`, `nc_servicio`). Se incrementa con un bloqueo de fila dentro de la misma transacción que emite el documento. **Así no quedan huecos** (una secuencia de Postgres sí los deja si la transacción se deshace). El volumen es bajo, el bloqueo no es un problema.

### `sales.invoices` (un solo libro para facturas y notas de crédito)

| Columna | Qué guarda |
|---|---|
| `id`, `order_id` | Identidad y pedido |
| `kind` | `venta`, `servicio`, `nota_credito_venta`, `nota_credito_servicio` |
| `number` | Texto único: `RT-V-000123`, `RT-S-000123`, `RT-NCV-000045`, `RT-NCS-000045` |
| `issued_at` | Fecha y hora de generación (la que aparece en el documento) |
| `credit_for` | Para notas de crédito: la factura original |
| `data` | Copia fija en `jsonb` de lo que dice el documento (ver abajo) |
| `sha256` | Huella del `data` en forma canónica, igual que en las evidencias |
| `total` | Importe, para listar y sumar sin abrir el `jsonb` |

`data` contiene: comprador (nombre y correo), vendedor (comercio o Rapitrip), tienda, número de pedido, líneas (producto, variante, cantidad, precio unitario, importe), subtotal, envío, total, método de pago, tipo de entrega (express/programada y fecha estimada), referencia de pago de Stripe si es tarjeta, y en notas de crédito el motivo.

**Inmutable:** un trigger rechaza cualquier `update` o `delete`. Un cambio se corrige con una nota de crédito, nunca editando.

**El estado de pago no se guarda en el documento.** Se calcula al mostrarlo desde `sales.orders.payment_status` (pendiente, pagado, reembolso en curso, reembolsado). Así el documento no cambia nunca y la información sí está al día.

## 5. Qué dice cada factura

**Factura de venta `RT-V-…`:** las líneas de productos y el `subtotal`. Vendedor: el comercio y la tienda. Emitida por Rapitrip como registro de la operación.

**Factura de servicio `RT-S-…`:** una línea, «Servicio de entrega (express/programada)», por el `delivery_fee`. Emisor: Rapitrip. Con los datos de zona y tipo de entrega que ya guarda el pedido.

Las dos juntas suman el `total` del pedido. Esa igualdad se prueba en las pruebas de base de datos.

## 6. Cancelaciones, devoluciones y reembolsos

Se emiten **notas de crédito** que referencian la factura original, con su propia fecha, número y motivo. Sigue la misma regla: la original no se toca.

| Evento | Nota de crédito |
|---|---|
| Pedido cancelado, rechazado o vencido después de emitidas las facturas (efectivo o tarjeta) | Total, de venta y de servicio |
| Devolución aprobada por coordinación | Total, de venta y de servicio |

- La nota de crédito se emite **al decidirse la cancelación o la devolución**, no cuando Stripe termina el reembolso. Cuando es con tarjeta, el estado del reembolso (`reembolso_pendiente` → `reembolsado`) se ve en el documento porque se calcula, y el id del reembolso de Stripe se agrega como referencia.
- Las devoluciones de hoy son del pedido completo (`return_requests` es única por pedido), así que las notas de crédito son siempre totales. Si algún día hay devolución parcial, se amplía.

## 7. Efectivo y firma

No se exige firma. La prueba de recepción ya es más fuerte que una firma: el **código de entrega de 4 dígitos, la foto y la ubicación**. La factura de efectivo muestra, una vez entregado, «Entrega confirmada con código el [fecha y hora]» y pasa a «pagado» cuando el pedido se entrega (así lo hace hoy `payment_status`).

Si más adelante se quiere firma, se agrega un recuadro en la app del repartidor como una evidencia más. No cambia este diseño.

## 8. Quién ve qué

| Rol | Ve | Cómo |
|---|---|---|
| Cliente | Las facturas y notas de crédito de **sus** pedidos | Tarjeta en el detalle del pedido; descarga en PDF |
| Comercio | La factura de venta y sus notas de crédito de sus pedidos | Detalle del pedido en la consola; **no** ve la de servicio |
| Administración | Todo | Libro contable con filtros por fecha, comercio, método de pago y tipo; exportable a CSV |

Funciones de lectura con la misma comprobación de rol y sesión que `my_delivery_code` y `order_pickup_code`.

## 9. PDF

Una función de borde `invoice-pdf` arma el PDF **al pedirlo**, a partir de la copia fija; no hay archivos que guardar ni sincronizar. Muestra: logo, número, fecha de generación, datos de las partes, líneas, totales, estado de pago, la leyenda sin validez fiscal y la huella `sha256` abreviada. Con tarjeta añade el id de pago y el enlace al recibo de Stripe, que se consulta en ese momento.

## 10. Correo

La plantilla `order_received` ya sale al pasar a «por_confirmar». Se le agregan los números de factura y el enlace al pedido (que exige iniciar sesión). No se adjunta el PDF en esta versión.

## 11. Etapas

1. **Base de datos (migración 94):** contadores, `sales.invoices`, inmutabilidad, emisión al pasar a «por_confirmar», notas de crédito en cancelación y devolución, funciones de lectura y libro. Pruebas pgTAP.
2. **PDF:** función `invoice-pdf` y pruebas.
3. **Tienda:** facturas en el detalle del pedido.
4. **Consola:** facturas en el pedido del comercio y el libro contable de administración con CSV.
5. **Correo y textos:** números de factura en «pedido recibido»; actualizar los textos legales si hace falta.

Al terminar cada etapa se corren las pruebas y tú revisas antes de pasar a la siguiente.

## 12. Pruebas que debe tener la etapa 1

- Efectivo y tarjeta emiten al pasar a «por_confirmar», no antes.
- Un pago de tarjeta fallido no emite nada.
- Dos disparos seguidos no duplican las facturas.
- Venta + servicio = `total` del pedido.
- Sin `delivery_fee` no hay factura de servicio.
- Numeración consecutiva sin huecos, también ante una transacción deshecha.
- `update` y `delete` sobre `sales.invoices` fallan, incluso para el administrador.
- Cancelación y devolución generan las notas de crédito correctas y no duplicadas.
- Cada rol ve solo lo suyo: un cliente no ve facturas ajenas; el comercio no ve la de servicio.
- Pedidos de mostrador no emiten.

## 13. Riesgos y puntos abiertos

- **Datos personales (resuelto en la etapa 1).** El nombre y el correo del comprador **no van en el `data`**: viven en `sales.invoice_buyers`, que se borra al anonimizar la cuenta (igual que `order_delivery`). El documento y su `sha256` no cambian; el PDF muestra «Cliente anonimizado».
- **Momento exacto de emisión (ajuste de la etapa 1).** `create_checkout` registra el evento «por_confirmar» y después fija el envío, la clase de entrega y los plazos. Por eso la emisión se engancha con un *constraint trigger* **diferido al final de la transacción**; así la factura copia los datos finales del pedido.
- **Moneda.** Se usa la misma moneda y formato con que hoy se muestran los importes de los pedidos.
- **IVA.** Sin desglose de impuestos, porque el documento no tiene validez fiscal. Si contabilidad lo quiere, se agrega una línea informativa.
- **Ventas de mostrador.** Fuera de la primera versión; se pueden incluir después sin cambiar el modelo.
- **Pedidos anteriores a la migración.** No se les emite nada; si hace falta un libro completo, se puede hacer una carga inicial con fecha de generación real, marcada como tal.
