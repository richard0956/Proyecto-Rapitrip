# Diseño: ofertas de pedido y avisos push al repartidor

Managua, 22 de octubre de 2026
Tipo de documento: diseño acordado, previo a construir. **No hay código todavía.**
Complementa a `Informe_Fase_5_App_Repartidor.md`. Donde este documento y ese informe se contradigan, manda este.

> **Actualización 23-oct-2026:** tras los cambios de `main` (migraciones 33 a 70), la numeración de migraciones, el plan por etapas y las evidencias están en `2026-10-23-repartidor-revision-evidencias-y-consolas.md`, que prevalece sobre las secciones 9 y 10 de este documento.

---

## 1. Qué cambia respecto al informe de Fase 5

| Tema | Informe F5 | Este diseño |
|---|---|---|
| D6: ¿el repartidor acepta o rechaza? | No acepta; la coordinación asigna | **Sí**: la coordinación *propone* y el repartidor acepta o rechaza |
| D12: avisos | Consulta cada 30 s; push como mejora posterior | **Push web desde el inicio**, con consulta periódica como respaldo |
| Asignación directa | Único camino | Se **conserva** como excepción de la coordinación (repartidor sin cuenta, urgencias) |

Decisiones tomadas con el negocio:

- **Modelo A:** cada oferta va a **un repartidor a la vez**. Si rechaza o no responde a tiempo, la coordinación la ofrece a otro.
- Los demás parámetros (sección 2) son valores por defecto propuestos; se pueden cambiar sin rehacer el diseño.

## 1.1 Principio: plataforma 100 % web

No hay aplicación nativa ni tienda de aplicaciones. El repartidor usa una **página web** (`apps/courier`) y la notificación la envía la plataforma web de Rapitrip mediante **Web Push**, un estándar de los navegadores, sin Firebase ni servicios de terceros propios.

- **Quién envía:** la coordinación propone en la consola, el servidor encola el aviso y la función de borde `send-push` lo envía al navegador del repartidor.
- **Dónde llega:** Android (Chrome), computador (Chrome, Edge, Firefox; Safari en macOS 13 o más) y iPhone (iOS 16.4 o más).
- **Única diferencia por dispositivo:** en iPhone el permiso de avisos exige antes «Añadir a pantalla de inicio» (la misma web, instalada una vez). En Android y computador basta con abrir la página y aceptar los avisos.
- La app debe poder usarse también desde un computador, sin depender de funciones exclusivas del móvil.

## 2. Parámetros por defecto

| Parámetro | Valor | Dónde se cambia |
|---|---|---|
| Vigencia de una oferta | 3 minutos | Constante en la base de datos |
| Motivo al rechazar | Opcional, con lista corta (muy lejos, sin vehículo disponible, fuera de turno, otro) | Interfaz |
| Ofertas abiertas por pedido | Una sola | Índice único parcial |
| Ofertas abiertas por repartidor | Una sola a la vez | Índice único parcial |
| Dónde vive la app | `apps/courier` (tercera aplicación) | Ver informe F5, sección 5.1 |
| Quién puede ofrecer | Coordinación (y administración) | Reglas de la función |

## 3. Flujo

```
Coordinación elige pedido ──► propone a repartidor X
                                   │
                  oferta "pendiente" (vence en 3 min) + push a X
                                   │
        ┌──────────────┬───────────┴───────────┐
     acepta         rechaza                  vence
        │              │                        │
  oferta "aceptada"  oferta "rechazada"   oferta "vencida"
  se asigna el       (motivo opcional)    (la marca un cron)
  pedido a X              │                        │
        │                 └──► coordinación ve la alerta y propone a otro
  flujo normal de F5
  (recoger, entregar)
```

Reglas:

1. Solo se puede ofrecer un pedido `confirmado`, `preparando` o `listo` que **no tenga repartidor** y no tenga otra oferta abierta.
2. Solo se puede ofrecer a un repartidor con ficha **activa**, cuenta vinculada y **disponible**, sin otra oferta abierta.
3. **Aceptar** es atómico: dentro de una sola transacción se verifica que la oferta siga pendiente y vigente y que el pedido siga sin repartidor, y se asigna. Si algo cambió (la coordinación canceló la oferta, el pedido se canceló), el repartidor ve un mensaje claro y no pasa nada.
4. Si el pedido se cancela o se asigna directamente mientras hay una oferta abierta, la oferta pasa a `cancelada`.
5. Si el repartidor se desactiva o se desvincula con una oferta abierta, pasa a `cancelada`.
6. Rechazar y vencer **no** cambian el pedido; solo generan una alerta para coordinación.
7. Todas las acciones son idempotentes: aceptar dos veces por mala señal no rompe nada.

