# Informe técnico del frontend de Rapitrip

Fecha: 16 de octubre de 2026
Base: diseño `docs/superpowers/specs/2026-10-16-frontend-fundacion-design.md`, estilo "Ruta" aprobado y backend F1 terminado (migraciones `20261101000001` a `16`).
Propósito: fijar lo que hay que construir y con qué, para analizarlo después contra la programación.

## 1. Resumen

Se construyen dos aplicaciones web en el monorepo existente y dos paquetes nuevos.

| Pieza | Tipo | Puerto local | Público |
|---|---|---|---|
| `apps/console` | Next.js, App Router | 3001 | Personal y comercios (con sesión) |
| `apps/store` | Next.js, App Router | 3000 | Clientes (catálogo público, indexable) |
| `packages/ui` | Biblioteca de tokens y componentes | n/a | n/a |
| `packages/supabase` | Clientes, sesión y guardias de rol | n/a | n/a |
| `packages/db-types`, `packages/validation` | Ya existen | n/a | n/a |

La base de datos y las funciones se reutilizan sin cambios, salvo las brechas de la sección 6.

## 2. Pila técnica

| Capa | Elección | Nota |
|---|---|---|
| Framework | Next.js (App Router), React, TypeScript estricto | Hereda `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`) |
| Estilos | Tailwind CSS con tokens como variables CSS | Tema único compartido desde `packages/ui` |
| Componentes base | shadcn/ui sobre Radix, restilizados | Código copiado al repo, sin dependencia de marca |
| Datos en cliente | TanStack Query, TanStack Table | Solo en la consola |
| Sesión | `@supabase/ssr` con cookies | Lectura en servidor y en cliente |
| Validación | `@rapitrip/validation` (zod) | Mismos esquemas en cliente y servidor |
| Tipos | `@rapitrip/db-types` | Generados con `pnpm db:types` |
| CAPTCHA | Cloudflare Turnstile | Clave de prueba en local |
| Pruebas | Vitest, Playwright | Playwright solo en flujos de acceso |
| Fuentes | Bricolage Grotesque y Plus Jakarta Sans | Autoalojadas con `next/font` |

## 3. Sistema de diseño "Ruta" (`packages/ui`)

### 3.1 Tokens

| Token | Valor | Uso |
|---|---|---|
| `selva` | `#0B4F45` | Fondos fuertes, barra lateral |
| `hoja` | `#006C5F` | Primario, enlaces, activo |
| `menta` | `#D6F5EC` | Fondos suaves, insignias positivas |
| `menta-borde` | `#8FD1BD` | Detalles sobre fondo oscuro |
| `crema` | `#FFF7ED` | Fondo de página |
| `papel` | `#FFFDF8` | Tarjetas |
| `borde` | `#F1E6D6` | Borde de tarjetas |
| `borde-campo` | `#D9CDBE` | Campos de formulario |
| `tinta` | `#1F2937` | Texto |
| `tinta-suave` | `#5F6D69` | Texto secundario |
| `mango` | `#F59E2B` | Acción principal y estado activo |
| `guayaba` | `#E8604C` | Errores y alertas |
| `calido` | `#FFF4E6` | Insignias neutras |

Radios: campo 12 px, botón en píldora, tarjeta 20 a 24 px. Tipografía: títulos en Bricolage Grotesque 800, texto en Plus Jakarta Sans 400/500/700/800.

Reglas de uso:
- Mango solo en la acción principal de cada vista y en el estado activo. Un solo botón Mango por vista.
- Ningún componente usa un color fuera de estos tokens.
- Los colores de texto sobre cada fondo cumplen contraste 4.5:1 (hay que verificarlo en la construcción; `menta-borde` sobre `selva` y Mango sobre crema son los casos a medir).

### 3.2 Componentes iniciales

Botón (primario, secundario, fantasma, peligro), campo de texto, selector, casilla e interruptor, insignia de estado, tarjeta, tarjeta de indicador, tabla densa, diálogo y confirmación, aviso en línea, estado vacío, esqueleto de carga, barra lateral, barra superior, pestañas, paginación, campo de código de seis dígitos (MFA) e indicador de pasos con línea de ruta.

### 3.3 Densidad y respuesta

- Consola: pensada para computador. Barra lateral de 264 px y contenido de 1176 px a 1440 px. Por debajo de 1024 px la barra se oculta tras un menú. Tablas con altura de fila de 40 px.
- Tienda: móvil primero. Puntos de corte 640, 768 y 1024 px. Objetivos táctiles de 44 px. Carrito fijo abajo en móvil y lateral en escritorio.

## 4. Roles y navegación de la consola

El backend define seis roles (`identity.app_role`):

