# Revisión del plan del repartidor: cambios del repo, evidencias, móvil y consolas

Managua, 23 de octubre de 2026
Tipo de documento: revisión y diseño, previo a construir. **No hay código del repartidor todavía.**
Base: `main` hasta «Dashboard de repartidor» (migraciones 1 a 70).
Reemplaza en lo que se contradiga a `Informe_Fase_5_App_Repartidor.md` y a `2026-10-22-repartidor-ofertas-y-push-design.md`.

---

## 1. Qué cambió en el repo desde que se planificó

El plan anterior se escribió sobre las migraciones 1 a 32. Desde entonces entraron 38 migraciones y 297 archivos. Esto es lo que afecta al repartidor.

| # | Qué cambió | Efecto en el plan del repartidor |
|---|---|---|
| 1 | **Numeración.** Las migraciones 33 a 70 ya están usadas (tipos de comercio, mapas, zonas, cotización, caja, devoluciones, checkout, validación, métricas). | Las del repartidor empiezan en la **71**. Las pruebas pgTAP, en la 520. |
| 2 | **Clases de entrega.** Cada pedido es `express` o `programado`. El repartidor tiene `vehicle_class` (`moto` / `vehiculo`) y `department`. `assign_order_courier` ya exige que el repartidor sea compatible (migración 62). | Una **oferta solo puede ir a un repartidor compatible**, y se vuelve a validar al aceptar. No se duplica la regla: se reutiliza la de `assign_order_courier`. |
| 3 | **Estado nuevo `en_validacion`** y plazos por clase. | No cambia al repartidor (solo ve pedidos desde `confirmado`). Hay que probar que no ve pedidos en validación. |
| 4 | **Efectivo ya construido** (migración 48): `register_courier_cash` genera el código `CE-XXXXXX` y **ya acepta al repartidor vinculado** (`couriers.user_id`); `receive_courier_cash` lo recibe el cajero. La pantalla `/repartidor` de la consola es declaradamente «temporal». | La tabla `sales.courier_cash` del informe F5 **ya no hace falta**: se usa lo existente. La pantalla temporal pasa a ser el panel de seguimiento real. |
| 5 | **Nombre de ruta.** La consola ya usa `/repartidor` para «Efectivo de repartidores». | La app del repartidor va en `apps/courier` (otra aplicación), así no hay choque. Esa pantalla de la consola se renombra a `/coordinacion/efectivo`. |
| 6 | **Mapas** (`@rapitrip/maps`, `order_route_points`, componente `OrderRoute`, Mapbox). | Se reutiliza el paquete en la app del repartidor. **Ojo:** `order_route_points` solo responde a coordinación; el repartidor necesitará una versión limitada a *sus* pedidos abiertos. |
| 7 | **Estadísticas de repartidores** (`courier_stats`, `courier_daily`, migración 70). Sus kilómetros son los *cotizados*, no los reales, «hasta que exista su aplicación». | Las marcas de tiempo de las evidencias alimentan estas métricas con datos reales (tiempo de recogida a entrega). |
| 8 | **Reclasificación** express → programado por coordinación, ya existente. | El repartidor necesita un botón **«No cabe en mi vehículo»** que avise a coordinación y la lleve a reclasificar. |
| 9 | **Fotos privadas** ya tienen patrón (bucket `devoluciones`, migración 55: carpeta por usuario, lectura solo para administración). | El bucket de evidencias copia ese patrón. |
| 10 | **Datos de demostración** (`supabase/demo/entregas_demo.sql`). | Sirven para sembrar pedidos en pruebas manuales. |
| 11 | El rol `repartidor` **sigue sin existir** y `identity.invitations` sigue limitado a `admin`, `cajero`, `coordinador`. | Se mantiene la etapa de rol, cuenta y disponibilidad. |
| 12 | La consola es **de escritorio primero** (barra lateral de 264 px desde `lg`). | Confirma que el repartidor va en una app aparte (sección 3). |

**A verificar al empezar:** `set_order_status` se redefinió en las migraciones 62 y 65. El núcleo de transiciones se extrae a partir de la **última** definición, con las pruebas 250 y 430 intactas. Hoy `en_camino` y `entregado` siguen siendo solo de coordinación.

Detalle menor: `courier_daily` agrupa por hora de `America/Costa_Rica` y el resto del proyecto usa `America/Managua`. Tienen el mismo desfase sin horario de verano, así que hoy no da error, pero conviene unificarlo.

---

## 2. Cadena de evidencias del pedido

