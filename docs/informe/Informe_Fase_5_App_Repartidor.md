# Fase 5: aplicación del repartidor

Managua, Nicaragua, 18 de octubre de 2026
Tipo de documento: guía de trabajo previa a construir. Describe qué hay que hacer, en qué orden y qué decisiones faltan. **No hay código de F5 todavía.**
Base: el estado del repositorio al cierre de la Fase 4 (migraciones 1 a 32, tienda pública con carrito, checkout y seguimiento, consola completa, pagos con Stripe en modo prueba).
Relacionados: `Informe_Frontend_Completo_Rapitrip.md` (sección 8.4), `Informe_Fase_4_Tienda_Publica.md` (mismo formato), `backend-referencia.md` (backend vigente).

> **Aviso sobre el alcance.** En el plan general F5 está marcada como *opcional* y *sin diseño aprobado*. Lo que sigue es una propuesta mía a partir de lo que ya existe en el código; cada punto que depende de una decisión del negocio está en la sección 6 con una recomendación.

---

## 1. Qué es la Fase 5

Hoy el repartidor es una **ficha**: la administración lo da de alta en `/admin/repartidores` (nombre, teléfono, vehículo, documento) y la coordinación se lo asigna a un pedido. El repartidor **no tiene cuenta ni pantalla**: alguien de coordinación tiene que llamarlo, enterarse de que recogió el pedido y de que lo entregó, y marcar esos estados por él.

La Fase 5 le da al repartidor una **aplicación web móvil** (instalable) donde ve sus pedidos asignados, los recoge, los entrega y, si el pedido es en efectivo, registra el cobro.

| Pieza | Estado |
|---|---|
| Ficha del repartidor (`identity.couriers`, con `user_id` opcional ya previsto) | Construido (F1) |
| Asignar repartidor a un pedido (`assign_order_courier`) | Construido (F3) |
| Despachar y entregar (`set_order_status`, solo coordinación) | Construido (F3) |
| Dirección, teléfono y nota de entrega (`sales.order_delivery`) | Construido (F3/F4) |
| Pedidos de la coordinación, excepciones y pedidos atrasados | Construido (F3) |
| **Cuenta, rol y pantallas del repartidor** | **F5: no existe** |

**La respuesta corta a "¿es solo maquetar?":** no. Hay **backend nuevo y obligatorio**: no existe el rol `repartidor`, ninguna vista le muestra sus pedidos, y `set_order_status` solo deja despachar y entregar a la coordinación. Además hay que decidir cómo se protege el acceso (el segundo factor de la consola no encaja bien con alguien en moto). El backend es mediano (tres o cuatro migraciones) y va primero.

**Orden recomendado en el plan general:** F6 (tablero de operaciones) y F7 (liquidaciones) pesan más para operar que F5; el informe completo ya sugería dejar F5 al final. Mientras F5 no exista, la operación sigue funcionando con la coordinación marcando los estados, así que **F5 no bloquea la salida a producción**.

---

## 2. Punto de partida: qué existe hoy

**Base de datos**

- `identity.couriers`: `full_name`, `phone`, `vehicle_type`, `document_path`, `status` (`activo`/`inactivo`) y **`user_id` (nulo)**, reservado para esta fase. No tiene disponibilidad ni turno.
- `identity.app_role`: `superadmin`, `admin`, `cajero`, `coordinador`, `comercio`, `cliente`. **No hay `repartidor`.**
- `identity.invitations`: solo admite los roles `admin`, `cajero` y `coordinador` (restricción en la tabla).
- `sales.orders.courier_id` y `assign_order_courier`: solo asigna repartidores `activo` a pedidos confirmados y en curso.
- `set_order_status`: `listo → en_camino` y `en_camino → entregado` los hace **solo la coordinación** (`private.is_coordination_console()`), y exige repartidor asignado antes de despachar. Al entregar un pedido en efectivo marca `payment_status = 'pagado'`.
- `sales.order_delivery` (dirección, teléfono, nota): lo leen el cliente dueño y la coordinación; el comercio y el cajero no. Se borra al anonimizar la cuenta.
- `sales.order_events`: línea de tiempo con el actor de cada cambio.
- `commerce.stores.address` y `contact_phone`: sirven como dirección de recogida (la dirección es opcional, ver riesgos).

