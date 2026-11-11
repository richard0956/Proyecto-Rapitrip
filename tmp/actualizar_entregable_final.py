from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt

SOURCE = Path(r"C:\Users\alexa\OneDrive\Documentos\Entregable final de Diseño de Internet(Rapitrip).docx")
OUTPUT = Path(r"C:\Users\alexa\Proyecto RT\docs\entregables\Entregable final de Diseño de Internet Rapitrip actualizado.docx")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

doc = Document(SOURCE)
anchor = next(p for p in doc.paragraphs if p.text.strip() == "Requerimientos Funcionales y No funcionales")


def insert(text, style, *, list_item=False):
    para = anchor.insert_paragraph_before(style=style)
    run = para.add_run(text)
    run.bold = style.startswith("Heading")
    para.paragraph_format.keep_together = True
    if list_item:
        para.paragraph_format.left_indent = Inches(0.35)
        para.paragraph_format.first_line_indent = Inches(-0.22)
        para.paragraph_format.space_after = Pt(2)
    return para


insert("Introducción", "Heading 2")
insert(
    "Rapitrip desarrolla una plataforma de comercio electrónico y gestión logística que relaciona a clientes, comercios afiliados, personal operativo y repartidores. Sus procesos abarcan la publicación de productos, el control de inventario, la compra, el pago y la entrega. Por ello, el sistema requiere información compartida y permisos diferenciados para coordinar cada pedido desde su creación hasta su cierre.",
    "Body Text First Indent",
)
insert(
    "Este entregable final integra los tres avances anteriores y actualiza sus decisiones conforme al desarrollo alcanzado. Reúne los requerimientos, los casos de uso y los modelos de procesos, clases, navegación y datos; además, explica la arquitectura de tres aplicaciones web sobre un backend compartido en Supabase. Así, el análisis y el diseño se relacionan con los componentes construidos y con las estrategias técnicas y de seguridad que sustentan su funcionamiento.",
    "Body Text First Indent",
)

insert("Objetivos", "Heading 2")
insert("Objetivo general", "Heading 3")
insert(
    "Diseñar y desarrollar una plataforma digital para Rapitrip que integre el comercio electrónico y la gestión logística, permita la participación de clientes, comercios, personal operativo y repartidores, y mantenga seguros y consistentes el catálogo, el inventario, los pedidos, los pagos y las entregas.",
    "Body Text First Indent",
)
insert("Objetivos específicos", "Heading 3")
for number, objective in enumerate(
    [
        "Definir requerimientos funcionales y no funcionales verificables a partir de los procesos y actores de Rapitrip.",
        "Modelar casos de uso, procesos, clases, navegación y datos para mantener la trazabilidad del diseño.",
        "Describir la arquitectura de tres aplicaciones web y un backend compartido en Supabase, con responsabilidades delimitadas.",
        "Integrar catálogo, inventario, pedidos, pagos y entregas mediante flujos de información consistentes.",
        "Aplicar controles de acceso y trazabilidad, y contrastar los modelos con el desarrollo y las pruebas.",
    ],
    start=1,
):
    insert(f"{number}. {objective}", "Body Text First Indent", list_item=True)

# The following section begins the original body of requirements and models.
anchor.paragraph_format.page_break_before = True

