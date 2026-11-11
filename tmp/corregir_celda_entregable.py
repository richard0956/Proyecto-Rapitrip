from docx import Document

path = r"C:\Users\alexa\Proyecto RT\docs\entregables\Entregable final de Diseño de Internet Rapitrip actualizado.docx"
doc = Document(path)
doc.tables[10].rows[15].cells[3].text = (
    "Para el pedido de ejemplo (producto C$450, zona 1), la liquidación suma C$405 "
    "para el comercio, C$40 por entrega y C$55 de comisión: C$500 en total. "
    "La conciliación registra por separado la comisión del proveedor de pagos."
)
doc.save(path)