**Consola**

- `/admin/repartidores`: alta, edición, activar/desactivar y documento privado (`courier-document-url`).
- `/coordinacion`: asignar y despachar. El texto actual dice que el repartidor no tiene cuenta.
- Exportación de datos personales y auditoría ya conocen a los repartidores.

**Lo que se reutiliza sin tocarlo:** el diseño «Ruta» (`packages/ui`), el patrón de acciones de servidor, el cliente de Supabase con cookies propias (`packages/supabase`), la auditoría sin datos personales, y la infraestructura de pruebas (pgTAP, Vitest, Playwright con axe).

---

## 3. La experiencia que hay que construir

### 3.1 Recorrido del repartidor

1. **Alta.** La administración crea (o ya tiene) la ficha y le manda una invitación por correo. El repartidor crea su contraseña y entra.
2. **Disponibilidad.** Al empezar su jornada pulsa «Estoy disponible»; al terminar, «Terminé por hoy». La coordinación solo ve como asignables a los disponibles.
3. **Mis pedidos.** Lista corta de lo que tiene asignado, ordenada por urgencia: número, tienda de recogida con su dirección, estado y hora.
4. **Recoger.** En el comercio pulsa «Recogí el pedido» (`listo → en_camino`). Si el pedido aún no está listo, ve «Esperando al comercio».
5. **Entregar.** Ve dirección, teléfono (botón de llamar) y nota del cliente, abre la dirección en su aplicación de mapas y, al llegar, confirma la entrega. En efectivo ve **cuánto debe cobrar** y registra que lo cobró.
6. **Problemas.** «No pude entregar» con motivo (cliente ausente, dirección incorrecta, no contesta): avisa a la coordinación, que decide qué hacer. «No puedo con este pedido» antes de recogerlo: lo devuelve a la coordinación.
7. **Historial.** Sus entregas del día y de la semana, y el efectivo que le falta rendir.

### 3.2 Pantallas nuevas

| Ruta | Para qué |
|---|---|
| `/ingresar`, `/recuperar`, `/aceptar-invitacion` | Acceso del repartidor (contraseña) |
| `/` | Inicio: interruptor de disponibilidad, pedido actual destacado y cola |
| `/pedidos/[id]` | Detalle: tienda, cliente, productos, cobro, botones de avance y de problema |
| `/historial` | Entregas hechas y efectivo por rendir |
| `/perfil` | Sus datos (solo lectura salvo teléfono) y cerrar sesión |

### 3.3 Lo que no se construye en F5

- Seguimiento de ubicación en vivo ni mapa embebido (ver D9).
- Notificaciones push (ver D12).
- Asignación automática o por zonas: la coordinación sigue asignando a mano.
- Pagos o liquidaciones al repartidor (es F7).
- Chat con el cliente o el comercio: el teléfono basta.
- Varios repartidores por pedido, o un pedido con varias paradas.

---

## 4. Backend necesario

### 4.1 Rol y cuenta (obligatorio)

1. **Migración 33: valor de enumeración.** `alter type identity.app_role add value 'repartidor'`. Va **sola** en su migración: un valor nuevo de enumeración no se puede usar dentro de la misma transacción que lo crea.
2. **Migración 34: vínculo y alta.**
   - Ampliar la restricción de `identity.invitations.role` para aceptar `repartidor`, y ajustar `private.role_can_manage` (quién puede otorgarlo: administración y superadmin).
   - Al aceptar la invitación, la función de borde `accept-invitation` crea el rol y **llena `identity.couriers.user_id`**. La invitación se genera desde la ficha del repartidor (acción nueva `invite_courier(p_courier, p_email)`), para que cuenta y ficha nazcan unidas.
   - Un solo `user_id` por repartidor y viceversa (índice único parcial).
   - Si la ficha se desactiva o el rol se revoca, la cuenta pierde acceso (el gancho `custom_access_token` ya lo contempla para los demás roles).