**Principio:** cada pedido tiene una cadena de evidencias desde que el comercio se lo entrega al repartidor hasta que el repartidor lo entrega al cliente. La base de datos **no deja avanzar** un paso si falta su evidencia; la coordinación puede saltarla solo con motivo, y queda marcado.

### 2.1 Qué se registra en cada paso

| Paso | Quién | Evidencia | Qué prueba |
|---|---|---|---|
| **Asignación** | Sistema | Oferta, aceptación y horas | Quién aceptó el pedido y cuándo |
| **Entrega del comercio al repartidor (recogida)** | Comercio + repartidor | **Código de recogida** que el comercio ve en su consola y el repartidor escribe, **más foto** del paquete con el número de pedido visible, **más conteo** de bultos | El repartidor estuvo en la tienda y recibió el pedido completo y sellado |
| **En camino** | Sistema | Hora (ya está en `order_events`) | Tiempos de ruta |
| **Entrega al cliente** | Repartidor + cliente | **Código de entrega** que ve el cliente, **más foto** del paquete en el lugar, **más ubicación** en ese instante | El cliente recibió; el paquete llegó al punto marcado |
| **Entrega fallida** | Repartidor | Foto, motivo, ubicación y, si vuelve a la tienda, nueva foto de devolución | Que se intentó y por qué no se pudo |
| **Efectivo** | Repartidor → cajero | Código `CE-XXXXXX` (ya existe), monto cobrado y hora | Cuánto cobró y cuándo lo rindió |

**Por qué dos códigos y no solo fotos:** la foto se puede tomar en otro sitio; el código solo lo conoce quien está presente (el comercio en la tienda, el cliente en su puerta). Juntos son la prueba más difícil de falsificar.

### 2.2 Reglas que aplica la base de datos

1. `courier_pick_up` exige código de recogida correcto y la foto de recogida subida.
2. `courier_deliver` exige código de entrega correcto y la foto de entrega subida. En efectivo, exige además el monto cobrado y registra el código `CE`.
3. La ubicación se toma **solo en el instante de la evidencia** (no hay seguimiento continuo). Si queda a más de 150 m del punto marcado por el cliente, se **marca para revisión**, pero no bloquea: el GPS falla en interiores.
4. Las evidencias son **de solo adición**: no se editan ni se borran desde ninguna cuenta. La hora la pone el servidor, no el teléfono.
5. Si la coordinación entrega o despacha por el repartidor (sin cuenta, o por una falla), debe indicar motivo, y el pedido queda **«sin evidencia completa»**.
6. Se guarda el **código `sha-256`** de cada foto al subirla, para poder demostrar que no cambió.

### 2.3 Datos nuevos

- **Bucket privado `entregas`**, patrón de `devoluciones`: el repartidor sube solo a su carpeta y no puede leer ni borrar; leen administración y coordinación con enlaces firmados de corta duración.
- **`sales.delivery_evidence`**: pedido, repartidor, tipo (`recogida`, `entrega`, `fallida`, `devolucion_tienda`), ruta del archivo, hash, hora del servidor, ubicación opcional, distancia al punto, nota y marca de revisión. Sin acceso directo: lectura por vistas `security_invoker`.
- **`sales.order_codes`**: códigos de recogida y de entrega (4 dígitos), generados al pasar el pedido a `listo` y `en_camino`, en una tabla con acceso restringido. Nunca se escriben en la auditoría.
- **`sales.evidence_settings`** (una fila, como `delivery_class_settings`): qué evidencias son obligatorias, distancia de alerta, vigencia de las ofertas y plazo de conservación. Lo edita la administración.

### 2.4 Qué ve cada quien

| Quién | Ve |
|---|---|
| Administración | Todas las evidencias, fotos y alertas |
| Coordinación | Todas las evidencias de los pedidos en curso y del historial |
| Comercio | Solo la evidencia de **recogida** de sus pedidos. No la de entrega: mostraría el domicilio del cliente |
| Cliente | La foto de entrega y la hora de **su** pedido |
| Repartidor | Sus propias evidencias mientras el pedido está abierto y por unos días |
| Cajero | El código `CE` y el monto del pedido, no las fotos |

### 2.5 Privacidad

Las fotos pueden mostrar casas, vehículos o personas. Por eso: la guía pide fotografiar **el paquete y el número**, no a personas; la ubicación es puntual; las fotos se conservan un plazo definido (decidido: 3 meses, o más si hay devolución o disputa abierta); y se incluyen en la exportación de datos y en la anonimización. Pendiente revisar con quien asesore en lo legal (Ley 787) el consentimiento del repartidor y el aviso al cliente.

### 2.6 Señal inestable

