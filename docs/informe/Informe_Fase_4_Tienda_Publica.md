# Fase 4: tienda pública, carrito, checkout y seguimiento

Managua, Nicaragua, 18 de octubre de 2026
Tipo de documento: guía de trabajo previa a construir. Describe qué hay que hacer, en qué orden y qué decisiones faltan. **No hay código de F4 todavía.**
Base: el estado del repositorio al cierre de la Fase 3 (migraciones 1 a 28, consola completa, pagos con Stripe en modo prueba).
Relacionados: `Informe_Frontend_Completo_Rapitrip.md` (todas las fases), `backend-referencia.md` (backend vigente), `2026-10-16-frontend-fundacion-design.md` (secciones 14 a 17, Fases 2 y 3).

---

## 1. Qué es la Fase 4

Es la parte que el cliente ve: la **tienda web pública** donde alguien entra sin cuenta, explora los comercios y sus productos, arma un carrito, ingresa, paga (en efectivo contra entrega o con tarjeta) y sigue su pedido hasta que llega. Con ella termina la Etapa 1 del proyecto: después de F4 Rapitrip puede operar de verdad.

Las fases anteriores dejaron resuelto casi todo lo difícil del lado del negocio:

| Pieza | Estado |
|---|---|
| Comercios, tiendas, horarios, catálogo, imágenes e inventario | Construido (F2) |
| Crear el pedido, reservar stock, estados, cancelar, vencimientos | Construido (F3, `create_order`, `set_order_status`) |
| Cobro con tarjeta (Stripe Checkout), webhook y reembolsos | Construido (F3, `stripe-checkout`, `stripe-webhook`, `process-refunds`) |
| Cuenta del cliente, ingreso, registro, recuperación, perfil, Google | Construido (F1) |
| Consola para comercio, caja, coordinación y administración | Construido (F3) |
| **Lo que el cliente usa para comprar** | **F4: no existe** |

**La respuesta corta a "¿es solo maquetar?":** no. Es sobre todo frontend, pero tiene **backend nuevo y obligatorio**: hoy ninguna lectura de la base de datos es pública (los visitantes sin sesión no pueden ver ni una tienda), y el cliente tampoco puede ver la información de seguimiento que necesita. Ese backend es chico (una o dos migraciones), pero va primero. Ver sección 4.

---

## 2. Punto de partida: qué existe hoy en la tienda

`apps/store` (puerto 3000) tiene nueve pantallas, todas de cuenta o institucionales:

| Pantalla | Para qué |
|---|---|
| `/` | Portada de marca: titular, botones «Crear cuenta» y «Ya tengo cuenta», bloque «¿Tienes un negocio?» y nota «el catálogo llega pronto» |
| `/ingresar`, `/registro`, `/recuperar`, `/recuperar/nueva`, `/auth/callback` | Acceso del cliente (correo y Google, Turnstile) |
| `/perfil` | Nombre y teléfono del cliente |
| `/vende` | Solicitud de afiliación de comercios |
| `/terminos`, `/privacidad` | Textos legales |

Lo que ya sirve y F4 reutiliza sin tocarlo:

- **Diseño «Ruta»** (`packages/ui`): botones, tarjetas, campos, insignias, estados vacíos, movimiento, navegación flotante en isla con cajón móvil, pie de página.
- **Sesión del cliente** (`requireCustomer`, `getSessionInfo`): la sesión dura hasta 24 horas; pasado ese plazo las vistas propias dejan de responder y la tienda lleva a ingresar. Hay un ayudante de **borradores** (`lib/draft.ts`) para no perder lo escrito en un formulario al volver a ingresar: sirve para el checkout.
- **Proxy** (`proxy.ts`): lista de rutas protegidas (`/perfil`, `/vende`, `/recuperar/nueva`); F4 agrega `/checkout` y `/pedidos`.
- **Instalable**: manifiesto, `sitemap.ts` (hoy solo páginas estáticas), `robots`, imagen para compartir.
- **Cabeceras de seguridad**: la CSP ya permite imágenes y conexiones al origen de Supabase (por tanto, imágenes de producto y llamadas a las funciones de borde) y bloquea `form-action` fuera del propio sitio, así que **la redirección a Stripe debe hacerse como navegación (`location`/enlace), nunca como formulario**.

---

