from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from revisiones import REVIEWS, RNF_REVIEWS, EVIDENCE
root=Path(r'C:\Users\alexa\Proyecto RT')
source=Path(r'C:\Users\alexa\Downloads\Catalogo_RF_RNF_Rapitrip_por_Modulo_2026-10-13.md').read_text(encoding='utf-8')
rf=[]; rnf=[]
for line in source.splitlines():
    cells=[v.strip() for v in line.strip('|').split('|')]
    if line.startswith('| RF-') and len(cells)==7: rf.append(cells)
    if line.startswith('| RNF-') and len(cells)==5: rnf.append(cells)
assert len(rf)==53 and len(rnf)==15
d=Document(); sec=d.sections[0]
sec.page_width=Inches(8.5); sec.page_height=Inches(11)
sec.top_margin=sec.bottom_margin=Inches(.8); sec.left_margin=sec.right_margin=Inches(.85)
for name in ['Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3']:
 s=d.styles[name]; s.font.name='Times New Roman'; s.font.color.rgb=RGBColor(0,0,0)
 s.font.size=Pt(11 if name=='Normal' else 20 if name=='Title' else 14 if name=='Heading 1' else 12)
 s.font.bold=name.startswith('Heading') or name=='Title'
d.styles['Normal'].paragraph_format.space_after=Pt(6)
d.styles['Normal'].paragraph_format.line_spacing=1.08
def p(t): return d.add_paragraph(t)
def h(t,l=1): return d.add_heading(t,l)
def table(headers,rows):
 t=d.add_table(rows=1,cols=len(headers)); t.style='Table Grid'
 for c,v in zip(t.rows[0].cells,headers): c.text=v
 repeat=OxmlElement('w:tblHeader'); t.rows[0]._tr.get_or_add_trPr().append(repeat)
 for row in rows:
  cells=t.add_row().cells
  for c,v in zip(cells,row): c.text=str(v)
 for row in t.rows:
  for c in row.cells:
   for para in c.paragraphs:
    para.paragraph_format.space_after=Pt(4)
    for run in para.runs: run.font.size=Pt(10); run.bold=False
 return t