Subir una foto con mala señal es el punto frágil. La app reduce la foto en el teléfono (alrededor de 300 KB), la guarda localmente (IndexedDB) y reintenta con barra de progreso. **El paso no se completa hasta que la foto está subida**, pero el repartidor no pierde lo capturado si se cae la conexión. Propuesta a decidir: permitir «entregar ahora, subir luego» solo por un tiempo corto (30 minutos), quedando el pedido marcado como «evidencia pendiente».

---

## 3. App del repartidor pensada para el teléfono

Decisión: **`apps/courier`, aplicación aparte, móvil primero**. La consola de escritorio no sirve para esto y duplicarla con reglas móviles la volvería frágil.

| Aspecto | Requisito |
|---|---|
| Anchos | Se diseña de **360 a 430 px**; tableta y escritorio son secundarios (columna centrada de hasta 640 px) |
| Toque | Botones y filas de al menos **48 px**; acción principal fija abajo, al alcance del pulgar; sin acciones que dependan de pasar el cursor |
| Pantalla | `100dvh` y márgenes seguros (*safe-area*) para los teléfonos con muesca; orientación vertical |
| Exteriores | Contraste alto, texto grande, modo oscuro; los estados críticos con ícono y texto, no solo color |
| Cámara | `<input type="file" accept="image/*" capture="environment">`: abre la cámara en Android y en iPhone sin pedir permisos extra |
| Ubicación | API de geolocalización, solo cuando se captura evidencia, con aviso previo |
| Instalación | Manifiesto `standalone`, iconos, *service worker* (push y caché de la estructura) |
| Rendimiento | Pantallas ligeras, imágenes comprimidas, esqueletos de carga; que sirva en un teléfono de gama baja con datos móviles |
| Mapas | `@rapitrip/maps` solo en el detalle del pedido y cargado bajo demanda; botón «Abrir en mapas» con la dirección |
| Sesión | Hasta 12 horas, con cierre inmediato si se desactiva la ficha |
| Pruebas | Playwright con **Pixel 5 y iPhone 13**, red lenta simulada, axe en cada pantalla, y prueba de cámara con archivo de ejemplo |

**Pantallas:** Inicio (disponibilidad, oferta pendiente, pedido actual), Oferta, Detalle del pedido (ruta, productos, cobro), Recoger (código, foto, conteo), Entregar (código, foto, monto), Problema, Historial y efectivo, Perfil.

---

## 4. Cómo se conecta con la consola de coordinación y la de administración

Todo lo que hace el repartidor se ve en las consolas que ya existen; no se crea un sistema paralelo.

### 4.1 Coordinación (`/coordinacion`)

| Pantalla | Cambio |
|---|---|
| **Pedidos** (`dispatch-workspace`) | Botón **«Proponer a repartidor»** (solo compatibles por vehículo y departamento), estado de la oferta con cuenta regresiva, aviso cuando se rechaza o vence, retirar oferta. «Asignar directamente» se conserva como excepción con motivo |
| **Detalle del pedido** | **Línea de tiempo con evidencias**: asignado → aceptó → recogió (código y foto) → en camino → entregó (código, foto, distancia al punto) → efectivo `CE` → recibido en caja. Con alertas visibles |
| **Repartidores** (`/coordinacion/repartidores`) | Disponible o no, si tiene avisos activados, oferta abierta, pedido actual, última actividad |
| **Resumen y estadísticas** | `courier_stats` pasa a usar tiempos reales de recogida y entrega; aceptación, rechazo y vencimiento de ofertas |
| **Efectivo** (hoy `/repartidor`, «pantalla temporal») | Se renombra a `/coordinacion/efectivo`, se retira el aviso de «temporal» y pasa a **seguir** lo que registra cada repartidor, con diferencias visibles |
| **Reclasificación** | Llega con la petición del repartidor «No cabe en mi vehículo» |
| **Incidencias** | Entregas fallidas y problemas reportados, para decidir qué hacer |

### 4.2 Administración (`/admin`)

| Pantalla | Cambio |
|---|---|
| **Repartidores** | «Invitar» desde la ficha, estado de cuenta, dispositivos con avisos, **revocar acceso y cerrar sesiones** |
| **Pedidos** | Mismo panel de línea de tiempo y evidencias, con fotos |
| **Excepciones** | Nuevas reglas: entregado sin evidencia completa, ubicación lejos del punto, entrega demasiado rápida tras recoger, oferta vencida repetidamente |
| **Devoluciones** | Al revisar una devolución, enlace a la evidencia de entrega del pedido |
| **Configuración** | Editar `evidence_settings` (obligatoriedad, distancia, vigencia de oferta, conservación) |
| **Auditoría** | Etiquetas nuevas (`order.offer_*`, `order.evidence_*`, `courier.account_*`) |

