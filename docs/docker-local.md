# Ejecutar Rapitrip con Docker en local

La imagen `rapitrip-apps:local` contiene las tres aplicaciones y sus dependencias Linux. A su vez, Compose crea un contenedor para cada aplicación, por lo que puedes iniciarlas y detenerlas juntas. Esta configuración ejecuta `next dev` para el uso local; las páginas se compilan cuando se abren por primera vez.

## Requisitos y configuración

Mantén Docker Desktop encendido y utiliza contenedores Linux. Además, el backend de Supabase debe estar disponible: puedes reutilizar el stack local que ya ejecutas con `pnpm db:start` o un proyecto remoto con sus funciones desplegadas.

Compose lee las variables de estos archivos existentes:

- `apps/store/.env.local`
- `apps/console/.env.local`
- `apps/dealer/.env.local`

Cada archivo debe contener `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Si usas el backend local, conserva `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` y la clave anónima que corresponde a ese stack. Las demás variables públicas, como Mapbox, Turnstile o VAPID, siguen leyéndose desde el archivo de cada aplicación.

Los archivos de entorno se suministran al iniciar los contenedores y quedan excluidos de la imagen mediante `.dockerignore`. Por tanto, la imagen puede construirse antes de configurar las credenciales. En cambio, para ejecutar Compose sí deben existir los tres archivos y contener los valores correspondientes.

## Construir e iniciar

Ejecuta desde la raíz del proyecto:

```powershell
docker compose up -d --build
docker compose ps
```

La primera construcción descarga Node y las dependencias, por lo que necesita acceso a Internet. Además, la primera compilación de las páginas descarga las fuentes de Google que utilizan las aplicaciones. Después, abre las aplicaciones desde estas direcciones:

| Aplicación | Dirección |
|---|---|
| Tienda | http://127.0.0.1:3000 |
| Consola | http://127.0.0.1:3001 |
| Repartidor | http://127.0.0.1:3002 |

Usa `127.0.0.1` de forma consistente para conservar las cookies y las redirecciones del entorno actual. Asimismo, los puertos 3000, 3001 y 3002 deben estar libres antes del arranque. Compose publica esos puertos únicamente en el equipo local.

Una vez construida la imagen, puedes volver a iniciar los contenedores con:

```powershell
docker compose up -d
```

La política `unless-stopped` permite que Docker reinicie los contenedores después de un reinicio del motor, siempre que no los hayas detenido manualmente. El backend local de Supabase también debe estar encendido.

## Conexión con Supabase

Dentro de un contenedor, `127.0.0.1` apunta al propio contenedor. Por ello, el script de arranque crea un puente TCP hacia `host.docker.internal` cuando detecta una URL local de Supabase. Así, tanto el navegador como el servidor de Next pueden conservar la URL actual, y las conexiones Realtime también atraviesan el puente. Para un proyecto remoto, el script conecta directamente con su URL HTTPS.

Este Compose administra las aplicaciones web. El stack de Supabase, las Edge Functions y el procesador de correos conservan su arranque existente; cuando un flujo los requiera, mantén activos `pnpm db:start`, `pnpm fn:serve` y `pnpm outbox:loop`, según corresponda. El arranque de las aplicaciones no modifica la base de datos ni ejecuta migraciones.

Si utilizas Docker Engine en Linux, el mapeo `host-gateway` de Compose debe alcanzar el puerto de Supabase en el equipo. También puedes indicar otra dirección accesible desde el contenedor con `DOCKER_HOST_ADDRESS`, conservando la URL pública de Supabase.

## Operación y cambios

```powershell
# Consultar los registros de las tres aplicaciones.
docker compose logs -f --tail 100

# Consultar solo la tienda.
docker compose logs -f store

# Aplicar cambios del código, reconstruyendo la imagen.
docker compose up -d --build

# Aplicar cambios en los archivos de entorno, recreando los contenedores.
docker compose up -d --force-recreate

# Detener y eliminar los contenedores de las aplicaciones.
docker compose down
```

El código se copia en la imagen; por ello, los cambios del proyecto requieren reconstruirla. Además, el estado `healthy` comprueba que el puerto de Next acepta conexiones, mientras que la primera visita a una página confirma su compilación y la respuesta de la aplicación.

## Ejecutar una sola aplicación sin Compose

También puedes construir la misma imagen y ejecutar únicamente la tienda:

```powershell
docker build -t rapitrip-apps:local .
docker run -d --name rapitrip-store --init --restart unless-stopped --add-host host.docker.internal:host-gateway --env-file apps/store/.env.local -e PORT=3000 -e NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 -p 127.0.0.1:3000:3000 rapitrip-apps:local store
```

Para la consola, usa el argumento `console`, su archivo de entorno y el puerto 3001; para el repartidor, usa `dealer`, su archivo de entorno y el puerto 3002. Al trasladar la imagen a otro equipo, proporciona allí sus archivos de entorno y un backend accesible.

La configuración de variables sigue la [documentación de Docker Compose](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/), mientras que la publicación de puertos se apoya en la [documentación de redes de Docker Desktop](https://docs.docker.com/desktop/features/networking/).
