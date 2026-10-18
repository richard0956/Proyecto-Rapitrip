# Fundación del frontend: consola web, tienda web y sistema de diseño "Ruta"

Fecha de diseño: 16 de octubre de 2026
Última actualización: 17 de octubre de 2026 (refleja lo construido y verificado al cierre de la Fase 1)
Alcance: cimientos del frontend de la Etapa 1 (workspace, sistema de diseño, acceso y administración de identidad) y traspaso a la Fase 2.
Documentos relacionados: `docs/informe/Informe_Tecnico_Frontend_Rapitrip.md` (informe técnico), `docs/fase-1-puesta-en-marcha.md` (guía de puesta en marcha y lista de verificación manual), `docs/informe/Informe_Backend_Rapitrip.md` (backend).

> Nota de estado: este documento se volvió a escribir el 17 de octubre de 2026 porque el archivo original se perdió al reemplazar la carpeta del proyecto. Se reconstruyó desde el diseño aprobado y se corrigió contra el código real. Donde el código difiere del diseño original, se indica en la sección 4 ("Cambios respecto al diseño original"). Tampoco están en el repositorio la especificación y el plan del backend (`docs/superpowers/specs/2026-10-10-fundacion-backend-design.md` y `docs/superpowers/plans/2026-10-11-fundacion-backend.md`); conviene recuperarlos antes de planificar la Fase 2.

## 1. Intención

El backend de identidad, roles y auditoría (F1) está completo y probado. El frontend lo usa a través de dos aplicaciones web:

- **Consola web:** una sola aplicación para el director, el administrador, el equipo de caja, el equipo de coordinación y los comercios, con vistas distintas por rol.
- **Tienda web:** aplicación pública para el cliente, indexable, responsive e instalable en la pantalla de inicio.

Ambas son web. No hay aplicación móvil en la Etapa 1. La tienda se diseña móvil primero porque los clientes llegarán por enlaces compartidos en WhatsApp.

## 2. Objetivos, no objetivos y anti-objetivos

**Objetivos (cumplidos en la Fase 1)**
- Un monorepo con dos apps Next.js y paquetes compartidos, con un proyecto de Vercel por app (preparado, no activado).
- Un sistema de diseño propio ("Ruta") como tokens y componentes en un paquete compartido.
- La consola completa el flujo de acceso: inicio de sesión, segundo factor, aceptar invitación, sesión expirada y cuenta sin acceso.
- La consola cubre la administración de identidad que el backend expone.
- La tienda cubre registro, ingreso con correo y con Google, recuperación de contraseña, perfil y la solicitud "Vende en Rapitrip".
- Cada acción privilegiada se valida en el servidor, no solo en el proxy de Next.js.

**No objetivos de la Fase 1**
- Catálogo, inventario, carrito, checkout, pedidos, caja, liquidaciones y tablero en vivo (aparecen en el menú como "Pronto").
- Aplicación móvil del repartidor y del cliente.
- Despliegue a producción en Vercel y dominio propio.
- Modo oscuro.

**Anti-objetivos (fracaso aunque "funcione")**
- Que la autorización dependa solo del proxy o de ocultar botones.
- Que la consola y la tienda compartan rutas o código de roles de forma que un error de una afecte a la otra.
- Un aspecto genérico de plantilla, ajeno al estilo Ruta aprobado.
- Rutas duplicadas o archivos de la estructura anterior que tapan a los nuevos (ocurrió dos veces; ver sección 12).

## 3. Decisiones tomadas por el usuario

- Dos aplicaciones web separadas en el mismo repositorio: `apps/console` y `apps/store`.
- Consola única para todos los roles de personal y comercios, con una carpeta por área y sin importaciones entre ellas.
- Consola con la variante B del prototipo de Figma: fiel al prototipo, sin insignias de requisito ni selector de rol de prueba, con estados vacíos, de carga y de error, y tablas de alta densidad.
- Tienda con estructura propia, móvil primero y adaptada a escritorio, con la misma identidad visual que la consola.
- Estilo visual "Ruta", aprobado (la paleta final salió del logo; ver sección 6).
- Identidad con Supabase Auth, no Clerk. Segundo factor TOTP obligatorio para todos los roles de consola. Google solo para clientes.
- Los roles `cajero` y `coordinador` tienen áreas separadas en la consola (`/caja` y `/coordinacion`). Esto resuelve la decisión que había quedado abierta en el informe técnico.
- El rol `superadmin` se otorga solo por código; no existe forma de otorgarlo desde la interfaz.

## 4. Cambios respecto al diseño original

El diseño aprobado el 16 de octubre cambió al construirse. Los cambios siguientes se aceptaron o se corrigieron durante la Fase 1.