### 4.3 Comercio y caja

- **Comercio:** en el detalle de un pedido `listo` ve su **código de recogida** y, tras la recogida, la foto y la hora. Sin acción nueva obligatoria.
- **Caja:** al recibir efectivo ve el código `CE`, el repartidor y la hora de entrega. Sigue sin ver fotos.

---

## 5. Plan actualizado

Las migraciones empiezan en la 71. Cada una con su pgTAP.

| Etapa | Migraciones | Qué incluye | Terminada cuando |
|---|---|---|---|
| **1. Rol, cuenta y disponibilidad** ✅ *hecha el 23-oct-2026* | 71 (valor del rol), 72 (invitación, vínculo, `is_courier_session`, disponibilidad) | Invitar desde la ficha, `accept-invitation`, revocación | Un repartidor invitado entra; sin ficha activa pierde acceso; nadie fuera de administración otorga el rol |
| **2. Lectura de sus pedidos** ✅ *hecha el 23-oct-2026* | 73 | Núcleo de transiciones extraído de la última `set_order_status`; funciones de lectura del repartidor (no vistas: ver `backend-referencia.md`, sección 13) con las coordenadas de ruta limitadas a sus pedidos abiertos | Ve solo lo asignado y compatible; datos del cliente solo mientras el pedido está abierto |
| **3. Ofertas** ✅ *hecha el 23-oct-2026* | 74 | Tabla, funciones, cron de vencimiento, compatibilidad por vehículo | Una oferta se acepta, rechaza, vence y cancela sin doble asignación |
| **4. Evidencias** ✅ *hecha el 23-oct-2026* | 75 | Bucket `entregas`, `delivery_evidence`, `order_codes`, `evidence_settings`, vistas por rol | Evidencia de solo adición; cada rol ve solo lo suyo |
| **5. Acciones del repartidor** ✅ *hecha el 23-oct-2026* | 76 | `courier_pick_up`, `courier_deliver`, problema, devolver, «no cabe», uso de `register_courier_cash` | No se avanza sin código y foto; la coordinación puede saltar con motivo y queda marcado |
| **6. Push** | 77 | Suscripciones, cola, `send-push`, claves VAPID | Una oferta nueva suena en el teléfono (Android y iPhone instalado) |
| **7. App `apps/courier`** | — | Todas las pantallas móviles, cámara, ubicación puntual, cola local de subida | Recorrido completo desde un teléfono real |
| **8. Consolas** | 78 (lecturas y excepciones) | Todo lo de la sección 4 | Coordinación y administración operan y auditan el ciclo completo |
| **9. Pruebas y salida** | — | E2E en móvil, red lenta, axe, CI, lista de prueba manual de push y cámara | CI en verde; prueba de humo con un repartidor real |

Se mantiene del informe F5: no hay seguimiento continuo de ubicación, la asignación automática queda fuera y las liquidaciones al repartidor son de la fase de liquidaciones.

---

## 6. Decisiones que necesito de ti

Con mi recomendación para que no frenen el trabajo.

| # | Decisión | Recomendación |
|---|---|---|
| E1 | ¿Foto obligatoria en la recogida y en la entrega? | **Sí a las dos**; la coordinación puede saltarla con motivo |
| E2 | ¿Código de recogida (comercio) y de entrega (cliente)? | **Sí a los dos** |
| E3 | ¿Ubicación puntual al tomar la evidencia? | **Sí**, solo como alerta, nunca bloquea |
| E4 | ¿Qué ve el cliente de la evidencia? | Foto y hora de **su** entrega |
| E5 | ¿Qué ve el comercio? | Solo la recogida de sus pedidos |
| E6 | Conservación de las fotos | **3 meses** (decidido por almacenamiento), más si hay devolución o disputa |
| E7 | Con mala señal: ¿bloquear hasta subir la foto o permitir «subir luego»? | **Bloquear**, con foto comprimida y cola local; permitir «subir luego» solo 30 min si lo ves necesario |
| E8 | ¿Se puede entregar a un tercero (vecino, portero)? | Sí, con el código y nota de quién recibió |
| E9 | Distancia de alerta de ubicación | 150 m |

Pendientes que ya tenías: manejo real del efectivo (quién recibe, cuándo, qué se hace con una diferencia), correo con dominio verificado, dirección de recogida de cada tienda, y revisión legal de las fotos.
