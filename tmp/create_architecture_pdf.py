from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas


OUT = Path(r"C:\Users\alexa\Proyecto RT\output\pdf\arquitectura_software_rapitrip.pdf")
OUT.parent.mkdir(parents=True, exist_ok=True)
pdfmetrics.registerFont(TTFont("Segoe", r"C:\Windows\Fonts\segoeui.ttf"))
pdfmetrics.registerFont(TTFont("SegoeBold", r"C:\Windows\Fonts\segoeuib.ttf"))

W, H = landscape(A4)
NAVY = colors.HexColor("#203248")
MUTED = colors.HexColor("#5F7081")
TEAL = colors.HexColor("#087A7B")
LINE = colors.HexColor("#AAB9C6")
PALE = colors.HexColor("#F8FAFB")
CARD = colors.HexColor("#FFFFFF")

c = canvas.Canvas(str(OUT), pagesize=(W, H), pageCompression=1)
c.setTitle("Arquitectura de software de Rapitrip")
c.setAuthor("Rapitrip")
c.setFillColor(colors.white)
c.rect(0, 0, W, H, stroke=0, fill=1)


def text_center(x, y, value, size=10, bold=False, color=NAVY):
    c.setFillColor(color)
    c.setFont("SegoeBold" if bold else "Segoe", size)
    c.drawCentredString(x, y, value)


def text_left(x, y, value, size=10, bold=False, color=NAVY):
    c.setFillColor(color)
    c.setFont("SegoeBold" if bold else "Segoe", size)
    c.drawString(x, y, value)


def box(x, y, w, h, title, lines, *, border=LINE, fill=CARD, title_size=12, body_size=9.4):
    c.setFillColor(fill)
    c.setStrokeColor(border)
    c.setLineWidth(1.1)
    c.roundRect(x, y, w, h, 8, stroke=1, fill=1)
    mid = x + w / 2
    text_center(mid, y + h - 25, title, title_size, True)
    for index, line in enumerate(lines):
        text_center(mid, y + h - 44 - index * 13, line, body_size, False, MUTED)


def connector(points, *, arrow=False, color=LINE, width=1.3):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    p = c.beginPath()
    p.moveTo(*points[0])
    for x, y in points[1:]:
        p.lineTo(x, y)
    c.drawPath(p)
    if arrow:
        x1, y1 = points[-2]
        x2, y2 = points[-1]
        c.setFillColor(color)
        tri = c.beginPath()
        if abs(x2 - x1) > abs(y2 - y1):
            sign = 1 if x2 > x1 else -1
            tri.moveTo(x2, y2)
            tri.lineTo(x2 - 7 * sign, y2 + 4)
            tri.lineTo(x2 - 7 * sign, y2 - 4)
        else:
            sign = 1 if y2 > y1 else -1
            tri.moveTo(x2, y2)
            tri.lineTo(x2 - 4, y2 - 7 * sign)
            tri.lineTo(x2 + 4, y2 - 7 * sign)
        tri.close()
        c.drawPath(tri, stroke=0, fill=1)


# Editorial heading and page guide.
text_left(45, 551, "Arquitectura de software de Rapitrip", 23, True)
text_left(45, 530, "Aplicaciones, backend compartido y servicios de apoyo", 11, False, MUTED)
c.setStrokeColor(colors.HexColor("#D7E0E6"))
c.setLineWidth(0.8)
c.line(45, 515, 797, 515)
text_left(45, 494, "APLICACIONES WEB", 9, True, TEAL)

# Connections are placed behind the nodes.
c.setFillColor(PALE)
c.setStrokeColor(colors.HexColor("#CDD9E0"))
c.setLineWidth(1.2)
c.roundRect(45, 110, 612, 264, 11, stroke=1, fill=1)
text_left(63, 350, "BACKEND COMPARTIDO", 9, True, TEAL)
text_left(63, 337, "Supabase", 10.5, True, NAVY)
for x in (157.5, 420.5, 683.5):
    connector([(x, 407), (x, 394)], color=NAVY)
connector([(157.5, 394), (683.5, 394)], color=NAVY)
connector([(420.5, 394), (420.5, 327)], color=NAVY)
connector([(130, 327), (574, 327)], color=NAVY)
for x in (130, 278, 426, 574):
    connector([(x, 327), (x, 305)], arrow=True, color=NAVY)

# Backend components and internal links.
for x in (130, 278, 426, 574):
    connector([(x, 229), (x, 201)], arrow=True, color=LINE)
connector([(641, 267), (680, 267)], arrow=True, color=TEAL, width=1.5)

box(45, 407, 225, 73, "Tienda", ["Catálogo, carrito", "y compras"], border=colors.HexColor("#B7C8D3"))
box(308, 407, 225, 73, "Consola", ["Administración, comercios,", "caja y coordinación"], border=colors.HexColor("#B7C8D3"))
box(571, 407, 225, 73, "Repartidor", ["Ofertas, entregas", "y evidencias"], border=colors.HexColor("#B7C8D3"))

box(63, 229, 134, 76, "Auth", ["Cuentas, sesiones", "y segundo factor"], border=colors.HexColor("#8FB9B9"), title_size=11, body_size=8.7)
box(211, 229, 134, 76, "API pública", ["Vistas de lectura", "y funciones RPC"], border=colors.HexColor("#8FB9B9"), title_size=11, body_size=8.7)
box(359, 229, 134, 76, "Storage", ["Imágenes y archivos", "con acceso controlado"], border=colors.HexColor("#8FB9B9"), title_size=11, body_size=8.7)
box(507, 229, 134, 76, "Edge Functions", ["Integraciones y tareas", "con secretos"], border=colors.HexColor("#8FB9B9"), title_size=10.4, body_size=8.7)
box(115, 133, 475, 68, "PostgreSQL", ["identity  ·  commerce  ·  sales  ·  audit  ·  private", "Roles, seguridad por filas y transacciones"], border=colors.HexColor("#8FB9B9"), title_size=12, body_size=9)

# External providers remain outside the Supabase boundary.
box(680, 225, 117, 84, "Servicios externos", ["Stripe", "Correo y WhatsApp"], border=colors.HexColor("#B7C8D3"), title_size=9.7, body_size=8.8)
text_center(738.5, 203, "Integraciones", 8.3, False, MUTED)

# Shared code is a dependency of all three web apps, not a running service.
c.setFillColor(colors.HexColor("#F3F6F8"))
c.setStrokeColor(colors.HexColor("#DAE3E8"))
c.roundRect(45, 49, 752, 43, 7, stroke=1, fill=1)
text_left(60, 75, "PAQUETES COMPARTIDOS", 8.8, True, TEAL)
text_left(220, 75, "Interfaz · validaciones · tipos de datos · mapas · acceso a Supabase", 9.2, False, NAVY)
text_left(60, 58, "Código reutilizado por las aplicaciones; no se despliega como servicio independiente.", 8.5, False, MUTED)
text_left(45, 25, "Vista lógica basada en la estructura implementada en el repositorio de Rapitrip.", 8, False, MUTED)

c.showPage()
c.save()
print(OUT)
