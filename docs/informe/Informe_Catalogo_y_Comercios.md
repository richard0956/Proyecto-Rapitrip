# Catálogo y comercios: avance y plan para llenar el sistema

Managua, Nicaragua, 18 de octubre de 2026
Tipo de documento: informe de avance y guía operativa. Describe qué está construido hoy, cómo se da de alta un comercio y se carga su catálogo, qué reglas hay que respetar y qué falta para llenar el sistema con datos reales.
Base: repositorio al cierre de la Fase 4 (migraciones 1 a 32).
Relacionados: `Informe_Frontend_Completo_Rapitrip.md` (Fase 2), `backend-referencia.md`, `Informe_Fase_4_Tienda_Publica.md`.

---

## 1. Resumen

El módulo de comercios y catálogo está **construido y conectado con la tienda**: lo que un comercio publica en la consola es lo que el cliente ve en el catálogo público. Lo verificado automáticamente es el flujo de punta a punta con datos de prueba: crear comercio, tienda, horario, producto, variante, inventario y vender.

Lo que **todavía no existe** es lo necesario para cargar muchos datos reales de forma cómoda:

| Tema | Estado |
|---|---|
| Alta de comercios (solicitud, aprobación, cuenta) | Hecho |
| Tiendas con horario, cierre temporal y costo de envío | Hecho |
| Productos con variantes (precio y SKU), imágenes y estados | Hecho |
| Inventario con alertas de stock bajo | Hecho |
| Catálogo maestro (categorías, marcas, tipos) | **Construido pero vacío**: no trae datos iniciales |
| Carga masiva (hoja de cálculo, importación) | **No existe**: todo se carga producto por producto |
| Que la administración cargue o corrija el catálogo de un comercio | **No existe en pantalla**: la base de datos lo permite, la consola no lo ofrece |
| Una cuenta por comercio | Es una regla de la base de datos, no una carencia |

**Conclusión práctica:** se puede empezar a llenar ya, pero con carga manual. Para más de unos pocos comercios conviene resolver antes dos cosas: sembrar el catálogo maestro y decidir quién sube los productos (sección 6).

---

## 2. Qué está construido

### 2.1 Comercios

- **Solicitud:** el interesado se registra en la tienda y completa `/vende`. Una solicitud pendiente por persona.
- **Aprobación** (`/admin/solicitudes`): la administración revisa y aprueba **confirmando que el convenio de afiliación está firmado** (la base de datos lo exige). Al aprobar se crea el comercio y la cuenta queda con el rol `comercio`.
- **Gestión** (`/admin/comercios` y detalle): lista, estado, y suspensión o reactivación con motivo y auditoría. Un comercio **suspendido** pierde el acceso a sus datos y sus tiendas dejan de aparecer abiertas.
- **Regla:** una cuenta de comercio por comercio y un comercio por cuenta.

### 2.2 Tiendas (`/comercio/tiendas`)

Un comercio puede tener varias tiendas. Cada una tiene:

- nombre (2 a 80 caracteres, único dentro del comercio), dirección (hasta 240), teléfono de contacto;
- **horario semanal** con varios tramos por día, y **excepciones** por fecha;
- **cierre temporal** con motivo, y estado activa o inactiva;
- **costo de envío fijo** (córdobas).

La tienda aparece como abierta según el horario en zona `America/Managua`.

### 2.3 Productos y variantes (`/comercio/catalogo`)

- **Producto:** pertenece a una tienda. Nombre (2 a 120), descripción (hasta 1000), categoría, marca y tipo opcionales. Estados: `borrador`, `publicado`, `archivado`.
- **Variante:** es lo que se vende y lleva el precio. Nombre (1 a 80), **SKU** (2 a 40 caracteres: letras, números, punto, guion y guion bajo; único por tienda) y **precio** (de 0 a 99 999 999,99). Estados: `activa`, `inactiva`.
- **Imágenes:** hasta **5** por producto, JPEG, PNG o WebP, **máximo 2 MB** cada una. La primera es la portada.
- **Publicar** exige al menos una variante activa. El nombre del producto no se repite en la misma tienda mientras no esté archivado.
- **Archivar** exige un motivo de al menos 5 caracteres y es definitivo.

