# Mapas: planificación del apartado de ubicación, repartidor y seguimiento

Managua, Nicaragua, 19 de octubre de 2026
Tipo de documento: guía de planificación previa a construir. Define el proveedor elegido, qué se construye, en qué orden y qué decisiones faltan. **No hay código de mapas todavía.**
Base: repositorio al cierre de la Fase 4 (migraciones 1 a 32).
Relacionados: `Informe_Fase_5_App_Repartidor.md` (repartidor), `Informe_Catalogo_y_Comercios.md` (tiendas), `Informe_Fase_4_Tienda_Publica.md` (checkout), `backend-referencia.md`.

> **Estado de avance (20 de octubre de 2026).** Decisión tomada: por ahora el mapa sirve para ubicar **tiendas** y el **destino del cliente**; no hay repartidor ni seguimiento en vivo (camino A de la sección 6). Construido y verificado: **M0** (paquete `packages/maps`, política de seguridad, token), **M1** (ubicación de la tienda en `/comercio/tiendas/[id]`) y **M2** (pin en la libreta de direcciones, en el checkout y en la página del pedido). Migración 35 y pgTAP 350; pruebas E2E en `e2e/tests/mapas.spec.ts`. El pin es **opcional** por ahora (decisión M1 pendiente de volverlo obligatorio). También construido: **ruta tienda–destino** para coordinación y administración (mapa con los dos puntos, distancia y tiempo por calle con Mapbox; en línea recta si el servicio falla) y, para el **comercio**, solo la **distancia aproximada** (nunca el punto del cliente: migración 36, pgTAP 360). **Envío por zona (migración 37, pgTAP 370):** el pin del cliente y de la tienda son obligatorios, y el costo de envío se cobra por tramos de distancia (zona 1: hasta 3 km, C$50; zona 2: hasta 6 km, C$65; zona 3: hasta 10 km, C$90; zona 4: hasta 15 km, C$125; zona 5: hasta 20 km, C$155; más allá de 20 km no se entrega). La distancia es la de línea recta entre los dos pines por un factor de ruta de 1,30 (`sales.delivery_settings.road_factor`, ajustable), porque la base de datos no puede consultar a Mapbox. Cada pedido guarda su zona, el pago al repartidor y el margen de Rapitrip para las liquidaciones. **Distancia real por calle y geocoding inverso (migración 38, pgTAP 380, función `quote-delivery`):** el checkout pide la distancia por calle a la función de borde, que consulta Mapbox con `MAPBOX_TOKEN` y guarda una cotización de 15 minutos en la base de datos; `create_order` solo acepta cotizaciones suyas (mismo cliente, tienda y punto) y, sin cotización, cobra por línea recta como respaldo. Al marcar un pin, el selector sugiere la dirección escrita del punto (se acepta con «Usar como dirección»). Quedan M3 a M6.

---

## 1. Qué se quiere resolver

Cuatro usos del mapa, de menor a mayor complejidad:

| # | Uso | Quién lo usa |
|---|---|---|
| 1 | **Ubicación de tiendas y puntos de venta** propios del comercio | Comercio |
| 2 | **Destino de entrega** marcado con un pin | Cliente |
| 3 | **Elegir el repartidor más cercano** al comercio o al destino | Coordinación |
| 4 | **Ver el pedido en tiempo real** (posición del repartidor y tiempo estimado) | Cliente |

Los usos 1 y 2 son sencillos y valiosos por sí solos. Los usos 3 y 4 **dependen de conocer la posición del repartidor**, y eso hoy no existe (sección 6).

**Principio de diseño decidido:** el **pin es la fuente de verdad**. Se guardan latitud y longitud elegidas por la persona. La dirección escrita queda como *línea 1* y *línea 2* (y la referencia), como texto de apoyo para el repartidor. La búsqueda de direcciones es solo una ayuda para acercar el mapa, no un dato que se confíe.

---

## 2. Proveedor elegido: Mapbox