## 3. La experiencia que hay que construir

### 3.1 Recorrido del cliente

1. **Explorar sin cuenta.** Entra por un enlace (WhatsApp, buscador) o por la portada. Ve las tiendas abiertas, entra a una, ve sus productos con foto y precio, busca y filtra por categoría. Si la tienda está cerrada, la ve pero no puede pedir, con el horario y el mensaje de cierre temporal.
2. **Armar el carrito.** Elige variante y cantidad, agrega, ve el total parcial en una barra fija (móvil) o lateral (escritorio). El carrito vive en el navegador, sin cuenta.
3. **Revisar y pagar.** Al pasar a pagar se le pide ingresar o crear cuenta; vuelve exactamente a su carrito. Completa dirección, teléfono y nota, elige **efectivo contra entrega** o **tarjeta**, ve el resumen con el envío y confirma.
4. **Pago con tarjeta.** Lo llevamos a la página de Stripe, paga y regresa a su pedido. Si cancela o falla, puede reintentar mientras no venza (30 minutos).
5. **Seguimiento.** Ve su pedido con el estado (por confirmar, confirmado, preparando, listo, en camino, entregado), el historial con hora, el motivo si se canceló o rechazó, y puede cancelarlo mientras esté por confirmar.
6. **Volver.** «Mis pedidos» con el historial y la posibilidad de repetir un pedido.

### 3.2 Pantallas nuevas

| Ruta | Pública | Contenido |
|---|---|---|
| `/tiendas` | Sí | Lista de tiendas activas: nombre, abierta o cerrada, costo de envío; filtro «abiertas ahora» |
| `/tiendas/[id]` | Sí | Cabecera de la tienda (horario, envío, estado), buscador, filtro por categoría y cuadrícula de productos |
| `/productos/[id]` | Sí | Galería, descripción, variantes con precio y disponibilidad, cantidad y «Agregar al carrito» |
| `/carrito` | Sí | Líneas, cantidades, quitar, total parcial, aviso de cambios de precio o stock, botón «Pagar» |
| `/checkout` | **Con sesión** | Dirección, teléfono, nota, método de pago, resumen y «Confirmar pedido» |
| `/pedidos` | **Con sesión** | Mis pedidos |
| `/pedidos/[id]` | **Con sesión** | Detalle y seguimiento; **ruta de retorno de Stripe** (`?pago=ok` o `?pago=cancelado`) |
| Portada `/` | Sí | Se reemplaza el aviso «el catálogo llega pronto» por tiendas abiertas ahora y los accesos al catálogo |

Y en la navegación flotante: un ícono de **carrito con contador**, y «Mis pedidos» junto a «Mi perfil».

### 3.3 Lo que no se construye en F4

Cupones y promociones, calificaciones y reseñas, propinas, pedidos programados, carrito con varias tiendas a la vez (ver decisión D1), notificaciones push, favoritos, seguimiento en mapa, la app del repartidor y las liquidaciones (F5 a F7).

---

## 4. Backend necesario

Es poco, pero **no se puede empezar el frontend sin él**.

### 4.1 Lectura pública del catálogo (obligatoria)

**El problema.** Todas las vistas del esquema `public` exigen sesión y el rol `anon` no tiene ni un permiso de lectura (se verificó en la base de datos). Además, una prueba de la base de datos (`010_baseline_guards`) **falla a propósito si `anon` puede ejecutar cualquier función o leer cualquier tabla de `public`**. La tienda pública es indexable y atiende a visitantes sin cuenta, así que hay que abrir una puerta **estrecha y deliberada**.

**La solución propuesta.** Funciones de solo lectura con `security definer` (como el resto del proyecto), ejecutables por `anon` y por `authenticated`, que devuelven solo lo que es público y nada más. Se prefieren funciones a vistas porque fuerzan filtros, paginación y topes, y porque exponen un contrato pequeño y estable.

