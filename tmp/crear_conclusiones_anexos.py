from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn


ROOT = Path(r"C:\Users\alexa\Proyecto RT")
OUT = ROOT / "docs" / "entregables" / "Conclusiones recomendaciones y anexos Rapitrip.docx"
ARCH = ROOT / "docs" / "entregables" / "arquitectura_rapitrip.png"
ER = ROOT / "docs" / "diagrams" / "modelo_er_con_relaciones.png"

doc = Document()
sec = doc.sections[0]
sec.page_width = Inches(8.5)
sec.page_height = Inches(11)
sec.top_margin = Inches(0.78)
sec.bottom_margin = Inches(0.7)
sec.left_margin = Inches(0.82)
sec.right_margin = Inches(0.82)

normal = doc.styles["Normal"]
normal.font.name = "Aptos"
normal.font.size = Pt(11)
normal.font.bold = False
normal.paragraph_format.line_spacing = 1.18
normal.paragraph_format.space_after = Pt(8)

for name, size, before, after in [("Title", 18, 0, 13), ("Heading 1", 14, 17, 8), ("Heading 2", 12, 12, 6)]:
    style = doc.styles[name]
    style.font.name = "Aptos"
    style.font.size = Pt(size)
    style.font.bold = True
    style.font.color.rgb = None
    style.paragraph_format.space_before = Pt(before)
    style.paragraph_format.space_after = Pt(after)
    style.paragraph_format.keep_with_next = True
    if name == "Title":
        ppr = style._element.get_or_add_pPr()
        for border in ppr.findall(qn("w:pBdr")):
            ppr.remove(border)


def p(text, *, keep=False):
    para = doc.add_paragraph(text)
    para.paragraph_format.keep_together = keep
    return para


def heading(text, level=1):
    return doc.add_paragraph(text, style="Heading 1" if level == 1 else "Heading 2")


def link(paragraph, label, url):
    part = paragraph.part
    rel = part.relate_to(
        url,
        "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink",
        is_external=True,
    )
    h = OxmlElement("w:hyperlink")
    h.set(qn("r:id"), rel)
    run = OxmlElement("w:r")
    props = OxmlElement("w:rPr")
    color = OxmlElement("w:color")
    color.set(qn("w:val"), "17365D")
    props.append(color)
    underline = OxmlElement("w:u")
    underline.set(qn("w:val"), "single")
    props.append(underline)
    run.append(props)
    text = OxmlElement("w:t")
    text.text = label
    run.append(text)
    h.append(run)
    paragraph._p.append(h)


doc.add_paragraph("Conclusiones recomendaciones y anexos de Rapitrip", style="Title")
p("Complemento del entregable final de Diseño de Sistemas en Internet.")

heading("Conclusión")
p("El desarrollo de este entregable permitió reunir en un mismo documento los requerimientos, modelos y decisiones técnicas de Rapitrip. Los casos de uso y diagramas describen las actividades de clientes, comercios, personal operativo y repartidores; a su vez, el modelo de datos y la arquitectura muestran cómo se relacionan esas actividades con la información y los componentes del sistema. Esta integración facilita seguir una necesidad del negocio desde su planteamiento hasta la solución diseñada para atenderla.")
p("Durante el avance del proyecto se precisó la estructura inicialmente prevista. Rapitrip se organiza en tres aplicaciones web —tienda, consola y aplicación del repartidor— que comparten un backend administrado en Supabase. En ese backend se concentran los datos, los controles de acceso y las operaciones que deben mantener resultados consistentes, mientras que cada aplicación presenta las funciones correspondientes a sus usuarios. La división de la base de datos por responsabilidades, junto con las políticas de seguridad y las funciones destinadas a operaciones críticas, da una base clara para continuar el desarrollo.")
p("El documento también deja visibles las dependencias de esta decisión: un cambio en los datos o en las funciones compartidas puede afectar a más de una aplicación. Por ello, la utilidad de los modelos no termina con su elaboración. Su valor depende de mantenerlos acordes con las migraciones, las interfaces y las pruebas conforme evolucione el proyecto. En este sentido, el entregable constituye una referencia para revisar lo construido y orientar las siguientes etapas, aunque la verificación del funcionamiento en los distintos entornos debe sustentarse con resultados de prueba y evidencia de operación.")

heading("Recomendaciones")
recommendations = [
    "Mantener la relación entre requerimientos, modelos y componentes del sistema. Se recomienda elaborar una matriz de trazabilidad en la que cada requerimiento tenga asociados sus casos de uso, diagramas, módulos y pruebas correspondientes. De esta manera, cuando se modifique un proceso, el equipo podrá identificar qué partes del diseño y del código deben revisarse. Asimismo, la matriz ayudará a detectar funciones descritas en el documento que todavía no cuenten con una verificación definida.",
    "Actualizar la documentación al mismo ritmo que el sistema. Cada cambio relevante en las migraciones, las reglas de negocio o las aplicaciones debe acompañarse de una revisión de los diagramas y las descripciones técnicas afectadas. En particular, conviene presentar de forma uniforme la solución del repartidor como una aplicación web, ya que algunas referencias proceden de la propuesta inicial de una aplicación móvil futura. Esto permitirá que el documento siga representando la arquitectura utilizada.",
    "Conservar evidencia verificable de las pruebas. Además de mantener los archivos de prueba en el repositorio, se recomienda registrar la fecha de ejecución, la versión del código, el entorno y el resultado obtenido. La revisión debe abarcar los permisos de cada actor y los recorridos principales de compra, pago, coordinación y entrega. Así, será posible distinguir entre una prueba diseñada y una función cuyo comportamiento ya fue comprobado en condiciones determinadas.",
    "Validar los cambios en un entorno previo a producción. Antes de publicar nuevas funciones o migraciones, conviene comprobar que las tres aplicaciones siguen trabajando correctamente con el backend compartido. Esta validación debe incluir tanto los recorridos normales como situaciones de error, por ejemplo, pagos rechazados, pedidos cancelados, falta de repartidores disponibles o interrupciones en servicios externos. Con ello se reduce la posibilidad de que un cambio en un componente afecte procesos de otra aplicación sin advertirlo.",
    "Dar seguimiento al funcionamiento real de la plataforma. Una vez que el sistema opere con usuarios y pedidos reales, se recomienda observar la disponibilidad, los tiempos de respuesta, los errores de integración y las incidencias de los procesos principales. Estos datos permitirán priorizar correcciones y valorar si la estructura actual necesita ajustes. Por tanto, cualquier decisión de separar componentes o ampliar la infraestructura podrá apoyarse en problemas observados y no solo en previsiones.",
]
for i, item in enumerate(recommendations, 1):
    para = p(f"{i}. {item}", keep=True)
    para.paragraph_format.left_indent = Inches(0.25)
    para.paragraph_format.first_line_indent = Inches(-0.25)