# Correct direct contradictions left by earlier deliverables, without altering their detailed requirements.
replacements = {
    "3.2.1. Monolito modular centrado en la base de datos":
        "3.2.1. Backend modular centrado en la base de datos",
    "Aplicación o área responsable: consola web (todas las áreas), tienda web y aplicación del repartidor si se desarrolla; control de acceso transversal.":
        "Aplicación o área responsable: consola web, tienda web y aplicación web del repartidor; control de acceso transversal.",
    "Aplicación o área responsable: tienda web (origen del pedido) y motor de pedidos en el servidor. La lógica del pedido se construye en F3 y la interfaz del cliente en F4.":
        "Aplicación o área responsable: tienda web (origen del pedido) y funciones del backend. La lógica del pedido se incorporó desde F3 y la interfaz de compra se desarrolló en F4.",
    "Aplicación o área responsable: consola web, área /operaciones, y aplicación del repartidor (opcional, Etapa 2). Sin la aplicación, el coordinador de pedidos anota quién entrega cada pedido y confirma la entrega a mano, como hoy.":
        "Aplicación o área responsable: consola web, área de coordinación, y aplicación web del repartidor. La coordinación asigna y supervisa las entregas, mientras que el repartidor registra sus acciones y evidencias en la aplicación.",
    "Rapitrip es una plataforma multi-rol con varias aplicaciones: una tienda web para el cliente, una consola web para el personal y los comercios y, más adelante, una aplicación móvil para el repartidor. Todas usan un único backend, que guarda los datos, aplica las reglas del negocio y decide quién puede hacer cada acción. Las aplicaciones solo lo consumen y no contienen reglas de negocio.":
        "Rapitrip es una plataforma con tres aplicaciones web: una tienda para los clientes, una consola para el personal y los comercios, y una aplicación para los repartidores. Las tres comparten un backend administrado en Supabase, donde se gestionan los datos, los permisos y las reglas críticas de operación. Las interfaces consumen sus servicios y conservan la lógica de presentación y validación necesaria para cada actor.",
    "El backend es un monolito modular: una sola unidad desplegable dividida en módulos con responsabilidades propias. No se usan microservicios, porque un equipo pequeño y un solo PostgreSQL no los justifican.":
        "El backend se organiza por dominios sobre un proyecto compartido de Supabase. PostgreSQL concentra los datos y las reglas críticas, mientras que las Edge Functions atienden integraciones y tareas que requieren secretos. No se emplean microservicios propios; las tres aplicaciones web se construyen y despliegan por separado.",
    "Los dominios futuros (comercios, catálogo, inventario, pedidos) se agregan como esquemas nuevos sin modificar los existentes.":
        "Los dominios de identidad, comercios, catálogo, inventario y pedidos se incorporaron mediante migraciones, manteniendo límites funcionales dentro de la base de datos compartida.",
    "El backend de este informe es la fase F1. El resto sigue la propuesta tecnológica.":
        "Este apartado se originó en la fase F1 y conserva la secuencia de construcción prevista en el plan inicial. Los módulos desarrollados posteriormente se describen en el análisis y la arquitectura integrados de este entregable.",
}
seen = set()
for para in doc.paragraphs:
    if para.text in replacements:
        original = para.text
        para.text = replacements[original]
        seen.add(original)
assert seen == set(replacements), f"No se hallaron párrafos: {set(replacements) - seen}"

for cell in doc.tables[9].rows[1].cells:
    if "Tilopay" in cell.text:
        cell.text = cell.text.replace("Tilopay", "Stripe").replace(
            "El checkout con el SDK web de Stripe se presenta al cliente en F4.",
            "La tienda inicia una sesión de pago con Stripe y confirma el resultado mediante el webhook.",
        )
for cell in doc.tables[9].rows[6].cells:
    if "Tilopay" in cell.text:
        cell.text = cell.text.replace("Tilopay", "Stripe")

rnf = doc.tables[10]
rnf.rows[2].cells[3].text = (
    "Monitoreo de Supabase y de las aplicaciones web desplegadas en Vercel; "
    "el 99 % de un mes de 30 días permite hasta 7.2 horas de indisponibilidad."
)
rnf.rows[9].cells[1].text = (
    "Modularidad y mantenibilidad: backend compartido en Supabase, tres aplicaciones web "
    "(tienda, consola y repartidor), paquetes comunes, migraciones versionadas como fuente de verdad "
    "y documentación de despliegue y operación."
)
rnf.rows[11].cells[1].text = (
    "Compatibilidad: tienda, consola y aplicación del repartidor disponibles en navegadores modernos, "
    "con interfaces adaptadas a teléfono y computador según las tareas de cada actor."
)
rnf.rows[11].cells[3].text = (
    "Pruebas de las tres aplicaciones web en navegadores y dispositivos representativos, "
    "incluidas las funciones de cámara y ubicación que utiliza la aplicación del repartidor."
)

phase = doc.tables[15]
phase.rows[0].cells[2].text = "Enfoque del plan inicial"
phase.rows[1].cells[2].text = "Base del backend"
phase.rows[3].cells[1].text = "Motor de pedidos, cobros con Stripe, caja y venta"
phase.rows[5].cells[1].text = "Aplicación web del repartidor, tablero de operaciones y liquidaciones"

doc.tables[2].rows[6].cells[3].text = (
    "Cada excepción conserva causa, responsable y resolución. También se registran las ofertas "
    "sin respuesta y la falta de repartidores disponibles durante la asignación automática."
)
doc.tables[10].rows[15].cells[3].text = (
    "Para el pedido de ejemplo (producto C$450, zona 1), la liquidación suma C$405 "
    "para el comercio, C$40 por entrega y C$55 de comisión: C$500 en total. "
    "La conciliación registra por separado la comisión del proveedor de pagos."
)

doc.save(OUTPUT)
print(OUTPUT)