| Función propuesta | Devuelve | Notas |
|---|---|---|
| `catalog_stores(p_open_only, p_limit, p_offset)` | Tiendas activas de comercios activos: id, nombre, dirección, **costo de envío**, abierta ahora, cierre temporal (fecha y motivo), cantidad de productos disponibles | Sin teléfono de contacto salvo decisión contraria |
| `catalog_categories(p_store)` | Categorías activas del catálogo maestro con cantidad de productos | Las categorías maestras hoy solo las leen administración y comercio |
| `catalog_products(p_store, p_category, p_query, p_limit, p_offset)` | Productos **publicados** con al menos una variante **activa** y disponible: id, nombre, tienda, categoría, precio mínimo, imagen de portada, disponible | Tope de 48 por página; búsqueda por nombre con el texto escapado |
| `catalog_product(p_product)` | Un producto: descripción, imágenes en orden, variantes (id, nombre, **precio**, disponible, `max_por_pedido`), estado de la tienda | **No devuelve SKU ni existencias exactas**, solo el máximo comprable (el menor entre las existencias y 99; nulo si no hay control de stock) |
| `quote_cart(p_store, p_items)` | Cotiza un carrito con precios, disponibilidad y envío **de ahora**, y una lista de **problemas** (variante agotada, producto ya no disponible, precio cambió, tienda cerrada) | Ejecutable por `anon`: la revisión del carrito ocurre antes de ingresar |

**Reglas que cada función debe cumplir** (y cada una con su prueba):
- Nunca devuelve borradores, archivados, variantes inactivas, tiendas inactivas, tiendas de comercios suspendidos ni productos de tiendas cerradas por completo (según se decida en D6).
- Nunca devuelve datos personales (teléfonos de contacto de comercios, cuentas, correos), costos internos, SKU ni cantidades exactas de inventario.
- Paginación obligatoria con tope duro: nadie puede volcar el catálogo completo de una sola vez.
- `search_path` fijo, sin SQL dinámico, `stable`.
- La lista de funciones permitidas para `anon` queda **explícita en la prueba de guardas** (`010`): se actualiza para permitir solo estas y seguir fallando ante cualquier otra.

**Rendimiento y abuso.** Las páginas públicas usan caché de Next por tiempo (por ejemplo 60 segundos) para que miles de visitas no sean miles de consultas; las consultas del catálogo necesitan índices por tienda y estado (ya existen en parte) y, para buscar, un índice de texto o de trigramas. Como la llave anónima es pública, conviene dejar anotado el riesgo de *scraping* y limitar por página; un límite de tasa serio es tema de producción (sección 11).

### 4.2 Idempotencia al crear el pedido (muy recomendada)

`create_order` hoy **no es idempotente**: un doble clic, un reintento de red o un regreso con el botón «atrás» puede crear dos pedidos y reservar stock dos veces. La corrección es chica: un parámetro opcional `p_client_ref uuid` (el navegador genera uno por intento de checkout) y una restricción única `(client_id, client_ref)`; si llega repetido, la función devuelve el pedido ya creado. Cambia la firma de una función ya probada, por lo que va con migración y prueba nuevas.

### 4.3 Seguimiento del pedido para el cliente

El cliente **ya puede leer** sus pedidos, renglones e historial (`orders_list`, `order_items_list`, `order_events_list` respetan que solo vea los suyos). Lo que falta decidir y cubrir:
- **Repartidor.** Hoy el cliente no puede leer repartidores. Recomendación: **mostrar solo «repartidor asignado»** sin nombre ni teléfono (privacidad y seguridad), sin cambios de backend.
- **Reintento de pago**: no requiere backend nuevo (la función `stripe-checkout` ya crea otra sesión y vence la anterior).
- **Cancelar**: ya existe (`set_order_status` permite al cliente cancelar mientras está sin pagar o por confirmar, con motivo).

### 4.4 Opcionales (decisiones D4 y D5)

- **Direcciones guardadas** del cliente: una tabla con sus direcciones y funciones para crearlas y borrarlas (con RLS y anonimización junto con la cuenta). Evita reescribir la dirección en cada pedido. Recomendado como mejora posterior.
- **Correos de estado del pedido** (pedido recibido, confirmado, en camino, entregado, cancelado): la bandeja de correos ya existe; faltan plantillas y los puntos donde se encolan. Recomendado un mínimo (pedido recibido y cancelado/rechazado) o dejarlo para después.

### 4.5 Resumen de migraciones

| Migración | Contenido | Obligatoria |
|---|---|---|
| 29 | Funciones públicas de catálogo, `quote_cart`, índices y actualización de la prueba de guardas | Sí |
| 30 | Idempotencia de `create_order` (`client_ref`) | Muy recomendada |
| 31 | Direcciones guardadas | Opcional |
| — | Plantillas de correo y encolado | Opcional |