doc.add_page_break()
heading("Anexo A  Estructura y versión del proyecto")
p("La estructura actual reúne la tienda web, la consola y la aplicación del repartidor en un mismo repositorio. Cada aplicación conserva sus pantallas y responsabilidades, mientras que los paquetes compartidos agrupan componentes de interfaz, validaciones, tipos y acceso a servicios comunes. La imagen siguiente resume cómo esas aplicaciones utilizan el backend administrado en Supabase.")
fig = doc.add_paragraph()
fig.alignment = WD_ALIGN_PARAGRAPH.CENTER
fig.add_run().add_picture(str(ARCH), width=Inches(6.75))
cap = p("Figura A1. Aplicaciones web y componentes del backend de Rapitrip.")
cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
cap.paragraph_format.space_after = Pt(12)
p("Estructura de referencia: apps/store, apps/console y apps/dealer para las aplicaciones; packages para el código compartido; y supabase para migraciones, funciones y pruebas de base de datos. Esta vista corresponde al material disponible en el proyecto al preparar el anexo.")

heading("Anexo B  Modelo de datos y migraciones")
p("El modelo entidad–relación muestra los vínculos entre las áreas de identidad, comercios, catálogo, inventario, pedidos, entregas, pagos y auditoría. Su fuente de contraste son las migraciones SQL conservadas en supabase/migrations. Como el esquema puede evolucionar, el diagrama debe revisarse junto con esas migraciones cuando se agreguen o modifiquen tablas y relaciones.")
fig = doc.add_paragraph()
fig.alignment = WD_ALIGN_PARAGRAPH.CENTER
fig.add_run().add_picture(str(ER), width=Inches(5.55))
cap = p("Figura B1. Modelo entidad–relación de Rapitrip con relaciones representadas por líneas.")
cap.alignment = WD_ALIGN_PARAGRAPH.CENTER

doc.add_page_break()
heading("Anexo C  Repositorio del proyecto")
para = doc.add_paragraph()
link(para, "https://github.com/richard0956/Proyecto-Rapitrip.git", "https://github.com/richard0956/Proyecto-Rapitrip.git")

heading("Anexo D  Prototipos y recorridos principales")
p("El entregable original remite a los prototipos de Figma para consultar los recorridos del cliente, la consola de operación y el repartidor. Los siguientes enlaces permiten revisar la navegación y las pantallas de cada actor.")
figma = [
    ("Vista general de los prototipos", "https://www.figma.com/design/ApaHyj069QzBBdk0EZvWF6/Rapitrip-%E2%80%94-Prototipo?node-id=154-16&t=t9E42RdjkWzE0mOy-1"),
    ("Prototipo de la tienda web", "https://www.figma.com/proto/ApaHyj069QzBBdk0EZvWF6/Rapitrip-%E2%80%94-Prototipo?node-id=154-1684&p=f&t=si0cF24jkYB08mGb-1&scaling=min-zoom&content-scaling=fixed&page-id=154%3A16&starting-point-node-id=154%3A1684&show-proto-sidebar=1"),
    ("Prototipo de la consola", "https://www.figma.com/proto/ApaHyj069QzBBdk0EZvWF6/Rapitrip-%E2%80%94-Prototipo?node-id=123-27&p=f&t=s3xnbkQQvhMBgJSg-1&scaling=min-zoom&content-scaling=fixed&page-id=22%3A2&starting-point-node-id=123%3A27&show-proto-sidebar=1"),
    ("Prototipo del repartidor", "https://www.figma.com/proto/ApaHyj069QzBBdk0EZvWF6/Rapitrip-%E2%80%94-Prototipo?node-id=50-1140&p=f&t=NmKWPr5oVan7EQe3-1&scaling=min-zoom&content-scaling=fixed&page-id=50%3A1139&starting-point-node-id=50%3A1140&show-proto-sidebar=1"),
]
for label, url in figma:
    para = doc.add_paragraph()
    link(para, label, url)
    para.paragraph_format.space_after = Pt(7)

footer = sec.footer.paragraphs[0]
footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
footer.add_run("Rapitrip  •  ")
field = OxmlElement("w:fldSimple")
field.set(qn("w:instr"), "PAGE")
footer._p.append(field)

OUT.parent.mkdir(parents=True, exist_ok=True)
doc.save(OUT)
print(OUT)