3. **Sesión del repartidor.** Una función `private.is_courier_session()`: rol `repartidor` activo + ficha activa + sesión válida. Ver D4 sobre el segundo factor.

### 4.2 Lectura de sus pedidos (obligatorio)

Vistas `security_invoker`, como el resto del proyecto:

- `courier_me`: su ficha y su estado de disponibilidad.
- `courier_orders_list`: **solo** pedidos con `courier_id` igual a su ficha y estado `confirmado`, `preparando`, `listo` o `en_camino`, más los entregados del día. Columnas mínimas: número, tienda, dirección de la tienda, estado, método de pago, **total a cobrar solo si es efectivo**, ítems (nombre y cantidad, sin SKU).
- `courier_order_delivery`: dirección, teléfono y nota del cliente **solo mientras el pedido está asignado a él y sigue abierto** (`listo` o `en_camino`). Al entregarse, desaparecen de su vista. El borrado por anonimización ya existe.

El repartidor **no** lee `sales.orders` directamente: ninguna política nueva sobre tablas, solo estas vistas con filtros fijos.

### 4.3 Acciones (obligatorio)

Funciones `security definer` con `search_path = ''` y auditoría, como las demás:

| Función | Qué hace | Reglas |
|---|---|---|
| `courier_set_available(p_available bool)` | Disponibilidad | Solo su propia ficha; queda auditado |
| `courier_pick_up(p_order uuid)` | `listo → en_camino` | Solo si es su pedido y está `listo`; escribe `order_events` con su actor |
| `courier_deliver(p_order uuid, p_code text, p_cash numeric)` | `en_camino → entregado` | Solo su pedido; valida el código de entrega (D7); en efectivo exige el monto cobrado y lo registra |
| `courier_report_problem(p_order uuid, p_reason text)` | Avisa a la coordinación | Motivo de 5 a 200 caracteres; el pedido **no cambia de estado**, queda marcado |
| `courier_release_order(p_order uuid, p_reason text)` | Devuelve el pedido | Solo antes de recoger; deja `courier_id` nulo y avisa |

Para no duplicar la lógica de transiciones, estas funciones **llaman al núcleo que ya usa `set_order_status`**. Eso exige extraer ese núcleo a una función privada que reciba el actor ya validado; hoy las comprobaciones de quién puede qué están dentro de la propia función. Es el único cambio sobre código de F3 y debe llevar sus pruebas.

### 4.4 Efectivo, código de entrega y problemas (según decisiones)

- **Código de entrega** (D7): columna `delivery_code` (4 dígitos) en una tabla aparte con acceso restringido, generada al despachar. El cliente lo ve en su pedido; el repartidor debe escribirlo para entregar. No se guarda en la auditoría.
- **Efectivo cobrado** (D8): tabla `sales.courier_cash` (pedido, repartidor, monto esperado, monto cobrado, rendido sí/no, quién y cuándo rindió). La coordinación marca la rendición; es la base que F7 usará para liquidar.
- **Incidencias**: tabla `sales.delivery_issues` (pedido, repartidor, motivo, atendida). Alimenta la lista de excepciones que ya existe en `/admin/excepciones` y `/coordinacion`.

### 4.5 Disponibilidad

Columna `available` y `available_since` en `identity.couriers`. `assign_order_courier` pasa a preferir (no a exigir) repartidores disponibles; la consola muestra el estado.

### 4.6 Resumen de migraciones