---

## 5. Frontend: cómo se construye

### 5.1 Carrito

- **Dónde vive.** En el navegador (`localStorage`, con respaldo silencioso si no hay almacenamiento, como ya hace `draft.ts`). Una clave por tienda no hace falta si el carrito es de una sola tienda (D1).
- **Qué guarda.** Solo identificadores y cantidades: `{ tienda, líneas: [{ variante, cantidad }] }`. **Nunca precios**: los precios siempre se vuelven a pedir con `quote_cart`; guardar precios invitaría a mostrar valores viejos o manipulados.
- **Cuándo se valida.** Al abrir el carrito y al pasar a pagar (cotización). Si algo cambió, se muestra una lista clara («El precio de X cambió de A a B», «Y se agotó») y el cliente decide.
- **Un solo origen de verdad** para el contador de la navegación y las páginas (proveedor de contexto con sincronización entre pestañas).
- **Al ingresar** se conserva el carrito (vive en el navegador, no en la sesión).

### 5.2 Checkout y pedido

- Requiere sesión; si no hay, lleva a `/ingresar?next=/checkout` (ya soportado por `safeNext`), y vuelve.
- **Formulario**: dirección de entrega (obligatoria, 5 a 240 caracteres), teléfono (se precarga del perfil), nota opcional, método de pago. Validación con esquemas compartidos (`@rapitrip/validation`), con los mismos límites que la base de datos.
- **Resumen**: productos, subtotal, envío (de la tienda) y total, siempre de la última cotización.
- **Confirmar**: genera el `client_ref`, llama a `create_order`, y según el método:
  - *Efectivo*: va a `/pedidos/[id]` (queda **por confirmar**; el comercio tiene 45 minutos).
  - *Tarjeta*: llama a `stripe-checkout` con la sesión del cliente y **redirige** a la página de Stripe.
- **Errores que hay que traducir a mensajes humanos**: tienda cerrada, producto agotado entre el carrito y el pedido, más de 5 pedidos sin resolver, sesión vencida (se guarda un borrador del formulario y se lleva a ingresar), cuenta sin confirmar.
- Un botón de confirmar **que no se pueda pulsar dos veces** (estado de envío) además de la idempotencia del servidor.

### 5.3 Pago con tarjeta y retorno de Stripe

Esta parte tiene detalles que hay que cuidar:

1. `stripe-checkout` valida el **origen** del navegador contra `STORE_URL`: tienen que coincidir exactamente (por ejemplo, `http://127.0.0.1:3000` y no `localhost`). En producción es el dominio de la tienda.
2. El cliente vuelve a `/pedidos/[id]?pago=ok` **antes de que el webhook haya llegado** (puede tardar segundos). La pantalla no debe afirmar «pagado» por el parámetro de la URL: debe **consultar el estado real** y, si todavía está pendiente de pago, mostrar «Confirmando tu pago…» y consultar de nuevo unos segundos (con tope, por ejemplo 30 segundos), y después un mensaje honesto («si ya pagaste, tu pedido se actualizará en unos minutos»).
3. `?pago=cancelado`: el pedido sigue sin pagar hasta que venza; se ofrece **«Reintentar el pago»** (nueva sesión) y **«Cancelar el pedido»**.
4. Si el pedido ya venció (30 minutos), se explica y se invita a hacer uno nuevo; el stock ya se devolvió.
5. Un pago que llega tarde ya lo reembolsa el sistema solo (F3); la pantalla no necesita manejarlo.

### 5.4 Mis pedidos y seguimiento

- Lista paginada con número, tienda, estado, total y fecha; el pedido más reciente primero.
- Detalle con **línea de tiempo** del historial (`order_events_list`), productos, totales, forma de pago, dirección de entrega, motivo si se canceló o rechazó y, si aplica, cuánto tiempo queda para pagar o para que el comercio responda.
- **Cancelar** mientras esté por confirmar o sin pagar, pidiendo motivo.
- **Repetir pedido**: vuelve a cargar las líneas disponibles en el carrito.
- Actualización automática cada 30 segundos mientras la pestaña esté visible (igual que la consola).

### 5.5 SEO, rendimiento y PWA

