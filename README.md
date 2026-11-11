# Proyecto-Rapitrip
Plataforma digital de comercio electrónico y gestión logística para la microempresa Rapitrip.

## Configuración

Todas las credenciales y variables de entorno están indexadas en [`.env.example`](.env.example) (qué poner, dónde obtenerlo y en qué archivo va). Los pasos para levantar el proyecto están en [`docs/fase-1-puesta-en-marcha.md`](docs/fase-1-puesta-en-marcha.md).

Para iniciar las tres aplicaciones con Docker Desktop y reutilizar el backend configurado, ejecuta `docker compose up -d --build`. La configuración y los comandos de uso están en [`docs/docker-local.md`](docs/docker-local.md).

Para producción, el CI construye y prueba las imágenes de `Dockerfile.production`; después, GitHub Actions puede desplegar Supabase y las tres aplicaciones en Railway. Los servicios, las variables y los secretos necesarios se describen en [`docs/despliegue.md`](docs/despliegue.md).
