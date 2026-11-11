from pathlib import Path
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFont

SOURCE = Path(r"C:\Users\alexa\OneDrive\Documentos\Rapitrip\Docs\Segundo entregable de Diseño de sistemas(Rapitrip) respaldo original.docx")
OUT_DIR = Path(r"C:\Users\alexa\Proyecto RT\docs\entregables")
OUT_DIR.mkdir(parents=True, exist_ok=True)
OUTPUT = OUT_DIR / "Segundo entregable de Diseño de sistemas Rapitrip actualizado.docx"
FIGURE = OUT_DIR / "arquitectura_rapitrip.png"

font_path = Path(r"C:\Windows\Fonts\arial.ttf")
bold_path = Path(r"C:\Windows\Fonts\arialbd.ttf")
font = ImageFont.truetype(str(font_path), 24)
small = ImageFont.truetype(str(font_path), 21)
bold = ImageFont.truetype(str(bold_path), 27)
image = Image.new("RGB", (1500, 730), "#ffffff")
draw = ImageDraw.Draw(image)


def box(xy, title, detail, fill, stroke):
    draw.rounded_rectangle(xy, radius=14, fill=fill, outline=stroke, width=3)
    x1, y1, _, _ = xy
    draw.text((x1 + 20, y1 + 17), title, font=bold, fill="#1c304b")
    for i, line in enumerate(detail.split("\n")):
        draw.text((x1 + 20, y1 + 57 + i * 28), line, font=small, fill="#4b5d73")


def arrow(points, color="#60748f"):
    draw.line(points, fill=color, width=4, joint="curve")
    x1, y1 = points[-2]
    x2, y2 = points[-1]
    if abs(x2 - x1) >= abs(y2 - y1):
        d = 1 if x2 > x1 else -1
        draw.polygon([(x2, y2), (x2 - 14 * d, y2 - 8), (x2 - 14 * d, y2 + 8)], fill=color)
    else:
        d = 1 if y2 > y1 else -1
        draw.polygon([(x2, y2), (x2 - 8, y2 - 14 * d), (x2 + 8, y2 - 14 * d)], fill=color)


draw.text((40, 20), "Clientes web", font=bold, fill="#1c304b")
box((40, 67, 480, 180), "Tienda", "Clientes · catálogo, carrito\ny pedidos", "#eef4ff", "#87a8e7")
box((530, 67, 970, 180), "Consola", "Personal y comercios · gestión\ny coordinación", "#eef4ff", "#87a8e7")
box((1020, 67, 1460, 180), "Repartidor", "Ofertas, entregas, evidencias\ny efectivo", "#eef4ff", "#87a8e7")
draw.text((40, 238), "Backend administrado en Supabase", font=bold, fill="#1c304b")
box((40, 286, 380, 405), "Auth", "Cuentas, sesiones\ny MFA", "#eaf8f5", "#7fc7bb")
box((410, 286, 750, 405), "API pública", "Vistas de lectura\ny funciones RPC", "#eaf8f5", "#7fc7bb")
box((780, 286, 1120, 405), "Edge Functions", "Integraciones, secretos\ny tareas externas", "#eaf8f5", "#7fc7bb")
box((1150, 286, 1460, 405), "Storage", "Imágenes y archivos\ncon acceso controlado", "#eaf8f5", "#7fc7bb")
draw.line([(260, 180), (260, 220), (1240, 220), (1240, 180)], fill="#60748f", width=4)
draw.line([(750, 180), (750, 220)], fill="#60748f", width=4)
for x in (210, 580, 950, 1305):
    arrow([(x, 220), (x, 286)])
arrow([(210, 405), (210, 465), (640, 465), (640, 505)])
arrow([(580, 405), (580, 505)])
arrow([(950, 405), (950, 465), (640, 465), (640, 505)])
box((240, 505, 1030, 632), "PostgreSQL", "Esquemas identity, commerce, sales, audit y private\nRoles, RLS, transacciones y reglas de negocio", "#fff7e8", "#e5bd70")
box((1080, 505, 1460, 632), "Servicios externos", "Stripe, correo y WhatsApp", "#f6eefb", "#bda0d7")
arrow([(950, 405), (950, 455), (1270, 455), (1270, 505)])
draw.text((40, 681), "Los paquetes compartidos reutilizan interfaz, validaciones, tipos, mapas y acceso a Supabase.", font=font, fill="#4b5d73")
image.save(FIGURE)

doc = Document(SOURCE)
start = next(i for i, p in enumerate(doc.paragraphs) if p.text.strip() == "Arquitectura de software de Rapitrip")
for paragraph in doc.paragraphs[start:]:
    paragraph._element.getparent().remove(paragraph._element)