- Las páginas públicas (tiendas y productos) son **indexables**: metadatos propios por página, URL canónica, datos estructurados de producto y tienda (*schema.org*) y `sitemap` dinámico con tiendas y productos. Carrito, checkout y pedidos llevan `noindex`.
- Las imágenes vienen del bucket público de Supabase; usar tamaños adecuados y carga diferida; el peso inicial de la portada ya se cuidó con la tipografía (`next/font`).
- Revalidación por tiempo, no por etiquetas: la consola y la tienda son aplicaciones separadas y una no puede invalidar la caché de la otra; 60 segundos es un buen punto de partida.
- Mantener el manifiesto instalable; no hace falta modo sin conexión en F4.

### 5.6 Diseño

Todo con el sistema «Ruta» ya existente: tarjetas de doble bisel, botones en píldora con la curva fluida, verde como color principal y azul como secundario, estados vacíos, de carga (esqueletos) y de error, y movimiento sobrio. **Móvil primero** (los clientes llegan por WhatsApp): objetivos táctiles de 44 px, barra de carrito fija abajo, formularios en una columna. Accesibilidad WCAG 2.2 AA verificada con axe en cada pantalla, como en las fases anteriores.

---

## 6. Decisiones pendientes

Cada una con una recomendación para no frenar el trabajo; se pueden cambiar al abrir la etapa correspondiente.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Carrito de una tienda o de varias? | Una sola tienda · varias con un pedido por tienda | **Una sola** en F4: coincide con «un pedido por tienda», evita cobrar varios pedidos de golpe y suma envíos confusos. Si el cliente agrega de otra tienda, se le avisa y elige. Varias tiendas, en una fase posterior |
| D2 | Métodos de pago | Efectivo y tarjeta · solo tarjeta | **Efectivo contra entrega y tarjeta** (ya soportados) |
| D3 | Costo de envío | Fijo por tienda (como hoy) · por distancia | **Fijo por tienda**; por distancia requiere mapas y es otra fase |
| D4 | Direcciones guardadas | Escribirla cada vez · libreta de direcciones | **Escribirla cada vez** en F4, libreta después |
| D5 | Correos de estado del pedido | Ninguno · mínimos · todos | **Mínimos** (recibido y cancelado/rechazado) o ninguno al inicio |
| D6 | Tienda cerrada: ¿se ve el catálogo? | Se ve y no se puede pedir · se oculta | **Se ve y no se puede pedir**, con horario y motivo |
| D7 | Nombre y teléfono del repartidor para el cliente | Mostrarlos · solo «asignado» | **Solo «asignado»** (privacidad) |
| D8 | Pedido mínimo | Sin mínimo · mínimo por tienda | **Sin mínimo** en F4 |
| D9 | Productos agotados | Ocultos · visibles como agotados | **Visibles como «Agotado»** en la ficha y ocultos en las listas de tienda (según `available`) |
| D10 | Cuenta obligatoria para ver precios | No · sí | **No**: la tienda es pública; solo se exige cuenta para pedir |
| D11 | ¿Turnstile en el checkout? | Sí · no | **No** al inicio (ya hay sesión confirmada y límite de 5 pedidos sin resolver); reevaluar si hay abuso |

---

## 7. Plan por etapas

Cada etapa con criterio de terminado: pruebas pasan, accesibilidad verificada y sin commits hasta que se apruebe, como en las fases anteriores.