Decisión tomada a partir de una prueba hecha con el token público del proyecto.

### 2.1 Resultados de la prueba

**Cobertura de lugares (referencia con OpenStreetMap, base de datos que usa Mapbox):** 18 de 20 puntos de Managua encontrados y bien ubicados (centros comerciales, mercados, hospital, universidad, barrios y municipios cercanos).

**Rutas por calle en Mapbox (5 reales):** distancias entre 1,3 y 1,4 veces la línea recta, salvo un caso (Catedral a Metrocentro) posiblemente por calles de sentido único. Ejemplos: UCA a Mercado Oriental, 6,0 km y 16 min; Ciudad Sandino a Multicentro Las Brisas, 6,0 km y 12 min.

**Matriz de distancias (repartidor más cercano):** con 4 repartidores hacia un mismo destino, una sola llamada devolvió tiempo y distancia de cada uno (14, 14, 17 y 46 minutos). Es exactamente lo que necesita el uso 3.

**Búsqueda de texto:** floja en lugares específicos. El Estadio Nacional y el barrio Altamira volvieron como "Managua" sin ubicarlos, y "Residencial Las Palmas" devolvió una localidad que no se pudo confirmar. Esto confirma que **el pin manda**.

### 2.2 Lo que la prueba no cubrió

- **Tiempos con tráfico real.** El tiempo de 42 minutos del aeropuerto a Metrocentro parece algo largo. Solo se confirma comparando con Google (requiere su clave) o con recorridos reales.
- **Cómo se ve el mapa** y si las referencias bastan para colocar el pin: se revisa al construir la pantalla.
- **Zonas rurales:** solo se probó Managua y municipios cercanos.

### 2.3 Costos (cifras de blogs de terceros; confirmar en la página de Mapbox)

| Servicio | Cupo gratuito mensual | Después |
|---|---|---|
| Mapa en la web | 50 000 cargas | Unos $5 por 1 000 |
| Rutas | 100 000 solicitudes | Unos $2 por 1 000 |
| Matriz de distancias | 100 000 elementos | Unos $2 por 1 000 |
| Búsqueda de direcciones | 100 000 temporales | Guardar resultados se cobra como búsqueda permanente |

**Estimación de uso** (supuestos a validar): con 200 pedidos al día (unos 6 000 al mes), cada pedido carga el mapa unas 3 a 5 veces (pin en el checkout, seguimiento) y pide 1 ruta y una matriz de unos 10 repartidores. Serían ~30 000 cargas de mapa, 6 000 rutas y 60 000 elementos de matriz: **dentro del cupo gratuito**. La posición del repartidor, que se envía cada pocos segundos, **no consume cupo de Mapbox** porque viaja por Supabase.

### 2.4 Plan B

Google Maps cuesta más al crecer pero suele tener mejores datos de lugares. El cambio se limita a la capa `lib/maps` (sección 4.1), no a las pantallas, siempre que ese acople se respete.

---

## 3. Punto de partida: qué existe hoy

| Pieza | Estado |
|---|---|
| `commerce.stores`: nombre, **dirección escrita**, teléfono | Sin coordenadas |
| `sales.order_delivery`: dirección, teléfono, nota | Sin coordenadas |
| `sales.customer_addresses` (libreta del cliente) | **Ya tiene `latitude` y `longitude` reservadas** y opcionales; la función `save_address` ya las acepta |
| `identity.couriers`: ficha del repartidor | Sin posición, sin cuenta (ver F5) |
| Cabeceras de seguridad (CSP) de ambas apps | **No permiten Mapbox**: hay que abrir `connect-src`, `img-src`, y agregar `worker-src blob:` |
| Supabase Realtime | Disponible en el servicio; el proyecto aún no lo usa |
| Dirección de la tienda | Opcional (se recomendó volverla obligatoria) |

---

## 4. Qué se construye

### 4.1 Base común (obligatoria)

Un paquete compartido `packages/maps` (o una carpeta equivalente), usado por la tienda y la consola:

- **`lib/maps`:** capa propia con las operaciones que el sistema necesita (mostrar mapa, colocar pin, buscar, calcular ruta, matriz). **Ninguna pantalla importa a Mapbox directamente**; así se puede cambiar de proveedor.
- **Componentes:**
  - *Selector de pin*: mapa con marcador que se arrastra, botón «Usar mi ubicación», búsqueda opcional y campos de dirección línea 1, línea 2 y referencia.
  - *Mapa de solo lectura*: uno o varios marcadores, para tiendas y para el seguimiento.
- **Carga diferida:** la librería de mapas pesa bastante; se carga solo en las pantallas que la usan, para no frenar el catálogo.
- **Seguridad:**
  - ampliar la CSP de las dos apps con los dominios de Mapbox y `worker-src blob:`;
  - **token público** (`pk.`) en `NEXT_PUBLIC_MAPBOX_TOKEN`, restringido por dominio;
  - **token de servidor** (secreto, con permisos acotados) para la matriz de distancias y las rutas, guardado como secreto de la función de borde, nunca en el navegador;
  - mostrar la atribución requerida (logotipo de Mapbox y © OpenStreetMap).
- **Validación:** aceptar solo coordenadas dentro de Nicaragua (caja geográfica con margen) para descartar pines mal puestos.
- **Accesibilidad:** el mapa no es accesible por sí solo. Siempre debe haber alternativa por teclado y por texto: «Usar mi ubicación», dirección escrita y mover el pin con botones. Revisar con axe.

### 4.2 Etapa A: ubicación de tiendas y puntos de venta (uso 1)

- **Backend:** migración con `latitude` y `longitude` en `commerce.stores` (ambas o ninguna, con rango válido), función `set_store_location` con auditoría. Los *puntos de venta propios* del comercio son sus tiendas: no hace falta otra entidad.
- **Consola, `/comercio/tiendas/[id]`:** selector de pin junto a los datos de la tienda, y dirección línea 1, línea 2 y referencia.
- **Visibilidad pública:** por privacidad y para no facilitar copia del catálogo, las coordenadas exactas **no** se exponen en las funciones públicas de la tienda (la prueba de guardas lo exige). Se usan en servidor para rutas y para el repartidor.
- **Recomendado:** exigir ubicación para publicar la tienda.

### 4.3 Etapa B: destino del cliente (uso 2)

- **Backend:** migración que agrega `latitude` y `longitude` a `sales.order_delivery`; `create_order` las recibe (opcionales al inicio, con validación de rango y país) y `save_address` ya está preparada.
- **Tienda:** en `/checkout`, el selector de pin y los campos línea 1 y línea 2; en la libreta de direcciones, guardar el pin con cada dirección.
- **Zona de entrega (opcional, decisión M3):** radio máximo desde la tienda. Si el pin queda fuera, se avisa y no se permite pedir.
- **Costo de envío por distancia (opcional, decisión M4):** hoy es fijo por tienda. Con coordenadas puede calcularse por tramos de distancia; es una mejora posterior, no parte de esta etapa.
- **Datos personales:** el pin es un dato personal sensible. Se borra al anonimizar la cuenta (ya existe el mecanismo para la dirección) y solo lo ven el cliente, la coordinación y, mientras entrega, el repartidor.

### 4.4 Etapa C: repartidor más cercano (uso 3)

Necesita la posición del repartidor, ver sección 6.

- **Backend:** tabla con la **última posición** de cada repartidor (latitud, longitud, hora de actualización y precisión). Función `courier_report_position` para que la app del repartidor la envíe, con límite de frecuencia.
- **Sugerencia de asignación:** al asignar, la consola pide a una función de borde que:
  1. filtre por cercanía simple a los repartidores disponibles y con posición reciente;
  2. use la **matriz de distancias** de Mapbox para calcular tiempos reales de los más cercanos hasta la tienda;
  3. devuelva una lista ordenada con tiempo y distancia.
