# CI/CD y despliegue en Railway

El flujo de producción utiliza GitHub Actions para validar el código, actualizar Supabase y desplegar las tres aplicaciones como contenedores en Railway. Por tanto, Railway es la opción preparada para publicar las imágenes Docker de este proyecto.

```text
PR o push a main → CI: tipos, lint, pruebas, compilaciones, E2E e imágenes Docker
push a main con CI correcto → deploy-production
                             → migraciones y Edge Functions de Supabase
                             → tienda, consola y repartidor en Railway
```

El despliegue usa el mismo commit que aprobó el CI. Además, omite revisiones que ya fueron reemplazadas en main, y el arranque manual también exige un CI correcto para esa revisión.

## 1. Servicios de Railway

Crea o reutiliza un proyecto de Railway con tres servicios vacíos en el entorno de producción. En los tres conserva la raíz del repositorio como directorio de construcción, porque las aplicaciones comparten los paquetes del monorepo. Configura Dockerfile.production como archivo de construcción y /api/health como comprobación HTTP, con un tiempo de espera de 180 segundos y reinicio ON_FAILURE (hasta cinco intentos). Estos ajustes quedan guardados en cada servicio de Railway.

| Servicio | Variable APP_NAME | Directorio de la aplicación |
|---|---|---|
| Tienda | store | apps/store |
| Consola | console | apps/console |
| Repartidor | dealer | apps/dealer |

En cada servicio agrega también RAILWAY_DOCKERFILE_PATH=Dockerfile.production. No configures un comando de inicio personalizado: la imagen ya contiene el servidor de producción de Next.js y escucha en el PORT que Railway le asigne. Asimismo, asigna un dominio HTTPS a cada servicio para configurar las URL públicas antes de compilar.

El flujo de GitHub sube el código de la revisión aprobada mediante la CLI de Railway. Por ello, deja desactivado el autodespliegue nativo por push de estos servicios; así, la publicación sigue el orden CI, Supabase y aplicaciones. Si actualmente usas Vercel, conserva el despliegue existente mientras verificas Railway y desactiva su publicación automática cuando completes el cambio.

## 2. Variables públicas de cada aplicación

Configura estas variables en cada servicio de Railway:

| Variable | Valor |
|---|---|
| APP_NAME | store, console o dealer, según la tabla anterior |
| NEXT_PUBLIC_SUPABASE_URL | URL HTTPS del proyecto remoto de Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Clave pública anon del mismo proyecto |
| NEXT_PUBLIC_SITE_URL | Dominio HTTPS de ese servicio |
| NEXT_PUBLIC_TIMEZONE | America/Managua |

Además, copia las variables públicas opcionales que utilice cada aplicación desde el índice `.env.example`: moneda, Mapbox, Turnstile, Google, contacto, WhatsApp o VAPID. La imagen declara esos argumentos para que Railway los proporcione durante la compilación.

Las variables NEXT_PUBLIC se incrustan al construir la imagen. En consecuencia, al cambiarlas debes reconstruir y desplegar el servicio. Los archivos `.env.local` del equipo quedan excluidos tanto de la imagen como del paquete enviado a Railway. Por su parte, las claves privadas de Supabase, Stripe, Resend y VAPID deben permanecer en GitHub o en las Edge Functions, según corresponda; no se pasan como argumentos de construcción.

En Supabase, agrega los dominios y callbacks de las aplicaciones a la configuración de redirecciones de Auth. También actualiza STORE_URL, CONSOLE_URL y COURIER_APP_URL en los secretos de las Edge Functions, además de las restricciones de dominio de Google, Turnstile y Mapbox cuando los utilices.

## 3. Configuración de GitHub

En Settings → Environments → production, configura estos secretos:

| Secreto | Uso |
|---|---|
| SUPABASE_ACCESS_TOKEN | Desplegar migraciones y funciones |
| SUPABASE_DB_PASSWORD | Conectar con la base de datos remota |
| RAILWAY_TOKEN | Token de proyecto de Railway, limitado al entorno de producción |

El token de Railway se obtiene en la configuración del proyecto. Cárgalo directamente como secreto de GitHub; no lo escribas en el repositorio ni en el chat.

En Settings → Secrets and variables → Actions → Variables, configura las siguientes variables del repositorio:

| Variable | Valor |
|---|---|
| DEPLOY_PLATFORM | railway |
| RAILWAY_PROJECT_ID | Identificador del proyecto |
| RAILWAY_ENVIRONMENT_ID | Identificador del entorno de producción |
| RAILWAY_STORE_SERVICE_ID | Identificador del servicio de la tienda |
| RAILWAY_CONSOLE_SERVICE_ID | Identificador del servicio de la consola |
| RAILWAY_DEALER_SERVICE_ID | Identificador del servicio del repartidor |
| SUPABASE_PROJECT_REF | Opcional: sustituye la referencia del proyecto existente |

DEPLOY_PLATFORM debe ser una variable del repositorio para que GitHub pueda evaluar la condición antes de iniciar el trabajo. Si no vale railway, el flujo conserva únicamente el despliegue de Supabase y omite las aplicaciones.

Antes de aplicar migraciones, el flujo comprueba que existan los secretos y los identificadores requeridos. A su vez, el entorno production puede conservar sus revisores y las reglas de protección que ya utilices.

El token personal de Supabase se genera desde Account → Access Tokens. Para limitarlo al proyecto, permite la lectura de Project Settings, API Keys y API Key Secrets, que utiliza supabase link, y la escritura de Edge Functions. SUPABASE_DB_PASSWORD es la contraseña de PostgreSQL del proyecto, no la contraseña de tu cuenta ni una clave API. Consulta la [guía de tokens de Supabase](https://supabase.com/docs/guides/platform/personal-access-tokens) para revisar los permisos.

## 4. Qué comprueba el CI

El archivo `.github/workflows/ci.yml` conserva las pruebas de pgTAP, Deno, Vitest, tipos, lint, compilación y Playwright. Además, construye una imagen de producción por aplicación y comprueba que `/api/health` responda HTTP 200 con un puerto distinto del predeterminado, sin una sesión ni conexión de red.

Node 24 y pnpm 11.6.0 se utilizan en las comprobaciones y en las imágenes. Asimismo, Supabase CLI queda fijada a 2.120.0, porque el flujo existente utiliza los comandos de esa versión y la versión 3 cambia el destino de algunas operaciones y su confirmación. Las pruebas con Chromium se ejecutan en Ubuntu 24.04, compatible con la versión de Playwright del proyecto. Los comandos de construcción y de arranque apuntan a las carpetas de las aplicaciones para conservar su funcionamiento aunque cambie el nombre de un paquete.

La URL de salud confirma que el servidor responde; por ello, no consulta la base de datos ni exige iniciar sesión. Las pruebas de operaciones verifican por separado los flujos con el backend.

## 5. Construcción y operación

El archivo Dockerfile conserva el arranque local descrito en `docs/docker-local.md`. Por su parte, Dockerfile.production genera una imagen independiente por aplicación con la salida standalone de Next.js, los recursos públicos y los archivos estáticos, y ejecuta el proceso con un usuario sin privilegios de administrador.

Para construir una imagen de prueba desde PowerShell:

```powershell
docker build -f Dockerfile.production --build-arg APP_NAME=store --build-arg NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-clave-publica --build-arg NEXT_PUBLIC_SITE_URL=https://tienda.example.com -t rapitrip-store:production .
docker run --rm -p 127.0.0.1:8080:8080 -e PORT=8080 rapitrip-store:production
```

Para publicar, abre un PR y revisa el CI. Después de fusionarlo a main, el flujo deploy-production aplica las migraciones pendientes, despliega las funciones y construye los tres servicios en Railway. También puedes ejecutar deploy-production manualmente desde Actions, siempre que el commit actual de main tenga un CI correcto.

Cada servicio publica su versión por separado. Si uno falla, revisa su trabajo en GitHub y su despliegue en Railway antes de repetirlo. Las migraciones son hacia adelante y los secretos de las Edge Functions conservan su administración existente.

## Referencias

La configuración sigue la documentación de [Dockerfiles en Railway](https://docs.railway.com/builds/dockerfiles), [despliegue con la CLI](https://docs.railway.com/cli/up) y [ajustes de construcción](https://docs.railway.com/builds/build-configuration). El pin de Supabase evita introducir los [cambios de la CLI v3](https://supabase.com/changelog/supabase-cli-v3) dentro del flujo existente.