| Rol en BD | Nombre en el diseño | Área de la consola |
|---|---|---|
| `superadmin` | Director | `admin` completa |
| `admin` | Administrador | `admin` sin acciones de director |
| `cajero` | Encargado de ventas (caja) | `caja` (caja y venta, F3) |
| `coordinador` | Encargado de ventas (coordinación) | `coordinacion` (pedidos, F3 y F6) |
| `comercio` | Comercio | `comercio` |
| `cliente` | Cliente | Solo tienda |

El token de acceso incluye el rol mediante el hook `custom_access_token`. La redirección tras el inicio de sesión sale de ese dato, y el servidor la vuelve a comprobar en cada carga protegida.

Estados de acceso a resolver en la consola:
- Sin sesión: va a `login`.
- Sesión sin segundo factor cuando el rol lo exige: va a `mfa`.
- Sesión expirada por inactividad: pantalla "sesión expirada".
- Cuenta sin rol, suspendida o revocada: pantalla "cuenta sin acceso".

## 5. Mapa de pantallas a backend

### 5.1 Consola

| Pantalla | Lectura | Escritura | Rol mínimo |
|---|---|---|---|
| Login | `auth.signInWithPassword` + Turnstile | n/a | Cualquiera |
| MFA (alta y verificación) | `auth.mfa.*` | `auth.mfa.enroll`, `challenge`, `verify` | Rol con MFA |
| Aceptar invitación | `begin_accept_invitation` (vía función) | `accept-invitation` (Edge Function) | Invitado |
| Mi cuenta | vista `my_profile`, `my_roles` | `update_my_profile` | Cualquiera |
| Usuarios y roles | vista `accounts_staff`, `invitations_list` | `invite-staff` (Edge Function), `suspend_role`, `reactivate_role`, `revoke_role`, `cancel_invitation`, `reset_mfa` | `admin`, `superadmin` |
| Solicitudes de comercio | vista `commerce_requests_list` | `approve_commerce_request`, `reject_commerce_request` | `admin`, `superadmin` |
| Repartidores | vista `couriers_list` | `create_courier`, `update_courier`, `set_courier_status`, `courier-document-url` (Edge Function) | `admin`, `superadmin` |
| Incidentes de TI | vista `it_incidents_list` | `report_incident`, `set_incident_status` | Según matriz |
| Datos personales | `list_anonymization_candidates`, `get_client_detail` | `confirm_anonymization`, `export-data` (Edge Function) | `superadmin` |
| Auditoría | **Sin ruta de lectura** (ver 6) | n/a | `admin`, `superadmin` |
| Inicios de sesión | **Sin ruta de lectura para administradores** (ver 6) | n/a | `admin`, `superadmin` |
| Comercios y tiendas | **Sin vista pública** (ver 6) | n/a | `admin`, `superadmin` |

Actividad de sesión: un latido llama a `touch_session` mientras el usuario interactúa. El cierre por inactividad es de 15 minutos en la consola.

### 5.2 Tienda

| Pantalla | Lectura | Escritura |
|---|---|---|
| Registro | `auth.signUp` + Turnstile | n/a |
| Ingreso con Google | `auth.signInWithOAuth` | n/a |
| Ingreso con correo | `auth.signInWithPassword` + Turnstile | n/a |
| Recuperar contraseña | `auth.resetPasswordForEmail` | `auth.updateUser` |
| Perfil | vista `my_profile` | `update_my_profile` |
| Vende en Rapitrip | n/a | `submit_commerce_request` |
| Inicio | Sin datos de catálogo hasta F2 y F4 | n/a |

Regla de sesión del cliente: `has_valid_session` exige una sesión de menos de un día. Las lecturas y escrituras de perfil fallan pasado ese tiempo, y la interfaz debe llevar al cliente a volver a ingresar sin perder lo que escribía.

## 6. Brechas del backend que bloquean pantallas

Estas son lagunas que encontré al comparar el diseño con la base de datos. Ninguna es un error del backend F1; son lecturas que el diseño pide y que todavía no existen.

1. **Auditoría de eventos.** `audit.events` no tiene política de lectura (así lo dice la migración 5) y el esquema `audit` no se expone en la API (`[api] schemas = ["public"]`). La pantalla "Auditoría y accesos" necesita una función `public` de solo lectura, con filtros y paginación, que registre la propia consulta. El diseño del backend ya prevé "lecturas sensibles vía RPC auditada" (sección 11 del spec).
2. **Inicios de sesión.** `audit.login_events` solo tiene política para ver los propios. El registro global que el diseño asigna a `admin` y `superadmin` necesita la misma solución.
3. **Comercios y tiendas.** Hay políticas sobre `identity.commerces`, pero no una vista en `public`. Hace falta una vista (o función) de lectura para "Comercios y tiendas".
4. **Cola de correos y métricas del inicio.** Las tarjetas del inicio del director (pedidos, comercios sin actualizar catálogo) dependen de F2 y F3. En esta fundación el inicio muestra solo lo que sí existe: solicitudes pendientes, invitaciones abiertas e incidentes abiertos.
5. **Perfil del cliente en tienda.** No hay un rol ni vista de "mis solicitudes de comercio"; si se quiere mostrar el estado de una solicitud enviada, hace falta una vista propia.