| Etapa | Qué incluye | Terminada cuando |
|---|---|---|
| **1. Backend de lectura pública** | Migración 29: `catalog_*`, `quote_cart`, índices; actualizar la prueba de guardas; pgTAP de cada regla de la sección 4.1 | Un visitante sin sesión lee el catálogo; borradores, tiendas inactivas y comercios suspendidos **no** aparecen; la prueba de guardas sigue exigiendo que nada más sea público |
| **2. Catálogo público** | `/tiendas`, `/tiendas/[id]`, `/productos/[id]`, portada con tiendas abiertas, búsqueda y categorías, metadatos y `sitemap` dinámico | Se navega el catálogo sin cuenta en móvil y escritorio; las páginas se indexan; axe sin violaciones |
| **3. Carrito** | Proveedor de carrito, contador en la navegación, `/carrito`, cotización con avisos de cambios, regla de una sola tienda | El carrito sobrevive a recargar y a ingresar; avisa precios y stock cambiados |
| **4. Checkout con efectivo** | Migración 30 (idempotencia), `/checkout`, borrador al vencer la sesión, `/pedidos/[id]` básico, errores traducidos | Un cliente pide en efectivo de punta a punta; un doble clic no crea dos pedidos; el comercio lo ve en su consola |
| **5. Pago con tarjeta** | Llamada a `stripe-checkout`, redirección, retorno a `/pedidos/[id]` con consulta del estado real, reintento de pago y cancelar | Pago real en modo prueba con la tarjeta 4242 deja el pedido por confirmar; cancelar o dejar vencer libera el stock |
| **6. Mis pedidos y seguimiento** | `/pedidos`, línea de tiempo, cancelar con motivo, repetir pedido, actualización automática | El cliente sigue su pedido hasta entregado y ve el motivo si se rechazó |
| **7. Correos y pulido** *(opcional)* | Plantillas mínimas, estados de carga y error, rendimiento de imágenes, ajustes visuales | Revisión visual aprobada |
| **8. E2E, CI y puesta en marcha** | Pruebas de punta a punta con la tienda real, ampliación del CI y lista de producción (sección 11) | El CI en verde y la lista de producción completa |

---

## 8. Pruebas

| Nivel | Qué cubre |
|---|---|
| pgTAP | Cada función pública: qué muestra y, sobre todo, **qué no** (borradores, inactivos, suspendidos, SKU, inventario exacto); topes de paginación; `quote_cart` con todos los problemas; idempotencia de `create_order`; la prueba de guardas actualizada |
| Unitarias | Lógica del carrito (agregar, quitar, una sola tienda, topes por variante y por stock), formateo de precios, traducción de errores, esquemas de checkout |
| Componentes | Carrito, selector de variante y cantidad, formulario de checkout (validación, doble envío, sesión vencida con borrador) |
| E2E | Visitante navega y agrega; ingresa y confirma un pedido en efectivo; el comercio lo recibe (ya cubierto en la consola); pago con tarjeta de prueba y retorno (como los E2E de Stripe, manual); tienda cerrada; producto agotado entre el carrito y el pedido; cancelar; accesibilidad en cada pantalla |
| Accesibilidad y movimiento | axe en las nuevas páginas públicas, escritorio y móvil, dentro de las 35 pruebas que ya corre el CI |
| CI | Los E2E de la tienda se suman al trabajo `e2e-operaciones`; Stripe sigue manual |

---

## 9. Seguridad y privacidad

- **La base de datos decide.** Nada depende de que el navegador oculte algo: precios y disponibilidad se cotizan y validan en el servidor al crear el pedido; el carrito del navegador solo guarda identificadores.
- **Superficie pública mínima**: solo las funciones `catalog_*` y `quote_cart`; la prueba de guardas lo exige.
- **Datos personales**: la dirección y el teléfono de entrega se guardan en una tabla aparte que el comercio y el cajero no leen y que se borra al anonimizar la cuenta (ya construido). La tienda no los muestra a nadie más que al cliente dueño.
- **Pagos**: los datos de tarjeta nunca pasan por Rapitrip (página alojada de Stripe). La confirmación del pago solo se acepta por el webhook firmado, nunca por el parámetro de la URL de retorno.
- **Abuso**: tope de 5 pedidos sin resolver por cliente, paginación con topes, y límite de tasa en producción (sección 11).
- **Legal**: antes de cobrar de verdad hay que **revisar y completar** los términos con las condiciones de compra, entrega, cancelación y reembolso, y la política de privacidad con los datos de entrega y pago (Ley 787). Es un trabajo de una persona abogada, fuera del código.

---

