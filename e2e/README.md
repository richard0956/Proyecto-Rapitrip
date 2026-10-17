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

Cada ejecución crea cuentas con correos únicos (`*@e2e.test`), así que no hace falta limpiar entre corridas.

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