- **Consola, `/coordinacion`:** el desplegable de repartidores muestra ese orden y el tiempo estimado. **La coordinación decide**: la sugerencia no asigna sola.
- **Topes de la matriz:** cada llamada admite un número limitado de puntos (del orden de 25 en el perfil de conducción, a verificar), por eso se prefiltra.
- **Sin posición reciente:** si un repartidor no ha reportado hace más de unos minutos, no entra en la sugerencia pero sigue pudiendo asignarse a mano.

### 4.5 Etapa D: seguimiento en vivo para el cliente (uso 4)

- **Solo mientras el pedido está `en_camino`.** Antes y después no se muestra posición.
- **Backend:** el repartidor reporta su posición ligada al pedido en curso; el cliente la lee con una vista que solo devuelve la posición del repartidor de **su propio** pedido y solo en ese estado.
- **Tiempo real:** el cliente se suscribe a los cambios de esa posición con Supabase Realtime, sujeto a las mismas reglas de acceso. Respaldo: consulta cada pocos segundos si la conexión en vivo falla.
- **Pantalla `/pedidos/[id]`:** mapa con el destino, el marcador del repartidor y el tiempo estimado de llegada (de la ruta de Mapbox, recalculada cada cierto tiempo, no a cada movimiento).
- **Frecuencia:** el repartidor envía su posición cada 10 a 20 segundos mientras entrega; no más, por batería y costo.
- **Al entregar:** se deja de reportar y se borra el rastro del pedido pasado un plazo corto (decisión M7).

---

## 5. Orden recomendado

| Etapa | Qué incluye | Depende de | Terminada cuando |
|---|---|---|---|
| **M0. Base** | Paquete de mapas, tokens, CSP, selector de pin y mapa de lectura, atribución y accesibilidad | Tokens de Mapbox restringidos | El selector funciona en una página de prueba con teclado y en móvil |
| **M1. Tiendas** | Migración y pin en `/comercio/tiendas/[id]`, pruebas | M0 | Una tienda guarda su ubicación, y un comercio ajeno no puede cambiarla |
| **M2. Cliente** | Migración de `order_delivery`, pin en checkout y libreta, validación de país | M0 | Un pedido guarda el pin; el comercio y la coordinación lo ven; se borra al anonimizar |
| **M3. Posición del repartidor** | Aplicación mínima del repartidor que reporta su posición, y la tabla de última posición | F5 mínima, ver sección 6 | La coordinación ve dónde está cada repartidor disponible |
| **M4. Sugerencia de asignación** | Función de borde con la matriz y la lista ordenada en `/coordinacion` | M1 y M3 | Al asignar, se muestran tiempos por repartidor y la coordinación elige |
| **M5. Seguimiento en vivo** | Posición por pedido, suscripción en tiempo real, mapa y ETA en `/pedidos/[id]` | M2 y M3 | El cliente ve moverse al repartidor solo durante `en_camino` |
| **M6. E2E, CI y pulido** | Pruebas de punta a punta con Mapbox simulado, accesibilidad, revisión de costos | Todas | CI en verde y revisión visual aprobada |

M0 a M2 se pueden hacer **sin repartidores**: dan valor inmediato (ubicaciones guardadas, destino exacto).

---

## 6. Hallazgo importante: la ubicación del repartidor exige aplicación del repartidor

Las etapas M3 a M5 necesitan que el repartidor **envíe su posición desde su teléfono**. Hoy el repartidor no tiene cuenta ni aplicación. Esto cambia lo que dije sobre la Fase 5: saltársela es posible solo si **no** se quiere repartidor más cercano ni seguimiento en vivo.

Hay tres caminos:

| Camino | Qué implica | Alcance |
|---|---|---|
| **A. Solo M0 a M2** | Ubicaciones de tiendas y pin del cliente; la coordinación asigna sin sugerencia ni seguimiento | Sin F5 |
| **B. Aplicación mínima del repartidor** | Cuenta, disponibilidad, **reporte de posición** y sus pedidos; sin efectivo ni código de entrega | F5 reducida |
| **C. F5 completa** | Todo lo del informe de la Fase 5 | F5 completa |