| Tema | Diseño original | Construido | Estado |
|---|---|---|---|
| Paleta | Selva `#0B4F45`, Hoja `#006C5F`, Mango `#F59E2B` como acento | Verde esmeralda `#24C08E` y azul marino `#0C4E67` sacados del logo; sin Mango | Aceptado (el logo definió la identidad) |
| Componentes base | shadcn/ui sobre Radix | Componentes propios con `class-variance-authority`, `clsx` y `tailwind-merge`, íconos de `lucide-react` | Aceptado |
| Datos en cliente | TanStack Query y Table | No se usan; tablas propias (`DataTable`) y datos desde el servidor | Aceptado; reevaluar si F2 necesita estado de cliente complejo |
| Cierre por inactividad | 15 minutos en la consola | 15 minutos (`SESSION_INACTIVITY_MINUTES = 15` y `inactivity_timeout = "15m"` en `supabase/config.toml`), igual que la ventana de actividad de la base de datos | **Confirmado el 17 de octubre de 2026**: 15 minutos (antes estaba en 10) |
| Sesión del cliente | 1 día | 24 horas (`has_valid_session`) | Igual |
| Áreas de la consola | `admin`, `operations`, `comercio` | `admin`, `caja`, `coordinacion`, `comercio` | Aceptado |
| Lecturas de auditoría, accesos y comercios | Sin ruta de lectura | Migración 17 (`admin_reads`) con funciones auditadas | Resuelto |
| Estado de las solicitudes para el cliente | No previsto | Migración 18 (`commerce_request_views`) con `my_commerce_requests` | Añadido |
| Puertos | Tienda 3000, consola 3001 | Igual | Igual |
| Cookies de sesión | Compartidas por origen | Nombres propios: `rapitrip-console-auth` y `rapitrip-store-auth` | Añadido |

## 5. Estructura del repositorio

```
apps/
  console/            Next.js, puerto 3001
    src/app/
      (acceso)/       login, mfa, aceptar-invitacion, sesion-expirada, sin-acceso
      admin/          inicio, usuarios, solicitudes, comercios, repartidores, auditoria, accesos, incidentes, datos-personales
      caja/           inicio del área (resto pendiente, F3)
      coordinacion/   inicio del área (resto pendiente, F3 y F6)
      comercio/       inicio del área (el resto llega en la Fase 2)
      cuenta/         mi cuenta
    src/lib/nav.ts    menú por área; las pantallas de fases posteriores llevan `soon: true`
  store/              Next.js, puerto 3000
    src/app/
      (acceso)/       ingresar, registro, recuperar, recuperar/nueva
      (tienda)/       inicio, perfil, vende, terminos, privacidad
      auth/callback   cierra el intercambio PKCE (Google, confirmación de correo, recuperación)
packages/
  ui/                 tokens, componentes, movimiento y portada de marca
  supabase/           clientes (navegador y servidor), sesión, roles y decisión de acceso
  db-types/           tipos generados de la base (se regeneran con pnpm db:types)
  validation/         esquemas zod compartidos
e2e/                  Playwright y axe (workspace propio)
supabase/             migraciones 1 a 18, pruebas pgTAP, Edge Functions, semillas y plantillas de correo
```

Reglas de dependencia:
- Las apps dependen de los paquetes; los paquetes no dependen de las apps.
- Las carpetas por área de la consola no se importan entre sí.
- `packages/ui` no conoce Supabase.
- Una ruta existe una sola vez: si una pantalla pasa a un grupo de rutas, la carpeta anterior se elimina en el mismo cambio.

## 6. Sistema de diseño "Ruta" (`packages/ui`)

**Identidad.** Sale del logo: verde esmeralda como color principal y azul marino como secundario, sobre un fondo claro y fresco. Los nombres de los tokens se conservaron de la primera versión (`selva` es la superficie oscura y `hoja` la acción principal) para no tocar cada componente.

**Tokens** (`packages/ui/src/tokens.css`, expuestos también como preset de Tailwind en `tailwind-preset.cjs`):

| Token | Valor | Uso |
|---|---|---|
| `selva` | `#06362A` | Superficie oscura (barra lateral) |
| `selva-panel` | `#0A4A39` | Paneles sobre `selva` |
| `hoja` | `#0B7A57` | Acción principal, enlaces, estado activo |
| `esmeralda` | `#24C08E` | Color principal de la marca |
| `marino` | `#0C4E67` | Color secundario de la marca |
| `exito` | `#0B6B4B` | Estados correctos |
| `menta`, `menta-borde`, `bruma` | `#DCF6EC`, `#A9E4CD`, `#B4E6D2` | Fondos suaves e insignias |
| `crema` | `#F4F8F5` | Fondo de página |
| `papel` | `#FCFDFB` | Tarjetas |
| `borde`, `borde-campo` | `#E2EBE5`, `#CCD8D0` | Bordes de tarjeta y de campo |
| `tinta`, `tinta-suave` | `#14231D`, `#55645D` | Texto y texto secundario |
| `calido`, `durazno`, `lavanda`, `rosa` | `#FFF4E6`, `#FFE9D6`, `#E3E8FF`, `#FDE7E4` | Fondos de insignias neutras o de aviso |
| `rojo`, `naranja`, `durazno-texto` | `#A53B3B`, `#D96C2A`, `#9E4300` | Errores y advertencias |

**Tipografía.** Bricolage Grotesque (títulos) y Plus Jakarta Sans (texto), cargadas con `next/font/google` como `--font-titulo` y `--font-texto`.

**Motivo de marca.** La línea de "ruta" (nodos unidos por una línea punteada) aparece en el seguimiento, los estados vacíos y los pasos. La portada y la introducción de marca (`intro-splash.tsx`, `lema.tsx`, `motion.css`) respetan `prefers-reduced-motion`.

**Componentes existentes:** alerta, avatar, insignia, botón, tarjeta, indicador (`kpi-card`), campo de texto, campo de selección, área de texto, campo de código de seis dígitos, diálogo, estado vacío, tabla y tabla de datos, pestañas en píldora, logo, aparición progresiva (`reveal`), introducción de marca, widget de Turnstile y estructura de las pantallas de acceso (`auth-layout`).

