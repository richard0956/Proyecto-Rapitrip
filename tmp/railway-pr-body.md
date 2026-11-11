La publicación con contenedores utiliza imágenes de producción de Next.js y un flujo que despliega el mismo commit aprobado: primero Supabase y después los tres servicios de Railway. Además, el CI construye y prueba cada imagen sin red, con un puerto configurable y un endpoint de salud accesible sin sesión.

También unifica Node 24 y pnpm 11.6.0, fija Supabase CLI en v2 y utiliza Ubuntu 24.04 para Playwright. Corrige los bloqueos previos del CI relacionados con la lectura de ubicaciones de repartidores, las fechas de las ventas de prueba, la ausencia de incidentes en la prueba de retención y la lectura del reloj durante el render de usuarios.

Validación realizada: actionlint, comprobación de tipos, lint del archivo corregido, compilación de producción del repartidor y pruebas locales de ventas y retención dentro de transacciones con ROLLBACK. La suite completa se valida en GitHub sobre un backend limpio.

La activación del despliegue requiere los tres servicios de Railway, sus identificadores y los secretos del entorno production descritos en docs/despliegue.md. Esta propuesta no activa despliegues ni sustituye los servicios existentes hasta configurar DEPLOY_PLATFORM=railway y fusionar a main con el CI correcto.