**Recomendación:** empezar por A y, al abrir M3, hacer B (la F5 mínima), que es lo único que necesitan M3 a M5.

### Límite importante de una aplicación web móvil

Un navegador **solo obtiene la ubicación mientras la pantalla está encendida y la página visible**. Si el repartidor bloquea el teléfono o cambia de aplicación, el reporte se detiene o se vuelve irregular. Con una aplicación web se puede **mantener la pantalla encendida** (función de bloqueo de apagado), pero consume batería y no es infalible. Una aplicación nativa resolvería el reporte en segundo plano, a costa de otro proyecto con tiendas de aplicaciones. Es una decisión de producto (M5) que conviene tomar antes de la etapa M3.

---

## 7. Decisiones pendientes

| # | Decisión | Opciones | Recomendación |
|---|---|---|---|
| M1 | ¿Pin obligatorio en el pedido? | Opcional · obligatorio | **Obligatorio para pedidos a domicilio** desde la etapa M2; con «Usar mi ubicación» y dirección escrita como apoyo |
| M2 | ¿Ubicación obligatoria para publicar una tienda? | Sí · no | **Sí** |
| M3 | ¿Zona de entrega por radio? | Sin límite · radio por tienda | **Radio por tienda** como opción, con un valor inicial razonable |
| M4 | ¿Envío por distancia? | Fijo · por tramos | **Fijo** por ahora; por tramos en una fase posterior |
| M5 | Reporte de posición del repartidor | Web con pantalla encendida · aplicación nativa | **Web con pantalla encendida** al inicio; evaluar nativa si falla en la práctica |
| M6 | ¿El cliente ve nombre del repartidor? | Sí · solo «en camino» | **Solo «en camino»** y el mapa (ya decidido: privacidad) |
| M7 | Retención del rastro del repartidor | No guardar · guardar unas horas · guardar días | **Guardar solo la última posición** y el rastro del pedido unas horas, para resolver reclamos, y luego borrar |
| M8 | ¿La coordinación ve a todos los repartidores en un mapa? | No · sí | **Sí**, en el tablero (encaja con la Fase 6) |
| M9 | Frecuencia de reporte | 5 s · 10-20 s · 30 s | **10 a 20 segundos** mientras entrega |
| M10 | Proveedor | Mapbox · Google | **Mapbox**, con capa propia para poder cambiar |

---

## 8. Pruebas

| Nivel | Qué cubre |
|---|---|
| pgTAP | Quién puede escribir y leer ubicaciones; que el cliente ve **solo** la posición del repartidor de su pedido y solo en `en_camino`; que el comercio no edita tiendas ajenas; rangos de latitud y longitud; borrado al anonimizar; guardas de funciones públicas |
| Unitarias | Validación de coordenadas y de la caja de Nicaragua, formato de distancia y tiempo, prefiltro de repartidores por cercanía |
| Componentes | Selector de pin (teclado, «Usar mi ubicación», sin permiso de ubicación) y mapa de lectura |
| E2E | Con Mapbox **simulado** (interceptar las llamadas) para no gastar cupo ni depender de la red: guardar ubicación de una tienda, pin en el checkout, sugerencia de repartidor, seguimiento |
| Accesibilidad | axe en cada pantalla con mapa y alternativa operable sin ratón |
| Manuales | En teléfono real: ubicación, pantalla encendida, comportamiento con la pantalla bloqueada |

---

## 9. Seguridad y privacidad (Ley 787)