### 2.4 Inventario (`/comercio/inventario`)

Por variante se decide si se **controla el stock**. Con control: se registra entrada, salida o conteo con motivo, y hay umbral de stock bajo con alerta. Sin control, la variante se considera siempre disponible. Los pedidos descuentan stock al crearse y lo devuelven al cancelarse o vencer.

### 2.5 Catálogo maestro (`/admin/catalogo`)

Lista de **categorías** (con un solo nivel de subcategorías), **marcas**, **tipos de producto** y **atributos**, administrada por la administración. Es **orientativo**: un comercio puede publicar sin elegir categoría. La tienda pública usa las categorías para filtrar, pero **solo muestra las que tienen productos publicados**.

### 2.6 Lo que ve el cliente

Lista de tiendas abiertas, ficha de tienda, productos con foto y precio, búsqueda y filtro por categoría. Una tienda cerrada se ve pero no admite pedidos. Un producto sin stock aparece como agotado. Un borrador, una tienda inactiva o un comercio suspendido **no aparecen**.

---

## 3. Cómo se da de alta un comercio, paso a paso

**Camino normal (con solicitud)**

1. La persona del comercio crea su cuenta en la tienda y envía la solicitud en `/vende`.
2. La administración abre `/admin/solicitudes`, revisa y **aprueba** confirmando el convenio firmado.
3. La persona entra a la consola (`/comercio`) con su cuenta; la primera vez configura el segundo factor.
4. **Crea la tienda** y carga nombre, dirección, teléfono y costo de envío.
5. **Define el horario** (y excepciones, si las hay).
6. **Crea los productos**, con sus variantes y fotos.
7. **Configura el inventario** de las variantes con control de stock.
8. **Publica** los productos. Desde ese momento los ve el cliente.

**Verificación antes de dar el comercio por listo**

- La tienda sale en la lista pública y figura como abierta en su horario.
- Un producto se ve con foto, precio y disponibilidad.
- Se hace un pedido de prueba en efectivo y llega a `/comercio/pedidos`.

---

## 4. Reglas que hay que conocer antes de cargar

| Regla | Consecuencia al cargar |
|---|---|
| El SKU es único **por tienda** | Dos tiendas pueden repetir SKU; una misma tienda no |
| El precio vive en la **variante** | Un producto sin variantes no se puede vender ni publicar |
| Hay que tener **una variante activa** para publicar | Se crea la variante antes de publicar |
| Imágenes de 2 MB como máximo, hasta 5 | Reducir las fotos antes de subirlas |
| El catálogo maestro es opcional | No bloquea la carga, pero sin categorías el filtro de la tienda queda vacío |
| Un producto archivado no vuelve a otro estado | Usar `borrador` si se quiere ocultar temporalmente |
| La moneda es el córdoba (`NIO`) | Cargar precios en córdobas |
| Una tienda sin horario se considera cerrada | Sin horario no se pueden hacer pedidos |
| Una cuenta de comercio por comercio | Si dos personas administran el mismo negocio, comparten la cuenta |

---

## 5. Lo que falta o conviene mejorar

1. **Catálogo maestro vacío.** No hay datos iniciales: hasta que alguien cree categorías en `/admin/catalogo`, el filtro por categoría del cliente no aparece. Es lo más rápido de resolver y lo que más cambia la experiencia.
2. **Sin carga masiva.** Cada producto, variante y foto se carga a mano. Para comercios con decenas o cientos de productos es el mayor cuello de botella.
3. **La administración no puede cargar ni corregir productos de un comercio en pantalla.** La base de datos lo permite (el rol de administración puede gestionar tiendas y productos), pero la consola solo ofrece esas pantallas al comercio. Si algún comercio no sabe usar la consola, hoy no hay forma de ayudarlo sin entrar con su cuenta.
4. **Dirección de la tienda opcional.** Hoy se puede publicar una tienda sin dirección. Es un problema para la entrega, y lo será más con la app del repartidor (Fase 5).
5. **Una sola cuenta por comercio.** Es una regla elegida; si un negocio necesita varios empleados con acceso, hay que decidir antes de cargar.
6. **Imágenes.** Se suben una por una y sin recorte ni redimensionado automático; fotos grandes del teléfono superan los 2 MB y se rechazan.
7. **Prueba visual con datos reales.** La accesibilidad y el rendimiento del catálogo se midieron con pocos datos de prueba; conviene repetirlo cuando haya decenas de productos con fotos reales.