**Reglas de uso**
- Ningún componente usa un color fuera de los tokens.
- Un solo botón primario por vista.
- Contraste mínimo 4.5:1, foco visible, objetivos táctiles de 44 px en la tienda y etiquetas siempre visibles en los formularios.
- Un elemento con `aria-label` debe incluir en su nombre accesible el texto que se ve (WCAG 2.5.3). El enlace del avatar de la consola se corrigió por esta regla.
- Redacción en español, minúsculas después de la primera palabra, verbo al inicio en los botones y sin signos de exclamación en el sistema.

## 7. Pila técnica

| Capa | Elección |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), React 19, TypeScript estricto (hereda `tsconfig.base.json`) |
| Estilos | Tailwind CSS 3.4 con el preset de `packages/ui` |
| Componentes | Propios, con `class-variance-authority`, `clsx`, `tailwind-merge` y `lucide-react` |
| Sesión | `@supabase/ssr` con cookies; `proxy.ts` renueva la sesión y redirige por comodidad |
| Validación | `@rapitrip/validation` (zod) |
| Tipos de base de datos | `@rapitrip/db-types`, regenerados con `pnpm db:types` |
| CAPTCHA | Cloudflare Turnstile en ingreso, registro y recuperación; se activa con `NEXT_PUBLIC_TURNSTILE_SITE_KEY` y el secreto en `supabase/.env` |
| Pruebas | Vitest (lógica y componentes), Playwright y axe (extremo a extremo y accesibilidad) |
| Gestor de paquetes | pnpm 11 con política de antigüedad mínima de paquetes |

## 8. Roles, accesos y rutas

El token de acceso incluye los roles en el claim `app_roles` (hook `custom_access_token`). La decisión de acceso vive en `packages/supabase/src/roles.ts`.

| Rol en BD | Nombre en pantalla | Área de la consola | Ruta de inicio |
|---|---|---|---|
| `superadmin` | Director | `admin` (incluye datos personales) | `/admin` |
| `admin` | Administrador | `admin` | `/admin` |
| `cajero` | Caja | `caja` | `/caja` |
| `coordinador` | Coordinación | `coordinacion` | `/coordinacion` |
| `comercio` | Comercio | `comercio` | `/comercio` |
| `cliente` | Cliente | Solo la tienda | `/sin-acceso` si entra a la consola |

- Prioridad cuando una cuenta tiene varios roles: `superadmin`, `admin`, `coordinador`, `cajero`, `comercio`, `cliente`.
- Todos los roles de consola exigen segundo factor (`requiresMfa`).
- Estados de acceso: sin sesión va a `/login`; con contraseña pero sin segundo factor va a `/mfa`; cuenta sin rol, suspendida o revocada va a `/sin-acceso`; sesión vencida por inactividad va a `/sesion-expirada`.
- Una sesión de Google no cumple `has_strong_session` (exige contraseña en la sesión, segundo factor y actividad reciente), así que no habilita acciones privilegiadas aunque la cuenta tenga rol de administración.

## 9. Mapa de pantallas a backend

### 9.1 Consola

| Pantalla | Lectura | Escritura |
|---|---|---|
| Mi cuenta | vistas `my_profile`, `my_roles` | `update_my_profile` |
| Usuarios y roles | `accounts_staff`, `invitations_list` | Edge Function `invite-staff`; `suspend_role`, `reactivate_role`, `revoke_role`, `cancel_invitation`, `reset_mfa` |
| Aceptar invitación | `begin_accept_invitation` | Edge Function `accept-invitation` |
| Solicitudes de comercio | `commerce_requests_list` (con `details`) | `approve_commerce_request`, `reject_commerce_request` |
| Comercios y tiendas | vista `commerces_list` (migración 17) | n/a |
| Repartidores | `couriers_list` | `create_courier`, `update_courier`, `set_courier_status`; Edge Function `courier-document-url` |
| Incidentes de TI | `it_incidents_list` | `report_incident`, `set_incident_status` |
| Datos personales | `list_anonymization_candidates`, `get_client_detail` | `confirm_anonymization`; Edge Function `export-data` |
| Auditoría y accesos | `audit_events_page` y `login_events_page` (migración 17); cada consulta queda registrada | n/a |

Latido de actividad: mientras el usuario interactúa se llama a `touch_session`. Sin actividad por 15 minutos la consola cierra la sesión.

### 9.2 Tienda

| Pantalla | Lectura | Escritura |
|---|---|---|
| Registro | n/a | `auth.signUp` con Turnstile; aceptación de términos guardada en los metadatos |
| Ingreso | n/a | `signInWithPassword` o `signInWithOAuth` (Google) |
| Recuperar contraseña | n/a | `resetPasswordForEmail`, `updateUser`; responde igual para cuentas que existen y que no |
| Perfil | `my_profile` | `update_my_profile` |
| Vende en Rapitrip | `my_commerce_requests` (estado, motivo de rechazo) | `submit_commerce_request`; con solicitud pendiente el formulario se oculta |
| Términos y privacidad | texto en `apps/store/src/lib/legal.ts` (`LEGAL_VERSION`) | n/a |

Sesión del cliente: pasada la ventana de 24 horas, las vistas propias dejan de responder y la tienda muestra "tu sesión venció".

## 10. Seguridad en el frontend

