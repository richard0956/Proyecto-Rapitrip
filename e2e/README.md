# Pruebas de extremo a extremo

Playwright + axe sobre la consola (`:3001`) y la tienda (`:3000`).

## Accesibilidad (sin backend)

Revisa WCAG 2.2 AA con axe en las pantallas públicas, en escritorio y en móvil. Es lo que corre el CI.

```bash
pnpm e2e:a11y   # solo axe
pnpm e2e:front  # axe + introducción y transiciones (lo que corre el CI)
```

En local arranca las apps con `next dev` (o reutiliza las que ya tengas en los puertos 3000 y 3001). Con `CI=true` usa `next start`, así que
antes hay que compilar (`pnpm --filter @rapitrip/console build` y `pnpm --filter @rapitrip/store build`).

## Flujos con backend (Supabase local)

Cubren el acceso real: contraseña, segundo factor (TOTP), invitaciones, redirección por rol, cierre por inactividad, registro, perfil y
solicitud de comercio. Se omiten solos si faltan las variables.

```bash
pnpm db:start && pnpm db:reset            # imprime la URL y las claves
export SUPABASE_URL=http://127.0.0.1:54321
export SUPABASE_ANON_KEY=<anon key>
export SUPABASE_SERVICE_ROLE_KEY=<service_role key>
pnpm e2e:backend
```

Cada ejecución crea cuentas con correos únicos (`*@e2e.test`), así que no hace falta limpiar entre corridas. Pero esos datos alteran los conteos de las pruebas pgTAP: antes de `pnpm db:test` en la misma base, corre `pnpm db:reset`.

### Área de comercio (Fase 2)

`tests/comercio.spec.ts` recorre el área de comercio con el backend real: crea una cuenta de comercio (solicitud aprobada por un director), define tienda,
horario y cierre temporal, publica un producto con variante e imagen (sube a Storage con las políticas reales), controla el inventario y comprueba
que un comercio no ve ni modifica las tiendas de otro. También recorre el catálogo maestro como director. Incluye axe en cada pantalla.
No necesita las Edge Functions (los demás flujos de operaciones sí). El CI lo corre dentro del trabajo `e2e-operaciones`.

```bash
pnpm e2e:comercio   # con las variables de arriba definidas
```

### Operaciones completas (Fase 3, etapa 7)

`tests/pedido-completo.spec.ts` recorre un pedido de punta a punta con cada persona en su propio navegador: el cliente pide (por API, porque el carrito de la tienda es F4), el comercio lo confirma, prepara y deja listo; coordinación asigna repartidor, despacha y entrega; administración lo ve entregado y cobrado.

```bash
pnpm e2e:operaciones   # comercio, caja, coordinación, administración y pedido de punta a punta
```

Ese conjunto (todos los flujos de operación con backend real, sin Stripe) es lo que corre el trabajo `e2e-operaciones` del CI: levanta Supabase local, **sirve las Edge Functions** con un secreto interno aleatorio, espera a que `accept-invitation` responda y compila las apps con sus claves. Los E2E de Stripe quedan fuera porque usan claves de prueba personales.

### Caja y venta de mostrador (Fase 3)

`tests/caja.spec.ts` (etiqueta `@backend`) recorre el turno completo del cajero: acepta su invitación, abre caja con 500.00, vende 2 cafés en efectivo con vuelto, vende con tarjeta de terminal y la anula (el stock vuelve) y cierra con una diferencia de 10.00 que exige nota. Necesita las Edge Functions sirviéndose (`supabase functions serve`) porque el cajero acepta su invitación con `accept-invitation`; por eso no corre en el CI.

### Coordinación (Fase 3)

`tests/coordinacion.spec.ts` (etiqueta `@backend`): el comercio deja un pedido listo por API, coordinación (invitada y enrolada por la interfaz) asigna un repartidor, comprueba que no se puede despachar sin él, despacha, marca la entrega (el pedido en efectivo queda pagado) y cancela otro pedido con motivo (el stock vuelve). Necesita las Edge Functions sirviéndose, como `caja.spec.ts`.

### Administración de pedidos y caja (Fase 3)

`tests/admin-operaciones.spec.ts` (etiqueta `@backend`): prepara por API un pedido listo, otro por confirmar y un turno de caja cerrado con diferencia (el cajero acepta su invitación con `accept-invitation`), y el director recorre `/admin/pedidos` (filtros, detalle, cancelar con motivo), `/admin/excepciones` (el pedido listo sin repartidor aparece y enlaza al detalle) y `/admin/caja` (turno con diferencia, nota y ventas). Necesita las Edge Functions sirviéndose.

### Pagos con tarjeta (Stripe, Fase 3)

`tests/pagos.spec.ts` (etiqueta `@stripe`) usa **Stripe en modo prueba de verdad**: crea el pedido, pide la sesión de pago a `stripe-checkout`, paga en la página alojada de Stripe con la tarjeta `4242 4242 4242 4242`, entrega al webhook local el evento firmado con datos reales de esa sesión, comprueba que el pedido pasa a pagado, que reenviar el evento no repite nada, que cancelar un pedido pagado lo reembolsa en Stripe (`process-refunds`) y que un pago que llega con el pedido ya cancelado se reembolsa solo. No corre en el CI (usa tu cuenta de Stripe).

Necesita, además de las variables de Supabase, las de `supabase/functions/.env` en el shell y las Edge Functions sirviéndose:

```bash
npx supabase functions serve                      # en otra terminal
set -a; . supabase/functions/.env; set +a         # STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, OUTBOX_SECRET…
pnpm e2e:stripe
```

Se omite solo si falta alguna variable o si la clave no es de prueba (`sk_test_`). Cada ejecución crea pagos y reembolsos de prueba en tu cuenta de Stripe, sin dinero real.

### Cómo funcionan

- **Segundo factor:** la pantalla de alta muestra la clave manual; la prueba la lee y calcula el código TOTP (`support/backend.ts`).
- **Invitaciones:** las Edge Functions solo imprimen el correo en el registro (`MAIL_MODE=log`), así que la prueba crea la invitación por RPC con
  un token conocido, con una sesión de consola completa preparada por la API.
- **Confirmación de correo de clientes:** se confirma por la API de administración, sin depender del buzón.
- **Inactividad:** `page.clock` adelanta 11 minutos y se espera `/sesion-expirada`.

### Lo que no cubren

- Ingreso con Google (necesita credenciales de OAuth reales).
- El enlace de recuperación de contraseña recibido por correo (PKCE exige abrirlo en el mismo navegador que lo pidió).
- La sesión vencida del cliente (tope de 1 día): está probada en componentes; en e2e haría falta envejecer `auth.sessions`.

### Tienda pública (Fase 4)

- `tests/tienda-catalogo.spec.ts` (sin backend): axe en `/tiendas`, la tienda, el producto y el carrito vacío (escritorio y móvil) y el recorrido catálogo → carrito → «Pagar» pide ingresar. Usa `support/catalog-mock.mjs`, un Supabase de mentira que `playwright.config.ts` levanta en el puerto 54321 cuando no hay `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- `tests/tienda-pedido.spec.ts` (`@backend`): el cliente ingresa, confirma un pedido en efectivo, lo ve en «Mis pedidos» y lo cancela; el stock vuelve. El pago con tarjeta queda en `pagos.spec.ts`.