## 4. Backend

### 4.1 Tabla de ofertas

`sales.order_offers`:

| Columna | Notas |
|---|---|
| `id`, `order_id`, `courier_id` | Referencias |
| `status` | `pendiente`, `aceptada`, `rechazada`, `vencida`, `cancelada` |
| `offered_by`, `offered_at`, `expires_at` | Quién y cuándo; `expires_at = offered_at + 3 min` |
| `responded_at`, `reject_reason` | Opcional, máximo 200 caracteres |

Índices únicos parciales sobre `status = 'pendiente'`: uno por `order_id` y otro por `courier_id`. Sin acceso directo a la tabla: lectura solo por vistas `security_invoker`, como el resto del proyecto.

### 4.2 Funciones

Todas `security definer`, con `search_path = ''` y auditoría sin datos personales; ejecutables por `authenticated`, **no** por `anon`.

| Función | Quién | Qué hace |
|---|---|---|
| `offer_order_to_courier(p_order, p_courier)` | Coordinación | Crea la oferta y encola el push |
| `cancel_order_offer(p_offer)` | Coordinación | Retira una oferta pendiente |
| `courier_accept_offer(p_offer)` | Repartidor dueño | Acepta y asigna (reutiliza `assign_order_courier`) |
| `courier_reject_offer(p_offer, p_reason)` | Repartidor dueño | Rechaza |
| `private.expire_stale_offers()` | `pg_cron` cada minuto | Marca vencidas y genera la alerta |

El repartidor ve solo **datos mínimos** de la oferta: tienda de recogida, zona o barrio de entrega, total a cobrar si es en efectivo y tiempo restante. La dirección exacta y el teléfono del cliente siguen apareciendo únicamente cuando el pedido ya es suyo (informe F5, sección 4.2).

### 4.3 Suscripciones y cola de push

- `identity.push_subscriptions`: `user_id`, `endpoint`, claves `p256dh` y `auth`, agente de usuario, fecha. Un endpoint es único. Cada usuario solo ve y borra las suyas.
- `ops.push_outbox`: mismo patrón que `email_outbox`. Cada fila lleva destinatario, tipo (`oferta_nueva`, `oferta_cancelada`), `offer_id` y estado de envío. **El contenido de la notificación es genérico** («Tienes una propuesta de pedido»); no lleva dirección ni datos del cliente.
- Función de borde `send-push`, equivalente a `send-outbox`: lee la cola, envía con Web Push y claves VAPID, y **borra la suscripción** cuando el servicio responde que ya no existe (404 o 410).
- Disparo: `offer_order_to_courier` inserta en la cola; un cron de un minuto o un `pg_net` llama a la función de borde. Se mantiene el mismo mecanismo que ya use `send-outbox` para que haya una sola forma de hacerlo.

### 4.4 Secretos

Par de claves VAPID (pública para el navegador, privada solo en los secretos de la función de borde). Se documentan en `.env.example` como las demás credenciales.

## 5. Frontend (`apps/courier`)

- **PWA instalable:** manifiesto, iconos y *service worker* con el manejador de `push` y de `notificationclick`.
- **Alta de avisos:** tras iniciar sesión, una pantalla explica para qué sirven los avisos y un botón «Activar avisos» pide el permiso (en iPhone el permiso solo se puede pedir tras un toque). Si lo niega, se muestra cómo reactivarlo y la app sigue funcionando con consulta periódica.
- **Pantalla de oferta:** tarjeta grande con cuenta regresiva, resumen mínimo y dos botones: **Aceptar** y **Rechazar** (con lista corta de motivos).
- **Respaldo sin push:** la lista se vuelve a consultar cada 15 segundos mientras la app está visible, y al volver a primer plano. Una oferta pendiente siempre aparece arriba, haya llegado el push o no.
- **Instrucciones por plataforma:** en iPhone, guía corta para «Añadir a pantalla de inicio»; en Android, el propio navegador ofrece instalar.

## 6. Cambios en la consola (coordinación)