- La interfaz oculta; la base de datos decide. Ninguna acción depende de que un botón esté escondido.
- Cada carga protegida y cada acción de servidor vuelven a obtener la sesión y el rol (`requireConsoleAccess` y equivalentes). `proxy.ts` solo redirige por comodidad.
- Cookies con `@supabase/ssr`, con nombre propio por app; el token no se guarda en `localStorage`.
- Variables públicas: solo la URL de Supabase, la clave anónima, la clave pública de Turnstile y valores de configuración. La clave de servicio no se usa en el navegador.
- Mensajes de error genéricos hacia el usuario; el detalle queda en el registro del servidor.
- Cabeceras en `next.config.mjs` de ambas apps: Content-Security-Policy (solo Supabase y `challenges.cloudflare.com`), `frame-ancestors 'none'`, Permissions-Policy, Referrer-Policy, `X-Content-Type-Options` y, en producción, HSTS. `'unsafe-inline'` en scripts sigue siendo necesario por la hidratación de Next; migrar a nonces es una mejora futura.
- `allowedDevOrigins: ["127.0.0.1"]` en ambos `next.config.mjs`: las apps se abren en `http://127.0.0.1` y, sin esta opción, Next bloquea la hidratación en desarrollo y los botones no responden. Debe conservarse al editar esos archivos (se perdió dos veces).
- Redirecciones `next` validadas con `safeNext` para evitar redirecciones abiertas.

## 11. Pruebas y CI

| Nivel | Herramienta | Estado al cierre de la Fase 1 |
|---|---|---|
| Base de datos | pgTAP | 19 archivos, 297 pruebas |
| Unitarias y de componentes | Vitest | `validation` 9, `ui` 25, `supabase` 14, `console` 22, `store` 27 |
| Accesibilidad y movimiento | Playwright y axe (`pnpm e2e:front`) | 35 pruebas; corren en el CI |
| Flujos con backend | Playwright (`pnpm e2e:backend`) | 14 pruebas; se corren a mano con Supabase local |
| Edge Functions | Deno | `pnpm fn:test` |

Para correr `e2e:backend` hacen falta `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` de la instancia local, y Chromium de Playwright instalado.

Integración continua (`.github/workflows/ci.yml`): un trabajo `backend` (Supabase local, pgTAP, lint de base de datos, Deno, pruebas de paquetes y comprobación de que los tipos generados están al día) y un trabajo `frontend` (typecheck, lint, pruebas, compilación de ambas apps y `e2e:front`).

Regla de terminado: una tarea está terminada cuando las pruebas pasan, el CI está en verde y los permisos se verificaron.

## 12. Lecciones y riesgos conocidos