styles = doc.styles
body_style = styles.add_style("Architecture Body", 1)
body_style.base_style = styles["Normal"]
body_style.font.name = "Arial"
body_style.font.size = Pt(10.5)
body_style.font.color.rgb = RGBColor(0, 0, 0)
body_style.paragraph_format.space_after = Pt(7)
body_style.paragraph_format.line_spacing = 1.15
body_style.paragraph_format.keep_together = True
for name, size, before, after in (("Heading 1", 16, 15, 8), ("Heading 2", 12.5, 11, 5)):
    style = styles[name]
    style.font.name = "Arial"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.keep_with_next = True


def h1(text):
    return doc.add_paragraph(text, style="Heading 1")


def h2(text):
    return doc.add_paragraph(text, style="Heading 2")


def p(text):
    para = doc.add_paragraph(style="Architecture Body")
    run = para.add_run(text)
    run.bold = False
    return para


h1("Arquitectura de software de Rapitrip")
p("Versión actualizada: 9 de noviembre de 2026. Esta sección describe la organización implementada en el repositorio del sistema.")
h2("1. Enfoque general")
p("Rapitrip mantiene una arquitectura cliente-servidor: las personas utilizan aplicaciones web y las operaciones se resuelven mediante servicios del backend. Sin embargo, la implementación final no consiste en una única aplicación de servidor organizada como monolito. El sistema reúne tres aplicaciones web independientes en un mismo repositorio y un backend administrado en Supabase, cuya lógica se distribuye entre la base de datos, su API y funciones de borde.")
p("Esta decisión conserva un núcleo de datos y reglas común para clientes, comercios, personal y repartidores. Al mismo tiempo, permite presentar interfaces distintas según las tareas de cada actor, sin duplicar las reglas críticas de acceso y de operación.")
fig = doc.add_paragraph()
fig.alignment = WD_ALIGN_PARAGRAPH.CENTER
fig.paragraph_format.space_after = Pt(3)
fig.add_run().add_picture(str(FIGURE), width=Inches(6.4))
caption = p("Figura 1. Estructura de aplicaciones y componentes del backend de Rapitrip.")
caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
caption.paragraph_format.keep_with_next = False

h2("2. Aplicaciones cliente y código compartido")
p("La tienda web atiende al cliente y reúne el catálogo, el carrito, la compra y el seguimiento de pedidos. La consola web concentra las tareas de administración, caja, coordinación y gestión de comercios. Por su parte, la aplicación del repartidor permite consultar ofertas y entregas, registrar evidencias y gestionar acciones relacionadas con el efectivo. Las tres están desarrolladas con Next.js y se encuentran en las carpetas apps/store, apps/console y apps/dealer.")
p("Estas aplicaciones comparten paquetes para componentes de interfaz, acceso a Supabase, validaciones, tipos de la base de datos y funciones de mapas. Por ello, la reutilización ocurre dentro del repositorio, mientras que cada aplicación conserva sus rutas, pantallas y responsabilidades propias. Los paquetes compartidos no constituyen servicios independientes desplegados por separado.")

h2("3. Backend y organización de los datos")
p("Supabase proporciona la autenticación, la API, PostgreSQL, el almacenamiento de archivos y las Edge Functions. Las aplicaciones consumen servicios mediante el SDK de Supabase, tanto desde el navegador como desde código de servidor de Next.js. De esta forma, no establecen conexiones SQL directas con PostgreSQL: consultan vistas y ejecutan funciones públicas autorizadas, además de utilizar los servicios de autenticación y almacenamiento cuando corresponde.")
p("La base de datos concentra las reglas que deben aplicarse de manera uniforme a todos los clientes. Sus tablas se agrupan por responsabilidad en los esquemas identity, commerce, sales, audit y private. El esquema public ofrece la superficie de acceso mediante vistas de lectura y funciones RPC; las políticas de seguridad por filas y las comprobaciones de permisos restringen las operaciones según la cuenta, el rol y su alcance.")
p("En identity se gestionan perfiles, roles, comercios, invitaciones y repartidores. En commerce se organizan tiendas, horarios, productos, variantes e inventario. En sales se relacionan compras, pedidos, pagos, entregas, caja, liquidaciones y facturas. Además, audit registra eventos e incidentes, mientras que private contiene componentes internos como actividad de sesión y bandejas de salida. Esta separación funcional ordena el backend, aunque todos los módulos comparten la misma base de datos.")
p("Las Edge Functions atienden operaciones que requieren secretos, comunicación externa o generación de archivos, como el procesamiento de eventos de pago, el envío de mensajes y la producción de documentos. Asimismo, Storage conserva imágenes y otros archivos con reglas de acceso acordes con su uso.")