## 10. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Doble clic o reintento crea dos pedidos | Doble reserva de stock | Idempotencia (migración 30) y botón con estado de envío |
| Precio o stock cambia entre el carrito y el pedido | Cobro distinto al que vio el cliente | Cotizar siempre al pasar a pagar y avisar; el servidor usa el precio vigente |
| El cliente vuelve de Stripe antes que el webhook | Pantalla dice «sin pagar» o miente | Consultar el estado real con reintentos y un mensaje honesto |
| La sesión del cliente vence (24 h) en pleno checkout | Pierde lo escrito | Borrador del formulario (`draft.ts`) y regreso a `/checkout` |
| Lectura pública se abusa (*scraping*) | Carga y copia del catálogo | Paginación con topes, caché por tiempo, límite de tasa en producción |
| Una función pública filtra algo privado | Fuga de datos | Contrato mínimo, pgTAP de lo que **no** devuelve y revisión de seguridad antes de publicar |
| Origen distinto entre `STORE_URL` y el navegador | `stripe-checkout` rechaza por CORS | Configuración documentada y comprobada en los E2E |
| Moneda de liquidación con Stripe sin confirmar | Conversión inesperada en producción | Confirmarlo con Stripe antes de salir (sección 11) |
| Imágenes pesadas | Tienda lenta en móvil | Tamaños adecuados, carga diferida y revisión de peso |

---

## 11. Puesta en marcha (no es código de la app)

Para que F4 salga a producción hace falta, además de las etapas:

1. **Revisión legal** de términos y privacidad (Ley 787) con las condiciones de compra y reembolso.
2. **Proyecto de Supabase en producción** con las migraciones aplicadas y las variables públicas de las dos apps.
3. **Stripe en producción**: cuenta aprobada, **confirmar la moneda de liquidación** (hoy la cuenta de pruebas es de México y los cobros se presentan en córdobas), crear el **endpoint del webhook** (`https://<proyecto>.supabase.co/functions/v1/stripe-webhook`) con los eventos `checkout.session.completed` y `checkout.session.expired`, y cargar la clave secreta y el secreto de firma como secretos de las funciones.
4. **Programador de `process-refunds`**: algo que llame a la función cada minuto con la cabecera `x-outbox-secret` (igual que `send-outbox`); sin él, los reembolsos de pedidos cancelados no se ejecutan.
5. **Resend** con dominio verificado si se envían correos; **Google** y **Turnstile** con credenciales reales; rotar el secreto de Google que se compartió.
6. **Dominios y Vercel**: dos proyectos (tienda y consola) con sus variables, `STORE_URL` y `NEXT_PUBLIC_SITE_URL` iguales al dominio real.
7. **Límite de tasa** sobre las funciones públicas y el inicio de sesión (en el proveedor o en el borde).
8. **Datos reales**: al menos un comercio aprobado con tienda, horario, productos con foto y precio, y un repartidor.
9. **Prueba de humo en producción** con un pedido real de monto mínimo en cada método de pago, y el reembolso de uno.
10. **Respaldo y recuperación**: respaldo diario ya previsto (plan Pro) y la prueba de restauración.

El `.env.example` de la raíz ya indexa las credenciales y dónde se consiguen.

---

## 12. Tamaño relativo del trabajo

Sin fechas: es una medida para comparar etapas, no una promesa.

| Etapa | Tamaño | Por qué |
|---|---|---|
| 1. Backend de lectura pública | Pequeña a media | Funciones de lectura y mucha prueba (lo delicado es **qué no mostrar**) |
| 2. Catálogo público | Media a grande | Varias pantallas nuevas, SEO e imágenes |
| 3. Carrito | Media | Lógica de estado y de validación; poca interfaz |
| 4. Checkout con efectivo | Media | Formulario, errores, borrador, idempotencia |
| 5. Pago con tarjeta | Pequeña a media | La integración ya existe; falta la interfaz y el manejo del retorno |
| 6. Mis pedidos y seguimiento | Media | Lista, línea de tiempo y cancelar |
| 7. Correos y pulido | Pequeña (opcional) | Plantillas y ajustes |
| 8. E2E, CI y salida | Media | Pruebas largas y la lista de producción, que depende de terceros |

---

## 13. Qué se necesita de ti antes de empezar

1. **Responder las decisiones D1 a D11** (o aceptar las recomendaciones tal cual).
2. **Confirmar si F4 incluye correos y libreta de direcciones** (D4 y D5) o quedan para después.
3. **Tener un comercio de prueba real** con productos y fotos, o decidir que se use el de pruebas del entorno local.
4. Para la salida a producción: abogado, cuenta de Stripe de producción, dominio y credenciales (sección 11). Ninguna bloquea las etapas 1 a 6.

Con las decisiones tomadas, la **etapa 1** (backend de lectura pública) se puede abrir de inmediato: es la que desbloquea todo lo demás.