p('Universidad Nacional de Ingeniería')
p('Área de Conocimiento de Tecnología de la Información y Comunicación')
p('Programa Académico de Ingeniería de Sistemas')
d.add_paragraph('Informe final del proyecto Rapitrip',style='Title')
p('Desarrollo de una plataforma digital de comercio electrónico y gestión logística para la microempresa Rapitrip')
p('Diseño de Sistemas de Internet')
p('Richard Alexander Malespín Tinoco\nMarlyng Elizabeth Miranda Navarrete\nMoisés Abraham Zelaya Maldonado')
p('Base documental para actualización progresiva\nVersión 0.1 · 9 de noviembre de 2026\nManagua, Nicaragua')
d.add_page_break()
h('Contenido')
for title in ['1 Introducción','2 Objetivos','3 Requerimientos funcionales y no funcionales','4 Diagramas de casos de uso','5 Diagrama de clases','6 Diagramas de navegación y presentación','7 Diagramas de proceso','8 Modelo entidad relación','9 Arquitectura del software','10 Implementación del backend','11 Conclusiones de la comparación','12 Fuentes y trazabilidad técnica']: p(title)
p('La estructura conserva los ocho apartados del primer entregable y añade arquitectura, backend y resultados de la comparación. Los títulos permiten navegar y actualizar el documento en Word.')
h('1 Introducción')
p('Rapitrip integra la consulta de productos, la compra y la coordinación de entregas con la administración de comercios, inventario y cobros. El proyecto evolucionó desde un modelo inicial de cuatro actores hacia una plataforma con tienda, consola compartida y aplicación web del repartidor. En consecuencia, el informe debe reflejar tanto la ampliación funcional como las diferencias entre el diseño previsto y el código disponible.')
p('El primer entregable contiene 18 requisitos funcionales y 9 no funcionales. Por su parte, el catálogo del 13 de octubre de 2026 reúne 53 requisitos funcionales y 15 no funcionales. Su recuento comprende 32 filas funcionales identificadas como nuevas y 21 derivadas de requisitos anteriores; estas últimas no equivalen a 21 requisitos originales, pues varios fueron descompuestos.')
p('La revisión del código local encontró implementación de identidad, comercios, compra, logística, caja, liquidaciones y facturación. Sin embargo, existen diferencias en pasarela de pago, separación de cuentas, modalidades de envío, asignación del repartidor y frecuencia de actualización. Por ello, la presencia de código se registra como evidencia técnica y no como certificación de cumplimiento total.')
h('2 Objetivos')
h('2 1 Objetivo general',2)
p('Documentar la evolución del diseño y la implementación de Rapitrip, mediante la comparación del primer entregable, el catálogo ampliado y el código de la plataforma, para consolidar un informe final coherente con las funciones y responsabilidades del sistema.')
h('2 2 Objetivos específicos',2)
for text in ['Identificar los cambios de alcance, actores y reglas de negocio respecto del primer entregable.','Conservar la trazabilidad de los 53 requisitos funcionales y los 15 no funcionales, incorporando observaciones verificables del código.','Contrastar los casos de uso con el catálogo y distinguir su cobertura de la implementación efectiva.','Integrar progresivamente los modelos UWE/UML, la arquitectura y el backend con evidencias consistentes.']: p(text)
h('3 Requerimientos funcionales y no funcionales')
h('3 1 Criterio de revisión',2)
p('Se conserva el enunciado, actor, origen, fase, prioridad y criterio del catálogo para evitar que una diferencia de implementación modifique silenciosamente la línea base. Las observaciones se clasifican como Evidencia, Parcial, Diferencia o No localizada. Evidencia significa que se encontró una pieza pertinente; Parcial indica que no se acreditó todo el criterio; Diferencia señala una regla distinta; y No localizada identifica un flujo específico que no se pudo demostrar en los archivos revisados. Ninguna categoría sustituye las pruebas de aceptación.')
p('El contraste corresponde al código local revisado, con referencia Git 2d6ffdb. Se contaron 89 migraciones y 72 archivos de pruebas SQL. Las pruebas no se ejecutaron en esta revisión y tampoco se verificó el estado desplegado. Los códigos E01 a E17 remiten a las ubicaciones del apartado 12.')
h('3 2 Evolución de los actores',2)
table(['Actor','Responsabilidad y cambio'],[
('Cliente','Consulta y compra en la tienda web; mantiene direcciones, pedidos y cuenta.'),('Comercio','Gestiona sus tiendas y catálogo, y participa en confirmación y preparación. Su cuenta pertenece a la consola.'),('Coordinador de pedidos','Gestiona la operación desde /coordinacion. Sustituye la parte operativa del antiguo encargado de pedidos o ventas.'),('Cajero','Gestiona caja, comprobantes y recepción de efectivo. Se separa de la coordinación.'),('Administrador','Administra comercios, personal, configuración y supervisión; el código reserva también operaciones de liquidación a este rol.'),('Superadministrador','Gestiona atribuciones administrativas superiores, incluida el alta de administradores.'),('Repartidor','Dispone de aplicación web propia con disponibilidad, ofertas, pedidos, evidencias e historial.')])
p('El primer informe alterna las denominaciones encargado de pedidos y encargado de ventas. En la redacción actual se utiliza coordinador de pedidos para la operación y cajero para caja. Asimismo, la separación de cuentas por aplicación modifica el supuesto anterior de compartir acceso de cliente y comercio en una sola cuenta.')
h('3 3 Requerimientos funcionales',2)
names={'IDA':'Identidad y acceso','SUP':'Supervisión de la operación','COM':'Comercios y catálogo','INV':'Inventario','PED':'Carrito y pedidos','CLI':'Clientes y direcciones','SEG':'Seguimiento del pedido','ENT':'Asignación y entrega','COB':'Cobros y liquidación'}
for mod,name in names.items():
 h(mod+' '+name,3)
 for code,req,actor,origin,phase,priority,criterion in [r for r in rf if r[0].split('-')[1]==mod]:
  key=code[3:]; status,note=REVIEWS[key]
  title=d.add_paragraph(code+' '+req,style='Heading 3')
  p('Actor: '+actor+'. Origen: '+origin+'. Fase prevista: '+phase+'. Prioridad: '+('alta' if priority=='A' else 'media')+'.')
  p('Criterio del catálogo: '+criterion)
  p('Contraste con el código — '+status+': '+note)
h('3 4 Requerimientos no funcionales',2)
for code,req,origin,phase,criterion in rnf:
 h(code,3); p(req); p('Origen: '+origin+'. Fase prevista: '+phase+'.')
 p('Criterio del catálogo: '+criterion); p('Verificación: '+RNF_REVIEWS[code[-2:]])