| # | Contenido |
|---|---|
| 33 | Valor `repartidor` del rol |
| 34 | Invitación y vínculo cuenta–ficha, `is_courier_session`, disponibilidad |
| 35 | Núcleo compartido de transiciones, vistas del repartidor y acciones `courier_*` |
| 36 | Efectivo por rendir, código de entrega e incidencias |

Cada una con su pgTAP (numeración 330 en adelante) y la prueba de guardas actualizada: las funciones `courier_*` son para `authenticated`, **no** para `anon`.

---

## 5. Frontend: cómo se construye

### 5.1 Dónde vive (D2)

Recomendación: **una tercera aplicación `apps/courier`** (puerto 3002), mismo monorepo y `packages/ui`. Razones: es móvil primero, necesita su propio manifiesto instalable y su propia política de sesión (no los 15 minutos de inactividad de la consola), y mezclarla con la consola duplicaría reglas que hoy están pensadas para computador (barra lateral de 264 px, segundo factor obligatorio).

Costo: un proyecto más en Vercel, otra cookie de sesión (`rapitrip-courier-auth`), su `next.config.mjs` con CSP y `allowedDevOrigins: ["127.0.0.1"]`, su `proxy.ts`, y una variable `NEXT_PUBLIC_SITE_URL` propia. Alternativa más barata: un área `/repartidor` dentro de la tienda, con la desventaja de mezclar roles en la app pública.

### 5.2 Pantallas

- **Inicio**: interruptor grande de disponibilidad; tarjeta del pedido actual con el siguiente paso como botón principal; cola debajo. Botones de al menos 44 px, pensados para usar con una mano.
- **Detalle del pedido**: tienda y dirección de recogida con enlace «Abrir en mapas» (dirección en texto, sin SDK); datos del cliente con botón «Llamar»; productos; cobro destacado si es efectivo; botones de avance y «Tengo un problema».
- **Confirmar entrega**: campo del código de 4 dígitos y, en efectivo, el monto cobrado con el esperado precargado.
- **Historial**: entregas y efectivo pendiente de rendir.

### 5.3 Actualización de la lista

Sin tiempo real en F5: actualización cada 30 segundos mientras la pantalla está visible, y al volver a la aplicación. El tiempo real queda para F6 (tablero), que es donde se justifica.

### 5.4 Conexión inestable

Un repartidor pierde señal con frecuencia. En F5 solo se exige: mensajes claros cuando falla una acción, **botones que no se pueden pulsar dos veces** y acciones **idempotentes** (pulsar «Entregué» dos veces no rompe nada). Trabajo sin conexión con cola de envío queda fuera (ver D12).

### 5.5 Diseño

Mismo patrón de F1 a F4: tokens de «Ruta», verde como primario y azul como secundario, estados vacíos, accesibilidad con axe y movimiento reducido respetado. Contraste alto y texto grande porque se usa al aire libre.

### 5.6 Cambios en la consola

- `/admin/repartidores`: botón «Invitar» y columna de estado de cuenta y de disponibilidad.
- `/coordinacion`: mostrar disponibilidad, etiquetar quién recogió y entregó, atender incidencias y marcar el efectivo rendido; ajustar el texto que dice que el repartidor no tiene cuenta.
- `lib/audit-labels.ts` y `lib/nav.ts`: etiquetas nuevas de auditoría.
- Documentación: `backend-referencia.md` y el informe completo.

---

## 6. Decisiones pendientes

