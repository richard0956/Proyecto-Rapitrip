# Fase 1 — Puesta en marcha y verificación

Guía para levantar, probar y desplegar las dos apps (`apps/console` :3001, `apps/store` :3000).

## 1. Local

```bash
pnpm install
pnpm db:start                      # Supabase local (Docker)
pnpm db:reset                      # migraciones 1–18 + semillas
pnpm db:test                       # pgTAP
pnpm db:types                      # regenera packages/db-types (la migración 18 añade my_commerce_requests)
cp apps/console/.env.example apps/console/.env.local   # completa URL y anon key de `supabase status`
cp apps/store/.env.example   apps/store/.env.local
pnpm --filter @rapitrip/console dev    # http://localhost:3001
pnpm --filter @rapitrip/store dev      # http://localhost:3000
```

Las dos apps usan cookies de sesión con nombre propio (`rapitrip-console-auth`, `rapitrip-store-auth`), así que puedes iniciar sesión en ambas a la vez en `localhost`.

### Crear el primer superadmin
El rol `superadmin` solo se otorga por código. Regístrate en la tienda (o crea el usuario en Studio) y ejecuta en el SQL editor:

```sql
insert into identity.user_roles (user_id, role)
select id, 'superadmin' from auth.users where email = 'tu@correo.com';
```
Después entra a la consola; pedirá enrolar TOTP (MFA) en el primer acceso.

### Correos en local
Con `MAIL_MODE=log` las Edge Functions imprimen el correo en lugar de enviarlo: revisa `supabase functions serve` o Mailpit (`http://127.0.0.1:54324`) para los de Auth.

## 2. Google (ingreso en la tienda)

Hecho en código: botón condicionado por `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`, callback PKCE en `/auth/callback`, bloque `[auth.external.google]` en `supabase/config.toml` (apagado). Lo que falta lo haces tú:

1. Google Cloud Console → *APIs y servicios → Credenciales → ID de cliente OAuth* (tipo **Aplicación web**).
2. URI de redirección autorizado: local `http://127.0.0.1:54321/auth/v1/callback`; producción `https://<proyecto>.supabase.co/auth/v1/callback`.
3. Local: copia `supabase/.env.example` a `supabase/.env`, rellena `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` y `..._SECRET`, cambia `enabled = true` en `[auth.external.google]` y reinicia (`pnpm db:stop && pnpm db:start`).
4. En `apps/store/.env.local` pon `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
5. Producción: Supabase → Authentication → Providers → Google (mismos datos) y la variable en Vercel. En *URL Configuration* agrega `https://<dominio-tienda>/auth/callback` a Redirect URLs.

## 3. CAPTCHA (Cloudflare Turnstile)

Hecho en código: widget `Turnstile` en login/registro/recuperación (consola y tienda) y bloque `[auth.captcha]` en `config.toml` (apagado). Sin `NEXT_PUBLIC_TURNSTILE_SITE_KEY` no se muestra widget.

- **Pruebas locales** (claves públicas de Cloudflare): site key `1x00000000000000000000AA`, secret `1x0000000000000000000000000000000AA` (siempre pasa). Para forzar fallo: `2x00000000000000000000AB` / `2x0000000000000000000000000000000AA`.
- Activar: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` en ambas apps, `SUPABASE_AUTH_CAPTCHA_SECRET` en `supabase/.env` y `enabled = true` en `[auth.captcha]`. Los e2e usan el token de prueba `XXXX.DUMMY.TOKEN.XXXX`.
- **Importante**: activa ambos lados a la vez; si Supabase exige CAPTCHA y el front no envía token, el login falla.
- Producción: crea un widget en Cloudflare con los dominios de ambas apps; secret en Supabase → Authentication → Attack Protection.

## 4. Seguridad de cabeceras
Ambas apps envían CSP (permite solo Supabase y `challenges.cloudflare.com`), `frame-ancestors 'none'`, Permissions-Policy y, en producción, HSTS. Si añades un servicio externo (analítica, mapas, fuentes), amplía la CSP en `apps/*/next.config.mjs`. `'unsafe-inline'` en scripts es necesario por la hidratación de Next y la introducción; migrar a nonces es una mejora futura.

## 5. Vercel (no activado)
Crea **dos proyectos** apuntando al mismo repo con *Root Directory* `apps/console` y `apps/store`; cada uno trae su `vercel.json` (install/build desde la raíz del monorepo y `ignoreCommand` para no construir si no cambió nada relevante). Variables por proyecto:

| Variable | Console | Store |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | ✔ |
| `NEXT_PUBLIC_SITE_URL` (URL pública de esa app) | ✔ | ✔ |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | ✔ | ✔ |
| `NEXT_PUBLIC_TIMEZONE` (`America/Managua`) | ✔ | ✔ |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | — | ✔ |

La consola no debería indexarse ni anunciarse; el dominio de la tienda sí.

## 6. Lista de verificación manual
- [ ] Registro en tienda → correo → confirmación → `/perfil`.
- [ ] `/vende`: enviar solicitud; ver estado "pendiente"; el formulario desaparece.
- [ ] Consola (admin con MFA): Solicitudes muestra representante, teléfono, dirección, categoría; aprobar con convenio; la tienda pasa a "aprobada".
- [ ] Rechazar con motivo → la tienda muestra el motivo y permite reenviar.
- [ ] Consola: 10 min de inactividad cierra sesión; tienda: a las 24 h aparece "tu sesión venció".
- [ ] Iniciar sesión en tienda y consola simultáneamente en `localhost` sin que se cierren entre sí.
- [ ] Refrescar token con una sesión `aal2`: debe mantenerse `aal2` (riesgo del informe §12).
- [ ] Auditoría y Accesos (admin): paginación y filtros.
- [ ] `pnpm e2e:backend` con el stack local arriba.

## 7. Fuera de esta fase
Textos legales definitivos (términos, privacidad, Ley 787), decisión de si `cajero` y `coordinador` comparten `operations`, y las credenciales reales de Google/Cloudflare.