h('3 5 Ampliaciones posteriores al catálogo',2)
p('El código incorpora entregas express y programadas, separación de una compra por tienda y clase de envío, evidencia de recogida además de entrega, control de efectivo por rendir, facturas y notas de crédito. Estas capacidades deben incorporarse mediante una revisión formal del catálogo; por ahora se documentan como ampliaciones identificadas, sin alterar el total histórico de 53 requisitos. [E06, E09, E11, E17]')
h('4 Diagramas de casos de uso')
h('4 1 Casos de uso de negocio',2)
p('El modelo de negocio debe conservar la relación entre compra, preparación, entrega y cobro, incorporando al comercio y separando las responsabilidades de coordinación y caja. El diagrama del primer entregable permanece como antecedente y debe actualizarse antes de presentarlo como representación de la operación actual.')
h('4 2 Casos de uso del sistema',2)
p('La referencia vigente es “Rapitrip - Casos de uso del sistema - Consolidado Etapas 1 y 2 (coordinador y cajero)”, identificador 775f06b8-e4ed-451f-8948-399f3a0ae356. Esta referencia sustituye al enlace anterior de Etapa 1. La validación de contenido del consolidado continúa pendiente; por tanto, esta versión no incorpora una figura ni declara cobertura total de los requisitos.')
p('Enlace de consulta: https://lucid.app/lucidchart/775f06b8-e4ed-451f-8948-399f3a0ae356/edit')
p('La aceptación del diagrama requiere enlazar cada RF con uno o varios casos de uso, comprobar los actores autorizados y distinguir procesos internos de servicios externos. Además, las funciones de sustitución, GPS y oferta automática deben conservar su condición prevista mientras no se acrediten en el código. Un diagrama puede representar el alcance requerido sin demostrar su implementación.')
h('5 Diagrama de clases')
p('La actualización del modelo de clases debe representar cuenta, rol y alcance de comercio, así como tienda, producto, variante, inventario, compra, pedido, oferta, evidencia, devolución y liquidación. El cambio más relevante es que una compra puede originar varios pedidos por tienda y clase de envío. Asimismo, el perfil se vincula con una aplicación, mientras el rol conserva la responsabilidad funcional. Estas relaciones deben verificarse antes de sustituir la figura inicial. [E02, E03, E06, E08, E11]')
h('6 Diagramas de navegación y presentación')
p('El primer entregable organizó la navegación mediante prototipos de Figma para cuatro actores. En la plataforma revisada, la navegación se distribuye entre tres aplicaciones y distintas áreas de consola. Por ello, la siguiente organización sirve de base para actualizar los recorridos y las capturas del informe.')
table(['Aplicación','Recorridos localizados'],[('Tienda','Catálogo, tiendas, productos, carrito, checkout, compras, pedidos, direcciones, cuenta y afiliación comercial.'),('Consola','/admin, /coordinacion, /caja, /comercio y /cuenta, con acciones restringidas según rol.'),('Repartidor','Inicio, pedidos, historial, efectivo y perfil, junto con acceso y aceptación de invitación.')])
h('7 Diagramas de proceso')
h('7 1 Realizar pedido',2)
p('El cliente selecciona productos y dirección; a continuación, el servidor evalúa disponibilidad y modalidad de envío, calcula el importe y crea la compra con sus pedidos. Cuando corresponde pago en línea, la confirmación llega mediante eventos de Stripe. Después, el comercio o la coordinación ejecutan las transiciones autorizadas de confirmación y preparación. La asignación y la ejecución logística continúan hasta la entrega, con las evidencias y excepciones previstas en el código. [E04, E05, E06, E09]')
p('Los estados adicionales pendiente_pago, en_validacion y rechazado deben incorporarse al modelo, junto con las diferencias de cancelación por actor. En consecuencia, el flujo de siete estados del catálogo no describe por completo la implementación actual.')
h('7 2 Registrar producto',2)
p('El comercio administra los productos de sus tiendas y utiliza el catálogo maestro mantenido por administración. El proceso debe incluir variantes, precio, imágenes, inventario y publicación, además de los atributos que determinan la elegibilidad express o programada. De este modo, el modelo conecta el catálogo con la logística de compra. [E03, E06]')
h('8 Modelo entidad relación')
p('Las migraciones versionadas constituyen la referencia técnica para reconstruir el modelo de datos. El diagrama actualizado debe integrar los dominios identity, commerce, sales y audit, y representar sus claves y cardinalidades reales. Las vistas públicas y las funciones de seguridad deben distinguirse de las entidades persistentes. La figura final requiere revisar las redefiniciones acumuladas, especialmente compras, pedidos, ofertas, evidencias, caja y liquidaciones. [E02 a E11]')
h('9 Arquitectura del software')
p('La estructura observada corresponde a un repositorio compartido con tres aplicaciones Next.js y paquetes comunes de interfaz, validación, mapas, cliente Supabase y tipos de base de datos. La lógica crítica se concentra en PostgreSQL mediante funciones y reglas de acceso, mientras las funciones de servidor integran servicios externos. Esta organización mantiene un backend común para las interfaces de cliente, personal, comercios y repartidores. [E01, E02, E16]')
p('Supabase aporta autenticación, base de datos y almacenamiento; Stripe interviene en pagos, y Mapbox en cartografía y cotización de rutas. La documentación local describe despliegue de las tres aplicaciones en Vercel y automatización mediante GitHub Actions. Se trata de arquitectura identificada en el repositorio, sin afirmar que la configuración desplegada haya sido comprobada. [E05, E06, E16]')
h('10 Implementación del backend')
p('Las operaciones de negocio utilizan funciones SQL para comprobar identidad, permisos, disponibilidad y estados. Además, la auditoría registra acciones y los eventos de pago se procesan con controles de repetición. Las fotografías y otros archivos se gestionan mediante almacenamiento y operaciones específicas. En conjunto, estas piezas permiten mantener reglas compartidas entre las tres aplicaciones. [E02, E04, E05, E09]')
p('La existencia de pruebas SQL, pruebas de funciones y pruebas de interfaz facilita preparar la validación final. Sin embargo, el informe deberá incorporar resultados fechados de ejecución, entorno y casos verificados, especialmente para permisos, concurrencia de stock, pagos repetidos, recuperación de conexión y conciliación. El inventario de pruebas no representa un resultado aprobado.')
h('11 Conclusiones de la comparación')
p('La plataforma amplía de manera considerable el alcance del primer entregable y formaliza nuevos actores, operaciones comerciales y responsabilidades financieras. El catálogo de 53 RF y 15 RNF ofrece una base trazable; sin embargo, necesita reconciliarse con las decisiones posteriores del desarrollo.')
p('Las diferencias prioritarias corresponden a la separación de cuentas, Stripe frente a Tilopay, los envíos express y programados, las ofertas gestionadas por coordinación, la ubicación de referencia y el refresco de 30 segundos. Asimismo, requieren demostración específica los flujos de faltantes y sustituciones, el cierre entre socios y el alcance financiero asignado a cada rol. Estas observaciones impiden declarar cumplimiento integral únicamente a partir de los archivos disponibles.')
p('Para consolidar el informe se debe completar la matriz de cobertura del diagrama vigente, acordar las modificaciones del catálogo y adjuntar resultados de aceptación. Después podrán actualizarse los modelos de clases, navegación, procesos y datos, conservando consistencia entre requisitos, diseño e implementación.')
h('12 Fuentes y trazabilidad técnica')
p('S01. Equipo Rapitrip. Primer entregable del proyecto de Diseño de Sistemas de Internet. 15 de agosto de 2026. PDF de 39 páginas. Apartados 1 a 8 y fichas RF y RNF.')
p('S02. Equipo Rapitrip. Catálogo de Requerimientos Funcionales y No Funcionales de la Plataforma Rapitrip. 13 de octubre de 2026. Archivo Catalogo_RF_RNF_Rapitrip_por_Modulo_2026-10-13.md.')
p('S03. Diagrama consolidado de Lucidchart indicado en el apartado 4. El primer enlace de Etapa 1 fue sustituido por el usuario y no fundamenta una evaluación de la versión vigente.')
p('S04. Código local de Proyecto RT. Referencia Git 2d6ffdb. Las ubicaciones siguientes son relativas a la carpeta del proyecto y permiten continuar la revisión.')
for code,title,desc in EVIDENCE:
 h(code+' '+title,3); p(desc)
footer=sec.footer.paragraphs[0]; footer.alignment=2
field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)
out=root/'output/doc/Informe_final_Rapitrip_base.docx';out.parent.mkdir(parents=True,exist_ok=True)
d.save(out)
print(out)