Cada una con una recomendación para no frenar el trabajo.

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| D1 | ¿Se construye F5 ahora o después de F6 y F7? | Ahora · después | **Después**, salvo que ya haya repartidores propios; mientras tanto la coordinación marca los estados |
| D2 | Dónde vive | App nueva · área en la consola · área en la tienda | **App nueva `apps/courier`** (sección 5.1) |
| D3 | Cómo se da de alta la cuenta | Invitación por correo · la administración vincula una cuenta existente | **Invitación por correo** desde la ficha |
| D4 | Segundo factor del repartidor | Contraseña y TOTP como la consola · solo contraseña con sesión acotada | **Solo contraseña**, sesión de hasta 12 horas y acciones limitadas a sus pedidos. Pedir TOTP a quien está en moto lo vuelve inusable; el riesgo se acota porque solo ve lo asignado y nada puede cobrarse ni cambiarse fuera de sus pedidos. Si el negocio exige más, TOTP opcional |
| D5 | Quién marca «en camino» y «entregado» | Solo coordinación (hoy) · el repartidor, y la coordinación como excepción | **El repartidor**; la coordinación conserva la excepción |
| D6 | ¿El repartidor acepta o rechaza asignaciones? | Sí · no, solo «devolver» antes de recoger | **No acepta**: coordinación asigna; puede devolver con motivo antes de recoger |
| D7 | Comprobante de entrega | Nada · código de 4 dígitos · foto | **Código de 4 dígitos** que ve el cliente. La foto implica datos personales y almacenamiento; si se quiere, que sea opcional y en una fase posterior |
| D8 | Efectivo contra entrega | Solo confirmar «entregado» · registrar el monto cobrado y la rendición | **Registrar monto y rendición** manual por la coordinación; es la base de F7 |
| D9 | Ubicación en vivo | No · sí | **No** en F5 (privacidad, batería, consentimiento y mapas); evaluarlo con F6 |
| D10 | Disponibilidad y turnos | Un interruptor · turnos programados | **Un interruptor** «Estoy disponible» |
| D11 | Navegación | Mapa propio · enlace a la aplicación de mapas | **Enlace con la dirección en texto** (sin SDK ni costo) |
| D12 | Avisos al repartidor | Ninguno (consulta periódica) · push · SMS | **Consulta cada 30 s** en F5; push web como mejora posterior |
| D13 | Qué datos del cliente ve | Todo · lo mínimo | **Dirección, teléfono y nota**, solo mientras el pedido está abierto y asignado a él; el nombre solo de pila |
| D14 | Repartidores con y sin cuenta | Todos con cuenta · se permiten fichas sin cuenta | **Se permiten fichas sin cuenta**: la coordinación sigue pudiendo despachar por ellos |
| D15 | Zona horaria y moneda | — | Ya definidas: `America/Managua` y córdoba |

---

## 7. Plan por etapas

Cada etapa con criterio de terminado: pruebas pasan, accesibilidad verificada y sin commits hasta que se apruebe, como en las fases anteriores.

| Etapa | Qué incluye | Terminada cuando |
|---|---|---|
| **1. Rol, cuenta y disponibilidad** | Migraciones 33 y 34, invitación desde la ficha, `accept-invitation` con el rol nuevo, `is_courier_session`, prueba de guardas y pgTAP | Un repartidor invitado crea su cuenta y entra; sin ficha activa pierde acceso; nadie fuera de administración puede otorgar el rol |
| **2. Lectura de sus pedidos** | Migración 35 (vistas y núcleo compartido de transiciones) y su pgTAP | Ve solo lo asignado a él; los datos del cliente desaparecen al entregar; los pedidos de otros no aparecen |
| **3. App base y avance de estados** | `apps/courier`: ingreso, inicio, detalle, `courier_pick_up`, `courier_deliver` en tarjeta | Recoge y entrega un pedido pagado con tarjeta de punta a punta; la coordinación lo ve en su pantalla |
| **4. Efectivo, código e incidencias** | Migración 36, pantalla de confirmación con código y monto, «tengo un problema», «devolver pedido» | Entrega en efectivo registra el cobro; una incidencia aparece en coordinación; el código incorrecto no deja entregar |
| **5. Cambios en la consola** | Invitar, disponibilidad, incidencias y rendición en coordinación, etiquetas de auditoría | La coordinación opera con los datos nuevos y puede seguir despachando por un repartidor sin cuenta |
| **6. E2E, CI y puesta en marcha** | Pruebas de punta a punta, ampliación del CI, documentación y lista de producción (sección 11) | CI en verde, y el informe completo y la referencia del backend actualizados |