h2("4. Recorrido de una operación")
p("Una compra ilustra la relación entre las capas. El cliente prepara el carrito en la tienda y envía la solicitud de compra a una función pública. La base valida la información, calcula los importes y registra el checkout o el pedido junto con sus artículos, conforme al flujo elegido. Cuando interviene un pago con tarjeta, una Edge Function se comunica con Stripe y el webhook aplica el resultado mediante funciones de la base de datos. Después, la consola y la aplicación del repartidor consultan y actualizan únicamente las acciones que sus permisos permiten.")
p("Así, el estado del pedido, el inventario, la entrega y los registros asociados se mantienen vinculados en PostgreSQL. Las notificaciones y otras tareas externas pueden utilizar bandejas de salida y ejecuciones programadas; este mecanismo asincrónico no implica que los módulos sean microservicios separados.")

h2("5. Seguridad y control de acceso")
p("Supabase Auth gestiona las cuentas y sesiones. A partir de esa identidad, la base verifica los roles y aplica políticas de seguridad por filas para limitar qué información puede leerse o modificarse. Las acciones críticas se canalizan mediante funciones que comprueban permisos y condiciones de la operación. Para el personal y los comercios, el diseño también exige controles reforzados de sesión y segundo factor en la consola.")
p("Los secretos de proveedores externos se reservan para las funciones y configuraciones de servidor. Por tanto, la interfaz utiliza únicamente las credenciales públicas y el contexto de la sesión; no debe decidir por sí sola si una persona puede ejecutar una acción sensible. La auditoría registra las operaciones relevantes para permitir su revisión posterior.")

h2("6. Despliegue y operación")
p("El proyecto se organiza como un monorepo, pero eso no significa que se despliegue como una sola aplicación. El repositorio configura tres proyectos web en Vercel, uno por aplicación, mientras que las migraciones y Edge Functions de Supabase siguen un flujo de despliegue propio. Esta división permite actualizar una interfaz sin volver a desplegar necesariamente las otras, aunque los cambios en los contratos compartidos requieren coordinación.")
p("La dependencia central continúa siendo Supabase, especialmente la base de datos y sus reglas. Una interrupción de ese backend puede afectar simultáneamente a las tres aplicaciones. También existen dependencias de servicios externos para pagos y comunicaciones; por ello, las integraciones deben contemplar errores, reintentos y registro de resultados.")

h2("7. Ventajas y limitaciones del diseño")
p("La principal ventaja es que los datos, permisos y transacciones se gestionan desde un núcleo común. Esto favorece la consistencia de pedidos, inventario y pagos, a la vez que permite reutilizar componentes y validaciones entre las aplicaciones. Además, la división por esquemas y funciones hace explícitas las responsabilidades sin exigir la operación de múltiples bases de datos o servicios propios.")
p("Como limitación, parte de la lógica queda ligada a PostgreSQL y a los servicios de Supabase, por lo que cualquier cambio en las funciones o en el modelo de datos puede afectar a varios clientes. También es necesario coordinar la evolución de las aplicaciones y las migraciones, comprobar la compatibilidad de sus contratos y supervisar las integraciones externas. En consecuencia, la independencia de despliegue de las interfaces no elimina la dependencia del backend compartido.")

h2("8. Evolución prevista")
p("La arquitectura actual puede ampliarse manteniendo límites claros entre los módulos de identidad, comercio, ventas y logística. Antes de separar alguno como servicio independiente, conviene medir problemas reales de escala, disponibilidad o ritmo de cambios. Si aparecen esas necesidades, se podrán evaluar mecanismos adicionales de integración y despliegue. Por ahora, los webhooks, las bandejas de salida y las tareas programadas resuelven procesos asincrónicos concretos sin convertir al sistema en una arquitectura de microservicios.")

h2("9. Conclusión")
p("Rapitrip conserva el principio cliente-servidor planteado inicialmente, pero su estructura implementada se describe con mayor precisión como tres aplicaciones web sobre un backend administrado y modular en Supabase. La base de datos reúne las reglas y los datos compartidos; la API y las Edge Functions exponen las operaciones necesarias; y cada aplicación presenta las funciones de su actor. Esta definición refleja la organización actual del código y permite orientar su mantenimiento y evolución.")

doc.save(OUTPUT)
print(OUTPUT)