- **Datos personales sensibles:** el pin de entrega y la posición del repartidor lo son. Se recogen solo para el pedido, se muestran al mínimo necesario y se borran según M7.
- **Consentimiento:** pedir permiso de ubicación con un texto claro, y no depender de él (siempre hay alternativa escrita).
- **Repartidor:** informarle cuándo se comparte su posición y que se detiene al entregar; lo exige el trato justo y probablemente su acuerdo de uso.
- **Terceros:** Mapbox recibe coordenadas y consultas de ruta, sin nombres ni teléfonos. Incluirlo en la política de privacidad. Antes de guardar resultados de rutas o búsquedas, revisar sus términos: se guardan **solo coordenadas elegidas por personas y posiciones propias**, no resultados de sus servicios.
- **Tokens:** el público, restringido por dominio; el de servidor, como secreto de la función de borde y con permisos mínimos. Rotar si se filtra.
- **La base de datos decide:** ninguna regla de quién ve qué ubicación depende de la interfaz.
- **Abuso:** límite de frecuencia al reportar posición y tope de consultas de matriz por asignación.

---

## 10. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| La web no reporta ubicación con la pantalla bloqueada | Seguimiento intermitente | Pantalla encendida, aviso al repartidor, evaluar aplicación nativa (M5) |
| Pin mal puesto por el cliente | Entrega al lugar equivocado | Mostrar la dirección escrita junto al pin, referencia obligatoria y la coordinación puede corregir |
| El mapa o la búsqueda de Mapbox fallan o son lentos | Checkout bloqueado | El pin es una ayuda: si el mapa no carga, se puede continuar con dirección escrita (mientras el pin no sea obligatorio) |
| Datos de lugares incompletos en barrios pequeños | Búsqueda sin resultados | El pin manda; la búsqueda es solo apoyo |
| Tiempos estimados poco realistas con el tráfico de Managua | ETA y sugerencias engañosas | Comparar con recorridos reales y, si hace falta, ajustar con un margen o cambiar de proveedor |
| Costo mayor al estimado | Cobro inesperado | Alertas de uso en la cuenta de Mapbox y revisión mensual; cupo gratuito amplio |
| Fuga de la ubicación de repartidores o clientes | Daño a la privacidad | Reglas de acceso por pedido, retención corta y pruebas de lo que **no** se ve |
| Consumo de batería del repartidor | Abandono del uso | Frecuencia moderada (M9) y solo durante una entrega |
| Peso de la librería de mapas | Páginas lentas | Carga diferida solo en pantallas con mapa |
| Cambio de proveedor tardío | Reescritura | Capa `lib/maps` desde el inicio |

---

## 11. Tamaño relativo

Sin fechas: es una medida para comparar etapas.

| Etapa | Tamaño | Por qué |
|---|---|---|
| M0. Base | Media | Paquete nuevo, CSP, accesibilidad y componentes |
| M1. Tiendas | Pequeña | Una migración y un campo en pantalla existente |
| M2. Cliente | Pequeña a media | Toca el checkout y la libreta, que ya están preparados |
| M3. Posición del repartidor | Media a grande | Incluye la aplicación mínima del repartidor |
| M4. Sugerencia de asignación | Media | Función de borde y cambios en `/coordinacion` |
| M5. Seguimiento en vivo | Media a grande | Tiempo real, reglas de acceso y mapa |
| M6. E2E y pulido | Media | Simulación de Mapbox y pruebas en teléfono |

---

## 12. Qué se necesita de ti

1. **Restringir el token público** de Mapbox a tus dominios, y crear un **token de servidor** con permisos mínimos (rutas y matriz) para cuando llegue M4.
2. **Decidir M1 a M10**, o aceptar las recomendaciones. Las más importantes: M1 (pin obligatorio), M5 (cómo reporta el repartidor) y M7 (cuánto se guarda).
3. **Elegir el camino A, B o C** de la sección 6 según se quiera repartidor más cercano y seguimiento en vivo.
4. **Ubicar las tiendas de los comercios piloto** (sus coordenadas o direcciones claras) para probar M1 con datos reales.
5. Antes de producción: actualizar la política de privacidad con el uso de ubicación y con Mapbox como proveedor.

Con eso, la **etapa M0** (base de mapas) se puede abrir de inmediato: desbloquea todo lo demás y no depende de repartidores.