---

## 8. Pruebas

| Nivel | Qué cubre |
|---|---|
| pgTAP | Quién puede otorgar el rol; que el repartidor **solo** ve y actúa sobre sus pedidos; datos del cliente visibles solo en `listo` y `en_camino`; transiciones permitidas y prohibidas; código de entrega; efectivo; idempotencia; que `anon` no ejecuta nada nuevo; la prueba de guardas actualizada |
| Unitarias | Reglas de la interfaz: qué botón corresponde a cada estado, formato de montos y teléfonos, traducción de errores |
| Componentes | Detalle del pedido, confirmación de entrega (código y monto), doble pulsación |
| E2E | Invitación y primer ingreso; ver solo sus pedidos; recoger y entregar con tarjeta; entregar en efectivo con rendición; código incorrecto; devolver un pedido; incidencia visible en coordinación; accesibilidad en móvil |
| Accesibilidad | axe en cada pantalla, ancho de teléfono, dentro del conjunto que ya corre el CI |
| CI | Los E2E del repartidor se suman al trabajo `e2e-operaciones`, y se agrega `apps/courier` a los trabajos de tipos, lint y pruebas |

Recordatorio de los E2E con backend: la base local debe tener **todas** las migraciones (`supabase migration up --local`) y, para flujos con invitación, las funciones servidas (`supabase functions serve`). Los E2E dejan datos que alteran los conteos de pgTAP: correr `pnpm db:reset` antes de `pnpm db:test`.

---

## 9. Seguridad y privacidad

- **La base de datos decide.** El botón escondido no protege nada: cada función valida que el pedido sea de ese repartidor, el estado y la sesión.
- **Mínimo acceso a datos personales.** El repartidor ve la dirección y el teléfono del cliente solo mientras entrega; después no. Es el punto más delicado de F5 y lleva su propio conjunto de pruebas.
- **Sin ubicación.** No se recoge la posición del repartidor en F5.
- **Auditoría sin datos personales.** Se guardan ids, estados, motivos y montos; nunca direcciones, teléfonos ni el código de entrega.
- **Sesión acotada** (D4): plazo máximo de 12 horas y cierre inmediato al desactivar la ficha o revocar el rol.
- **Dispositivos perdidos o compartidos.** Un teléfono robado da acceso a los pedidos asignados mientras dure la sesión: hace falta un procedimiento para que la administración revoque el rol y cierre sesiones de inmediato (ya existe `set_courier_status`; comprobar que cierra las sesiones activas).
- **Efectivo.** Los montos cobrados y rendidos quedan en tablas con acceso restringido y auditoría; la diferencia entre lo esperado y lo cobrado es visible para la coordinación.
- **Documento del repartidor.** Sigue privado y solo lo abre la administración con su registro de lectura sensible; la aplicación del repartidor no lo toca.
- **Ley 787.** Revisar con quien asesore en lo legal el tratamiento de datos del repartidor y del cliente en esta aplicación, y el acuerdo de uso de la cuenta.

---