Propuesta: resolver 1, 2 y 3 con una migración corta (funciones de lectura con `security definer`, `search_path=''`, pruebas pgTAP) antes de construir esas tres pantallas, siguiendo el patrón del proyecto.

## 7. Seguridad en el frontend

- La interfaz oculta; la base de datos decide. Ninguna acción depende de que un botón esté escondido.
- Cada acción de servidor y cada carga protegida vuelven a obtener la sesión y el rol del servidor. El middleware de Next.js solo sirve para redirigir con comodidad, nunca como única comprobación.
- Se usan cookies con `@supabase/ssr`; no se guarda el token en `localStorage`.
- Las variables públicas son solo la URL de Supabase y la clave anónima. La clave de servicio no se usa en el navegador. Las Edge Functions se invocan con el token del usuario.
- Turnstile se valida en el servidor de Supabase Auth (ya está configurado en el proyecto de prueba).
- Los mensajes de error al usuario son genéricos; el detalle se queda en los registros.
- Cabeceras: política de seguridad de contenido, `X-Frame-Options` y `Referrer-Policy`, definidas en `next.config`.
- Dependencias de Next.js al día, por la falla de 2025 en el middleware que cita la propuesta.

## 8. Pruebas

| Nivel | Herramienta | Qué cubre |
|---|---|---|
| Unitaria | Vitest | Guardias de rol, mapeo rol a ruta, formateadores, esquemas zod |
| Componentes | Vitest + Testing Library | Botón, campo, tabla, diálogo, aviso de expiración |
| Extremo a extremo | Playwright | Login, MFA, aceptar invitación, redirección por rol, expiración |
| Accesibilidad | axe en Playwright | Contraste, etiquetas, foco en las pantallas de acceso |
| Backend | pgTAP, Deno | Ya existen; se amplían con las funciones de la sección 6 |

Los flujos de Playwright usan el usuario semilla y la clave de Turnstile de prueba contra Supabase local, con `pnpm db:reset` antes de la ejecución.

## 9. Integración continua

Se agrega un trabajo `frontend` al flujo actual: instalar, `typecheck`, `lint`, pruebas de Vitest y `build` de ambas apps. Los flujos de Playwright se corren primero a mano y se pasan al CI cuando estén estables, porque requieren Supabase local. El despliegue a Vercel (un proyecto por app, omitiendo compilaciones sin cambios) queda preparado pero no activado.

## 10. Variables de entorno

| Variable | App | Público |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Ambas | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ambas | Sí |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Ambas | Sí |
| `NEXT_PUBLIC_SITE_URL` | Ambas | Sí |
| `SUPABASE_SERVICE_ROLE_KEY` | Consola (solo servidor, si hace falta) | No |

Cada app tiene su `.env.local` (ignorado por git) y un `.env.example` sin valores reales.

## 11. Orden de construcción propuesto

1. Workspace: `apps/*`, `packages/ui`, `packages/supabase`, scripts y CI. Entregable: ambas apps arrancan y muestran una página de marca.
2. Sistema de diseño: tokens, fuentes y componentes base con sus pruebas.
3. Cliente de Supabase y guardias de rol, con pruebas unitarias.
4. Consola, acceso: login con Turnstile, MFA, aceptar invitación, redirección, expiración y latido.
5. Consola, administración: usuarios y roles, solicitudes, repartidores, incidentes, datos personales, cuenta.
6. Migración de lecturas faltantes (sección 6) y las tres pantallas que dependen de ella: auditoría, inicios de sesión y comercios.
7. Tienda: registro, Google, ingreso, perfil, "Vende en Rapitrip" y manifiesto instalable.
8. Pruebas de extremo a extremo, ajuste de accesibilidad y ampliación del CI.

## 12. Riesgos y puntos a decidir

- **Sesión de 15 minutos y MFA.** Hay que comprobar con el flujo real que la renovación del token no rompa el estado aal2 ni la actividad; los espigones del backend ya lo probaron, falta la prueba desde el navegador.
- **Cookies y puertos distintos.** Tienda y consola corren en puertos diferentes en local. Las cookies de Supabase están separadas por origen, lo que es lo deseado; hay que confirmarlo.
- **Fuentes.** Dos familias aumentan el peso inicial de la tienda. Se mitiga con `next/font` y subconjuntos latinos.
- **shadcn/ui y Tailwind.** Conviene fijar versiones exactas desde el inicio para que el sistema de diseño no cambie sin aviso.
- **Decidido:** `cajero` y `coordinador` tienen áreas separadas (`/caja` y `/coordinacion`); ninguno ve ni accede a lo del otro.