- **Carpetas duplicadas al reorganizar rutas.** Al mover pantallas a grupos de rutas quedaron las carpetas anteriores y rompieron la compilación de la consola (`login`, `mfa`, `aceptar-invitacion`, `sesion-expirada`, `sin-acceso`, `operations`) y la portada de la tienda (`app/page.tsx` tapaba a `(tienda)/page.tsx`). La prueba de movimiento del CI detectó el segundo caso. Regla: mover y eliminar en el mismo cambio, y compilar antes de dar la tarea por terminada.
- **Configuración que se pierde al copiar carpetas.** `allowedDevOrigins`, los `.env` locales y la copia de seguridad del historial de git desaparecieron al reemplazar la carpeta del proyecto. Los `.env.local` se recrean con `supabase status`; ningún secreto va al repositorio.
- **Política de antigüedad de paquetes.** Si `pnpm install` falla con `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, se regenera el lockfile con `pnpm clean --lockfile` y luego `pnpm install`. Los scripts de instalación de `unrs-resolver` están desactivados en `pnpm-workspace.yaml`.
- **Configuración de Supabase.** El archivo `config.toml` solo se lee al iniciar: tras cambiarlo hay que correr `pnpm db:stop` y `pnpm db:start`. Con Google activado hacen falta las credenciales en `supabase/.env`, o el arranque falla.
- **Renovación de la sesión con segundo factor.** Está probada a nivel de base de datos; falta confirmarla desde el navegador (riesgo del informe técnico §12).
- **Riesgo legal.** Los textos de `/terminos` y `/privacidad` son una base redactada según el comportamiento real del sistema y deben revisarse con un abogado antes de publicar (Ley 787).
- **Decisión resuelta.** El cierre por inactividad de la consola es de 15 minutos (sección 4).

## 13. Pendientes de la Fase 1

Estado al 17 de octubre de 2026.

| # | Pendiente | Estado |
|---|---|---|
| 1 | Revisión legal de los textos (Ley 787) | Abierto: lo hace una persona abogada; fuera del código |
| 2 | Confirmar el plazo de inactividad (10 o 15 minutos) | Resuelto: 15 minutos en la interfaz, en `config.toml` y en la base de datos (`has_strong_session`) |
| 3 | Prueba manual de la lista de `docs/fase-1-puesta-en-marcha.md` | Parcial: la renovación del token con segundo factor y las sesiones simultáneas de tienda y consola ya tienen E2E (`e2e/tests/sesion.spec.ts`); el resto de la lista sigue siendo manual |
| 4 | Credenciales reales de Google, Cloudflare y Resend; rotar el secreto de Google compartido en una conversación | Abierto: solo el titular de las cuentas. El repositorio no contiene secretos (solo `.env.example` vacíos) |
| 5 | Despliegue en Vercel y dominio propio | Abierto: se decide al pasar a producción |
| 6 | Recuperar la especificación y el plan del backend | Resuelto como referencia: `docs/backend-referencia.md`, reconstruida desde las migraciones y la base viva |

**Verificado el 17 de octubre de 2026:** la renovación del token (dura 5 minutos) mantiene `aal2` y la sesión fuerte durante 20 minutos de actividad simulada; consola y tienda conviven en el mismo navegador sin cerrarse entre sí; la suite pgTAP completa (24 archivos, 392 pruebas) pasa sobre una base limpia; los E2E de comercio y de accesibilidad pasan con las apps compiladas para producción.

**Corrección posterior:** el horario de las tiendas y la moneda por defecto se habían fijado para Costa Rica por error. Rapitrip opera en Nicaragua: ahora se usa `America/Managua` (migración 24) y el córdoba (`NIO`, configurable con `NEXT_PUBLIC_CURRENCY`).

## 14. Traspaso a la Fase 2: área de comercio

**Alcance según la propuesta v4 (Tabla 1, F2):** catálogo por tienda, inventario, horarios y apertura o cierre temporal. La tienda pública con catálogo, carrito y checkout pertenece a F4.

**Lo que ya existe para apoyarla**
- Rol `comercio` con área `/comercio` protegida, segundo factor y entrada por invitación o por aprobación de solicitud.
- Aprobación de solicitudes que crea el comercio y su cuenta.
- Lectura de comercios para la administración (migración 17).
- Menú de la consola con "Catálogo maestro" y "Configuración" ya marcados como "Pronto".
- Sistema de diseño con tablas, diálogos, campos, estados vacíos y pestañas listos para reutilizar.
- Marco de pruebas: pgTAP, Vitest, Playwright con axe y flujos con backend.

**Lo que falta (backend)**
- Tablas y políticas de tiendas por comercio, horarios, apertura y cierre temporal, catálogo maestro (categorías, marcas, tipos de producto, atributos), productos, variantes (precio y SKU) e inventario, con alertas de stock bajo y ocultamiento de agotados.
- Reglas de acceso por comercio (un usuario con rol `comercio` solo ve y modifica lo suyo) con pruebas en la matriz de permisos.
- Almacenamiento de imágenes de producto en Storage, con políticas por comercio.
- Auditoría de cambios de catálogo e inventario, sin valores personales.

**Lo que falta (frontend), tomando como guía las pantallas del prototipo de Figma**
- Área `comercio`: Inicio, Mis tiendas, Catálogo de la tienda, Editor de producto e Inventario (pantallas CW-M01, M03, M04, M05 y M06). "Pedidos por confirmar" (M02) y "Métricas" dependen de F3 y quedan fuera.
- Área `admin`: Catálogo maestro (CW-A05) y la gestión completa de comercios y tiendas.
- Selección de tienda activa cuando un comercio tiene varias.
- Carga de imágenes y edición de productos con validación compartida en `@rapitrip/validation`.

**Decisiones a tomar al abrir la Fase 2**
- Si el catálogo maestro es obligatorio para publicar un producto o solo orientativo.
- Reglas de stock: reserva en el checkout (F3) y ajustes manuales con motivo.
- Si hace falta estado de cliente complejo (por ejemplo, edición de varios productos a la vez); de ser así, evaluar TanStack Query y Table, que se descartaron en la Fase 1.
- Tamaño y formato de imágenes, y si el comercio puede subir en lote.
- Horarios: por tienda, con excepciones por fecha.

**Orden sugerido**
1. Esquema de tiendas, horarios y apertura o cierre, con RLS y pruebas pgTAP.
2. Pantallas "Mis tiendas" y selección de tienda.
3. Catálogo maestro (backend y pantalla de administración).
4. Productos y variantes (backend, lista y editor).
5. Inventario con alertas.
6. Pruebas de extremo a extremo del área de comercio y ampliación del CI.

Cada etapa sigue el flujo del proyecto: diseño aprobado, plan de implementación y ejecución con verificación.

## 15. Avance de la Fase 2 (rama `fase-2-comercio`)

Estado al 17 de octubre de 2026.

| Etapa | Estado | Qué incluye |
|---|---|---|
| 1. Tiendas, horarios y cierres (backend) | Hecha | Migración 19 (`commerce.stores`, `store_hours`, `store_exceptions`), RLS por comercio, funciones auditadas (`create_store`, `update_store`, `set_store_status`, `set_store_hours`, `set_store_exception`, `close_store_temporarily`, `reopen_store`), vistas `stores_list`, `store_hours_list`, `store_exceptions_list` y pruebas pgTAP (`190_stores`) |
| 2. Mis tiendas (frontend) | Hecha | Área `comercio` con su propio diseño, inicio con indicadores, lista de tiendas, detalle con datos, horario semanal por tramos, excepciones por fecha, cierre temporal y activación; columna "Tiendas activas" en Comercios (admin) |
| 3. Catálogo maestro | Hecha | Migración 20 (`commerce.master_items`: categorías con un nivel de subcategorías, marcas, tipos de producto y atributos), funciones auditadas, pruebas pgTAP (`200`) y pantalla `admin/catalogo`. **Decidido: orientativo**, publicar un producto no lo exige |
| 4. Productos y variantes | Hecha | Migración 21 (`products`, `product_variants`, `product_images`, bucket público `product-images`), funciones auditadas, pruebas pgTAP (`210`) y pantallas `comercio/catalogo` (selección de tienda, lista, editor con variantes, imágenes y publicación). Imágenes: hasta 5, JPEG/PNG/WebP, 2 MB; publicar exige una variante activa |
| 5. Inventario con alertas | Hecha | Migración 22 (`inventory`, `stock_movements`), control de stock opcional por variante con umbral, entradas, salidas y conteos con motivo e historial, estado `sin_control`/`agotado`/`bajo`/`disponible` (y `available` para ocultar agotados en F4), pruebas pgTAP (`220`), pantalla `comercio/inventario` y alerta en el inicio del comercio |
| 6. E2E del área de comercio y CI | Hecha | `e2e/tests/comercio.spec.ts` (3 flujos con backend real y axe en cada pantalla) y trabajo `e2e-operaciones` en el CI, que levanta Supabase local, compila las apps y los corre |

**Decisiones tomadas en las etapas 1 y 2**
- Los horarios son por tienda, con varios tramos por día y excepciones por fecha (que mandan sobre el horario semanal).
- La hora de evaluación es la de Nicaragua (`America/Managua`, UTC−6 sin horario de verano) y la moneda por defecto es el córdoba (`NIO`); el cierre temporal admite hasta 90 días y se puede reabrir a mano.
- Una tienda sin horario nunca aparece abierta. Desactivar una tienda exige motivo y conserva su historial.
- Un comercio gestiona solo sus tiendas; administración y dirección ven todas. Toda escritura exige sesión de consola con segundo factor.

**Hallazgo corregido en la etapa 6**
- La sesión de consola exige actividad registrada con `touch_session`, pero el primer latido llegaba hasta 15 segundos después de entrar: en ese lapso, las lecturas y escrituras protegidas fallaban o devolvían listas vacías. Ahora se envía un latido al verificar el segundo factor (`mfa-form.tsx`) y otro al montar la consola (`session-activity.tsx`).

**Pendiente de verificar**
- Recorrido manual con ojos humanos del área de comercio (los E2E cubren funcionamiento y accesibilidad, no criterio visual).
- Que el trabajo `e2e-operaciones` pase por primera vez en GitHub Actions (no se pudo ejecutar localmente).
- La suite pgTAP completa falla en las pruebas 050, 070 y 130 sobre la base local actual (tiene 33 cuentas reales que alteran los conteos). Hay que correr `pnpm db:reset` antes de `pnpm db:test` para confirmar que pasan en limpio; el archivo 190 pasa solo.

### Cierre de la Fase 2 en `main`

Con todo integrado en `main`, se añadió lo que faltaba del alcance:
- **Gestión de comercios (admin):** migración 23 con `set_commerce_status` (suspender o reactivar con motivo, auditado y pgTAP `230`). Un comercio suspendido pierde el acceso de su cuenta y sus tiendas figuran cerradas; al reactivar todo vuelve igual. Pantalla `admin/comercios/[id]` con tiendas, productos por tienda, cuenta del comercio y el control de estado.
- **Auditoría legible:** etiquetas en español para todas las acciones nuevas (tiendas, catálogo maestro, productos, variantes, inventario y estado de comercio).
- **Accesibilidad:** las tablas con desplazamiento horizontal ahora son una región enfocable por teclado (axe lo marcó en la pantalla de detalle).
- **E2E:** cuarto flujo (director revisa tiendas, suspende el comercio y verifica la pérdida de acceso y la auditoría).

**Fuera de la Fase 2:** pedidos por confirmar y métricas del comercio (F3), catálogo público con carrito y checkout (F4). *El backend de pedidos y de pagos con Stripe de F3 ya está construido; ver `Informe_Frontend_Completo_Rapitrip.md`, sección 8.2.*

## 16. Traspaso a la Fase 3: pedidos, cobros, caja y venta

Estado al 17 de octubre de 2026. Análisis contra el código de `main`; todavía no hay código de F3.

**Alcance según la propuesta (Tabla 6 del informe del backend):** motor de pedidos, cobros con Tilopay, caja y venta. El checkout público y el carrito son de F4; F3 deja listo el motor que F4 consume.

**Lo que ya existe y F3 reutiliza**
- Catálogo, variantes con precio e inventario con `track_stock`, `stock_state` y `available` (migraciones 21 y 22). La migración 22 deja anotado que la reserva de stock en el checkout llega con F3.
- Tiendas con `open_now` en hora de Nicaragua y cierre temporal: un pedido solo se acepta en una tienda abierta.
- Roles `cajero` y `coordinador` con áreas `/caja` y `/coordinacion` ya protegidas por MFA y sesión de 15 minutos, pero con un inicio provisional (`AreaHome`).
- Entradas de menú marcadas como "Pronto": `/admin/pedidos`, `/admin/tablero`, `/admin/excepciones`, `/admin/caja`.
- Repartidores (`identity.couriers`) para asignar entregas, y el patrón de auditoría (`private.write_audit`) y de funciones `security definer` con motivo.
- Edge Functions y bandeja de correos (`email_outbox`) para avisos al cliente.

**Lo que falta**

| Capa | Pieza |
|---|---|
| Backend | Esquema `orders`: `orders`, `order_items` (con copia del nombre y del precio al momento de la compra), `order_events` (historial de estados) y `payments` |
| Backend | Máquina de estados del pedido (propuesta: `pendiente_pago` → `por_confirmar` → `confirmado` → `preparando` → `listo` → `en_camino` → `entregado`, y `cancelado` / `rechazado` con motivo) y funciones auditadas para cada transición, con permisos por rol |
| Backend | Reserva de stock atómica al crear el pedido (`for update` sobre `inventory`), liberación al cancelar o vencer, y descuento definitivo al confirmar, todo con `stock_movements` |
| Backend | Pagos: Edge Function para crear el cobro en Tilopay y otra para el webhook (firma verificada, idempotente por referencia), con modo simulado para local y pruebas |
| Backend | Caja: venta de mostrador, cobro en efectivo o tarjeta, apertura y cierre de caja por cajero con diferencia registrada |
| Frontend | Área `comercio`: Pedidos por confirmar (CW-M02) y Métricas |
| Frontend | Área `caja`: nueva venta, cobro, caja del día y cierre |
| Frontend | Área `coordinacion`: lista de pedidos, asignación de repartidor y seguimiento |
| Frontend | Área `admin`: Pedidos, Excepciones y Caja y venta (activar los ítems "Pronto") |
| Pruebas | pgTAP de la máquina de estados, reserva y concurrencia; Deno para el webhook; E2E de un pedido de punta a punta |

**Orden sugerido (cada etapa con diseño aprobado, plan y verificación, como en F2)**
1. Esquema de pedidos, estados y reserva de stock, con RLS y pgTAP.
2. Comercio: Pedidos por confirmar (aceptar, rechazar con motivo, marcar listo) y métricas básicas.
3. Pagos con Tilopay: creación del cobro y webhook, primero en modo simulado.
4. Caja y venta: venta de mostrador y cierre de caja (`/caja`).
5. Coordinación: asignación de repartidor y seguimiento (`/coordinacion`).
6. Administración: Pedidos, Excepciones y Caja y venta.
7. E2E de punta a punta y ampliación del CI.

**Decisiones a tomar antes de la etapa 1** *(resueltas; ver sección 17)*
- Estados exactos del pedido y quién puede mover cada uno (comercio, cajero, coordinador, admin).
- Tiempo máximo de un pedido sin pagar o sin confirmar antes de liberar el stock.
- Si un pedido con varias tiendas es un solo pedido o uno por tienda.
- Métodos de pago de la Etapa 1 (tarjeta por Tilopay, efectivo en caja, contra entrega) y si hay comisión que registrar.
- Cómo se calcula y se muestra el costo de envío (no existe todavía en el esquema).
- Política de cancelación y reembolso, y quién la ejecuta.
- Qué ve cada área: el cajero no debe ver datos personales del cliente más allá de lo necesario para la entrega.

**Dependencias externas:** credenciales de Tilopay (sandbox y producción), dominio público para el webhook y revisión legal de las condiciones de cobro.

**Pendiente de verificar en esta revisión:** el recorrido visual con Playwright de ambas apps (consola en `:3001`, tienda en `:3000`). Los servidores corren en la máquina de la persona usuaria y no eran alcanzables desde la sesión en la nube; queda para una sesión local.

## 17. Avance de la Fase 3

Estado al 18 de octubre de 2026.

| Etapa | Estado | Qué incluye |
|---|---|---|
| 1. Esquema de pedidos, estados y reserva de stock | Hecha (backend) | Migración 25 (esquema `sales`: `orders`, `order_items`, `order_events`, `order_delivery`), `create_order`, `set_order_status`, `assign_order_courier`, `mark_order_paid` (solo servicio), `set_store_delivery_fee`, vencimiento automático cada 5 minutos, vistas `orders_list`, `order_items_list`, `order_events_list` y `order_delivery_list`, pgTAP `250` (43 pruebas) |
| 2. Comercio: pedidos por confirmar y métricas | Hecha | Pantalla `/comercio/pedidos` (pestañas Por confirmar, En curso y Terminados; detalle con productos, totales y pago; confirmar, rechazar con motivo, preparar, marcar listo y cancelar con motivo; la lista se actualiza sola cada 30 segundos y salta a la pestaña del nuevo estado), tarjetas «Pedidos por confirmar» y «Ventas de hoy» en el inicio y entrada «Pedidos» en el menú. E2E en `e2e/tests/comercio.spec.ts` |
| 3. Pagos | Hecha (backend), con **Stripe** en lugar de Tilopay | Migración 26 y funciones de borde `stripe-checkout`, `stripe-webhook` y `process-refunds`; pgTAP `260`, Deno `stripe_test.ts` y E2E reales contra Stripe en modo prueba (`e2e/tests/pagos.spec.ts`). Detalle en `Informe_Frontend_Completo_Rapitrip.md`, sección 8.2.1 |
| 4. Caja y venta de mostrador | Hecha | Migración 27: turnos de caja (monto inicial, cierre contando el efectivo con diferencia y nota), ventas de mostrador (efectivo o tarjeta en terminal externo, sin cliente ni envío, ya pagadas y entregadas, descuentan stock), anulación dentro del turno abierto, catálogo de mostrador, vistas `cash_sessions_list` y `orders_list` con canal. Pantalla `/caja` (abrir turno, vender con vuelto, anular con motivo, cerrar). pgTAP `270` (36) y E2E `e2e/tests/caja.spec.ts` |
| 5. Coordinación: repartidor, despacho y entrega | Hecha (solo frontend: el backend ya existía) | Pantalla `/coordinacion` con pestañas Para despachar, En camino, En preparación, Por confirmar y Terminados; detalle con dirección, teléfono y notas de entrega (los lee solo coordinación y administración), productos, pago y aviso de efectivo por cobrar; asignar o cambiar repartidor, despachar (exige repartidor), marcar como entregado y cancelar con motivo; actualización cada 30 segundos y salto de pestaña al responder. Usa `assign_order_courier` y `set_order_status`. E2E `e2e/tests/coordinacion.spec.ts` |
| 6. Administración: pedidos, excepciones y caja | Hecha | Migración 28 (vista `payment_events_list`: pagos de Stripe por reembolsar, solo administración; pgTAP `280`). Pantallas `/admin/pedidos` (todos los pedidos web y ventas de mostrador, con filtros por estado, canal y número o tienda; detalle con dirección, repartidor, cajero y productos; cancelar con motivo), `/admin/excepciones` (listos sin repartidor, sin respuesta del comercio por más de 20 minutos, en camino por más de 60, reembolsos pendientes y pagos por reembolsar en Stripe; cada caso enlaza al detalle) y `/admin/caja` (turnos de todo el equipo con diferencia y nota, y las ventas de cada turno; filtro «Solo con diferencia»). Se activan los ítems «Pedidos», «Excepciones» y «Caja y venta» del menú. E2E `e2e/tests/admin-operaciones.spec.ts` |
| 7. E2E de punta a punta y CI | Hecha | `e2e/tests/pedido-completo.spec.ts` (cliente, comercio, coordinación y administración en navegadores separados) y el trabajo `e2e-operaciones` del CI, que ahora sirve las Edge Functions y corre `pnpm e2e:operaciones` (comercio, caja, coordinación, administración y pedido de punta a punta). Los E2E de Stripe siguen manuales |

**Fase 3 cerrada (18 de octubre de 2026)** en backend y en las cuatro áreas de la consola. Quedan fuera, a propósito, y pasan a F4: el carrito, el checkout y la pantalla de pago de la tienda (incluida la ruta `/pedidos/<id>` a la que Stripe redirige), y las acciones de puesta en marcha: endpoint del webhook de Stripe en producción, un programador que llame a `process-refunds` cada minuto y la conversión de moneda con Stripe.

**Decisiones tomadas por defecto en la etapa 1** (se pueden cambiar antes de construir las pantallas)
- **Un pedido por tienda.** Un carrito con productos de varias tiendas se divide en pedidos separados (lo resuelve F4).
- **Estados:** `pendiente_pago`, `por_confirmar`, `confirmado`, `preparando`, `listo`, `en_camino`, `entregado`, `cancelado`, `rechazado`. Con tarjeta el pedido nace en `pendiente_pago`; en efectivo, en `por_confirmar`.
- **Quién mueve cada estado:** el cliente cancela mientras no esté confirmado; el comercio confirma, rechaza, prepara y deja listo (y cancela hasta que esté listo); coordinación y administración despachan, entregan y cancelan cualquier pedido abierto. Rechazar y cancelar exigen motivo.
- **Reserva de stock:** al crear el pedido se descuenta del inventario controlado y queda un movimiento (`Pedido N`). Cancelar, rechazar o vencer lo devuelve.
- **Vencimiento:** 30 minutos sin pagar con tarjeta, 45 minutos sin que el comercio confirme.
- **Envío:** costo fijo por tienda (`stores.delivery_fee`, 0 por defecto).
- **Límite:** un cliente no puede tener más de 5 pedidos sin resolver (evita acaparar stock).
- **Privacidad:** dirección y teléfono de entrega viven en `order_delivery`; el comercio y el cajero no los leen, y se borran al anonimizar la cuenta (el pedido y sus montos se conservan).
- **Cajero:** solo ve sus propias ventas de mostrador y sus turnos (etapa 4); no ve pedidos de la tienda web ni datos de clientes.
- **Venta de mostrador (etapa 4, decisiones por defecto):** un turno abierto por cajero; el efectivo esperado es el inicial más las ventas en efectivo no anuladas (las de tarjeta en terminal no cuentan); una diferencia al cerrar exige nota; el cajero puede vender productos de cualquier tienda activa (si cada caja debe atarse a una tienda, se ajusta); anular solo dentro del turno abierto y de la propia venta.

**Corrección incluida:** `set_store_exception` comparaba la fecha con la del servidor (UTC); entre las 18:00 y las 24:00 de Managua rechazaba cerrar la tienda "hoy". Ahora usa la fecha de Nicaragua (y la prueba 190 también).

**Verificación posterior (18 de octubre de 2026):** sobre Supabase local real, `pnpm db:reset` y la suite pgTAP completa pasan (26 archivos, 483 pruebas), los tipos generados coinciden con los escritos a mano y se corrigió un error de stock encontrado al probar (cancelar un pedido hecho antes de activar el control de stock sumaba unidades que nunca se habían descontado; ahora cada renglón guarda `stock_reserved`).

**Cómo se verificó originalmente:** en esa sesión no había Docker ni Supabase CLI; se aplicaron las 25 migraciones sobre un PostgreSQL 16 local con simulaciones mínimas de `auth`, `storage` y `pg_cron`, y se corrieron las pruebas con un sustituto de pgTAP. Pasan `250` (43 de 43) y el resto de la suite que usa las mismas funciones. **Falta** correr `pnpm db:reset && pnpm db:test` en un entorno con Supabase real, y regenerar los tipos con `pnpm db:types` (los de `database.types.ts` se escribieron a mano con el mismo formato; el CI los comparará).