## 10. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Sin TOTP, una cuenta robada actúa sobre pedidos asignados | Entregas falsas o fuga de direcciones | Sesión acotada, solo datos del pedido abierto, revocación inmediata, auditoría de cada acción |
| El repartidor pierde señal y vuelve a pulsar | Estados duplicados | Acciones idempotentes y botones con estado de envío |
| Entrega confirmada sin entregar | Cobro o pedido cerrado en falso | Código de entrega del cliente y registro del monto en efectivo |
| Efectivo sin rendir | Pérdida económica | Tabla de efectivo por rendir visible en coordinación y base para F7 |
| Cambiar el núcleo de transiciones de F3 | Romper pedidos que hoy funcionan | Extraerlo con sus pruebas actuales intactas (pgTAP 250 y los E2E de operaciones) antes de agregar nada |
| Pedido listo sin repartidor, o repartidor sin cuenta | Pedidos detenidos | Se mantiene el despacho por coordinación (D14) |
| La tienda no tiene dirección cargada | El repartidor no sabe dónde recoger | Volver la dirección obligatoria para publicar, o avisar en el detalle del pedido |
| Aplicación abierta en segundo plano no se actualiza | El repartidor no ve un pedido nuevo | Actualizar al volver a primer plano; push como mejora posterior |
| Tercera aplicación aumenta el mantenimiento | Más despliegues y configuración | Reutilizar `packages/ui` y `packages/supabase`; mismo patrón de CI |
| Origen o cookies mal configurados | Sesión que no se mantiene | Variables documentadas y comprobadas en los E2E, como en la tienda |

---

## 11. Puesta en marcha (no es código de la app)

1. **Proyecto de Supabase en producción** con las migraciones 33 a 36 y la función `accept-invitation` desplegada con el rol nuevo.
2. **Tercer proyecto de Vercel** (Root Directory `apps/courier`) con sus variables y dominio propio (por ejemplo `repartidor.tudominio.com`); agregar su origen a la configuración de Auth de Supabase.
3. **Correo (Resend)** con dominio verificado: la invitación del repartidor depende de él.
4. **Procedimiento de alta y baja**: quién invita, quién desactiva, qué se hace cuando un repartidor pierde el teléfono.
5. **Procedimiento de efectivo**: cuándo y ante quién se rinde, y qué se hace con una diferencia.
6. **Capacitación breve** de repartidores y coordinación, con la lista de problemas frecuentes.
7. **Prueba de humo en producción** con un repartidor real: un pedido de monto mínimo por tarjeta y otro en efectivo, de punta a punta.
8. Los pendientes de producción de F4 (revisión legal, Stripe en producción, programador de `process-refunds`, límites de tasa) siguen vigentes y **no** dependen de F5.

---

## 12. Tamaño relativo del trabajo

Sin fechas: es una medida para comparar etapas, no una promesa.

| Etapa | Tamaño | Por qué |
|---|---|---|
| 1. Rol, cuenta y disponibilidad | Media | Toca identidad e invitaciones, que son delicadas, y la función de borde |
| 2. Lectura de sus pedidos | Media | Poco código, mucha prueba: lo importante es **qué no ve** |
| 3. App base y avance de estados | Media a grande | Aplicación nueva (configuración, sesión, PWA) y primeras pantallas |
| 4. Efectivo, código e incidencias | Media | Tres tablas pequeñas y los flujos de excepción |
| 5. Cambios en la consola | Pequeña a media | Ajustes en pantallas que ya existen |
| 6. E2E, CI y salida | Media | Pruebas largas y la lista de producción |

---

## 13. Qué se necesita de ti antes de empezar

1. **Decidir si F5 va ahora o después de F6 y F7** (D1), y si habrá repartidores con cuenta desde el inicio.
2. **Responder D2 a D14**, o aceptar las recomendaciones tal cual. Las más importantes: D2 (dónde vive), D4 (segundo factor) y D7 y D8 (código de entrega y efectivo).
3. **Confirmar cómo se maneja el efectivo en la operación real**: quién lo recibe, cuándo se rinde, qué se hace con diferencias.
4. **Cargar la dirección de recogida de cada tienda** o aceptar volverla obligatoria.
5. Para producción: correo con dominio verificado y dominio propio de la aplicación (sección 11). Ninguna bloquea las etapas 1 a 5.

Con las decisiones tomadas, la **etapa 1** (rol y cuenta) se puede abrir de inmediato: es la que desbloquea todo lo demás.