- Acción **«Proponer a repartidor»** en cada pedido sin repartidor, con la lista de repartidores disponibles (indicando quién ya tiene una oferta abierta).
- Estado visible de la oferta con cuenta regresiva: «Esperando a Ana (2:10)».
- Alerta cuando una oferta es **rechazada o vence**, con el motivo si lo hay, y botón para proponer a otro.
- Botón para **retirar** una oferta pendiente.
- «Asignar directamente» se conserva para repartidores sin cuenta o urgencias.
- Etiquetas nuevas en `lib/audit-labels.ts`.

## 7. Seguridad y privacidad

- La base de datos decide: cada función valida que la oferta sea de ese repartidor, que esté vigente y que el pedido siga libre.
- La notificación push viaja por servicios de terceros (Google, Apple, Mozilla): **no lleva datos personales**, solo un aviso genérico.
- La suscripción es dato personal ligado a un dispositivo: se borra al desactivar al repartidor, al cerrar sesión y al anonimizar la cuenta (se añade al flujo de anonimización y a la exportación de datos).
- Auditoría: ids, estados y motivos; nunca direcciones ni teléfonos.
- Límite de ofertas por minuto por coordinador para evitar abuso o errores en bucle.

## 8. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| El push llega tarde o no llega (ahorro de batería, permiso negado) | Oferta vence sin ser vista | Consulta periódica de respaldo; la coordinación ve el vencimiento y reofrece |
| iPhone sin la app instalada | No hay push | Guía de instalación en el primer ingreso; la coordinación sabe quién tiene avisos activos |
| Dos acciones a la vez (aceptar mientras coordinación retira) | Pedido asignado dos veces | Aceptar es atómico y los índices únicos lo impiden |
| Suscripciones vencidas acumuladas | Envíos fallidos | Limpieza automática al recibir 404 o 410 |
| Repartidores que rechazan o ignoran siempre | Pedidos que tardan | Métricas de aceptación en el tablero (F6) |

## 9. Plan por etapas

Sustituye y amplía el plan del informe F5, sección 7.

| Etapa | Qué incluye | Terminada cuando |
|---|---|---|
| 1. Rol, cuenta y disponibilidad | Igual que en F5 | Igual que en F5 |
| 2. Lectura de sus pedidos | Igual que en F5 | Igual que en F5 |
| **3. Ofertas** | Tabla, funciones, vistas, cron de vencimiento y pgTAP | Una oferta se acepta, rechaza, vence y cancela; nadie asigna dos veces |
| **4. Push** | Suscripciones, cola, `send-push`, VAPID, service worker | Una oferta nueva hace sonar el teléfono con la app cerrada (Android) e instalada (iPhone) |
| 5. App base y avance de estados | `apps/courier` con pantalla de oferta y flujo de recoger y entregar | Oferta, aceptación, recogida y entrega de punta a punta |
| 6. Efectivo, código e incidencias | Igual que en F5 (etapa 4) | Igual que en F5 |
| 7. Consola | Proponer, estado de oferta, alertas, asignación directa | Coordinación opera todo el ciclo |
| 8. E2E, CI y puesta en marcha | Incluye prueba real de push en dispositivos | CI en verde y prueba de humo con un repartidor real |

## 10. Pruebas específicas de este diseño

- **pgTAP:** solo la coordinación ofrece; no se ofrece un pedido ya asignado, a un repartidor inactivo, sin cuenta o no disponible; una sola oferta abierta por pedido y por repartidor; aceptar solo la propia oferta y solo vigente; aceptar dos veces es seguro; el vencimiento marca el estado; cancelar el pedido cancela la oferta; `anon` no ejecuta nada de esto; el repartidor no ve datos del cliente en una oferta.
- **Unitarias y componentes:** cuenta regresiva, botones bloqueados tras el primer toque, traducción de errores.
- **E2E:** ofrecer, aceptar y entregar; rechazar y reofrecer a otro; vencimiento; retiro de la oferta; accesibilidad en ancho de teléfono. El envío push real no se puede automatizar de forma fiable, así que se verifica en una **lista de prueba manual** con un Android y un iPhone.

## 11. Pendiente de confirmar

1. Los valores por defecto de la sección 2 (sobre todo los 3 minutos de vigencia).
2. Si la coordinación necesita ver quién tiene los avisos activados antes de proponer.
3. Cómo se avisa a la coordinación cuando una oferta vence (solo en pantalla, o también con sonido o push a la coordinación).
4. Lo ya pendiente del informe F5: manejo del efectivo, direcciones de tienda y correo con dominio verificado.