---

## 6. Plan recomendado para llenar el sistema

| Paso | Qué | Quién | Cuándo estará hecho |
|---|---|---|---|
| 1 | Definir y cargar el **catálogo maestro** inicial (categorías y subcategorías principales, marcas frecuentes, tipos de producto) | Administración | Antes del primer comercio |
| 2 | Elegir **uno o dos comercios piloto** y recoger sus datos: nombre, dirección, teléfono, horario, costo de envío, lista de productos con precio y fotos | Administración y comercio | Antes de cargar |
| 3 | **Aprobar** a los pilotos y darles acceso | Administración | Con el convenio firmado |
| 4 | Cargar tiendas, productos y fotos de los pilotos | El propio comercio, acompañado | Primeros días |
| 5 | **Pedido de prueba** de punta a punta en cada tienda (efectivo, y tarjeta si ya hay Stripe) | Administración | Antes de abrir al público |
| 6 | Corregir lo que salga (fotos, nombres, precios, horarios) | Comercio | Ajuste |
| 7 | Sumar más comercios por tandas pequeñas | Administración | Gradual |

**Datos que pedir a cada comercio** (una hoja por tienda):

- nombre de la tienda, dirección completa con referencia, teléfono, horario por día, costo de envío;
- por producto: nombre, descripción corta, categoría, foto o fotos (JPEG, PNG o WebP, menos de 2 MB), y por cada variante su nombre, SKU y precio;
- si controla inventario: existencias iniciales y umbral de alerta.

---

## 7. Decisiones que conviene tomar ahora

| # | Decisión | Recomendación |
|---|---|---|
| C1 | ¿Quién carga los productos? | El comercio piloto con acompañamiento. Si no, hay que construir la pantalla de administración (sección 5, punto 3) |
| C2 | ¿Se construye carga masiva? | Solo si algún comercio tiene más de unas decenas de productos; sería un archivo de hoja de cálculo con validaciones y vista previa |
| C3 | ¿Qué categorías tendrá el catálogo maestro? | Definirlas con el negocio y cargarlas antes que los comercios; con un nivel de subcategorías es suficiente al inicio |
| C4 | ¿Se exige dirección para publicar una tienda? | Sí; evita pedidos sin lugar de recogida |
| C5 | ¿Un comercio puede tener varios usuarios? | No por ahora; si sale la necesidad, es una decisión de identidad y se estudia aparte |
| C6 | Estándar de fotos | Fondo claro, producto centrado, menos de 2 MB; dar una guía breve a los comercios |

---

## 8. Riesgos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| Se abre al público con catálogo mal cargado | Mala primera impresión | Pedido de prueba por tienda y revisión visual antes de abrir |
| Fotos pesadas o desiguales | Tienda lenta e inconsistente | Guía de fotos y revisión del peso en la prueba visual |
| Productos publicados sin stock correcto | Pedidos que no se pueden cumplir | Cargar el inventario antes de publicar y usar el umbral de alerta |
| Precios mal escritos | Cobros erróneos | Revisión de la lista de precios antes de publicar |
| Una tienda sin horario o con horario mal puesto | Aparece cerrada | Verificar «abierta ahora» en la lista pública |
| El comercio no sabe usar la consola | Carga lenta o incompleta | Capacitación corta y, si hace falta, pantalla de administración para ayudar |
| Datos de prueba mezclados con reales | Confusión en producción | No reutilizar la base local; usar un proyecto de producción limpio |

---

## 9. Qué se necesita de ti

1. **Decidir C1 a C4**, o aceptar las recomendaciones.
2. **Elegir los comercios piloto** y reunir sus datos con la hoja de la sección 6.
3. **Definir las categorías iniciales** del catálogo maestro.
4. Tener firmado el **convenio de afiliación** de cada piloto antes de aprobarlo.

Con eso, el trabajo de código que sigue es pequeño: sembrar el catálogo maestro y, si se decide, la pantalla de administración o la carga masiva.
