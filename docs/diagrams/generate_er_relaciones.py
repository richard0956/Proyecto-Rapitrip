"""Draw one relationship diagram per domain, including cross-domain reference nodes."""
from collections import defaultdict
from html import escape
from pathlib import Path
import runpy
import xml.etree.ElementTree as ET

base = Path(__file__).resolve().parent
model = runpy.run_path(str(base / "generate_er.py"))
tables = model["tables"]

panels = [
    ("Identidad y acceso", "#447de3", [
        ["identity.profiles", "identity.commerces", "sales.departments"],
        ["identity.profile_pii", "identity.user_roles", "identity.couriers", "identity.invitations", "identity.commerce_requests"],
        ["identity.push_subscriptions", "identity.deletion_requests", "identity.feedback", "identity.institutional_domains", "identity.access_reviews"]]),
    ("Comercios, catálogo e inventario", "#159f9b", [
        ["identity.commerces", "sales.departments"],
        ["commerce.stores", "commerce.master_items"],
        ["commerce.store_hours", "commerce.store_exceptions", "commerce.products", "commerce.catalog_reports", "commerce.catalog_notices", "commerce.catalog_measures"],
        ["commerce.product_variants", "commerce.product_images", "commerce.catalog_reviews"],
        ["commerce.inventory", "commerce.stock_movements"]]),
    ("Pedidos y entregas", "#956ceb", [
        ["identity.profiles", "identity.couriers", "commerce.stores", "commerce.product_variants", "identity.commerces", "sales.departments", "sales.delivery_zones", "sales.cash_sessions"],
        ["sales.checkouts", "sales.customer_addresses", "sales.delivery_quotes", "sales.orders"],
        ["sales.order_items", "sales.order_events", "sales.order_delivery", "sales.order_offers", "sales.order_codes"],
        ["sales.delivery_evidence", "sales.delivery_issues", "sales.return_requests"]]),
    ("Geografía y parámetros operativos", "#dd9a43", [
        ["sales.departments"],
        ["sales.department_anchors", "sales.delivery_zones", "sales.delivery_settings", "sales.delivery_class_settings", "sales.programmed_bands", "sales.evidence_settings", "sales.cash_settings", "sales.document_counters"]]),
    ("Pagos, caja, liquidaciones y facturas", "#dc7187", [
        ["sales.orders", "sales.return_requests", "identity.commerces", "identity.profiles", "identity.couriers"],
        ["sales.payment_events", "sales.cash_registers", "sales.cash_sessions", "sales.commerce_agreements", "sales.invoices", "sales.invoice_buyers"],
        ["sales.cash_session_incidents", "sales.cash_handoffs", "sales.settlements", "sales.reconciliations"],
        ["sales.cash_handoff_items", "sales.cash_accountability", "sales.settlement_items", "sales.settlement_reversals"]]),
    ("Auditoría y servicios internos", "#7c91a5", [
        ["audit.events", "audit.login_events", "audit.it_incidents", "private.role_management", "private.session_activity"],
        ["private.email_outbox", "private.push_outbox", "private.login_attempts", "private.whatsapp_outbox"]]),
]

W, BOX_W, BOX_H, XGAP, YGAP = 3500, 520, 78, 120, 28
MARGIN_X, TOP = 55, 175
panel_layouts = []
y0 = TOP
for title, color, columns in panels:
    panel_h = 95 + max(len(col) for col in columns) * (BOX_H + YGAP) + 40
    positions = {}
    for ci, col in enumerate(columns):
        x = MARGIN_X + 45 + ci * (BOX_W + XGAP)
        col_h = len(col) * (BOX_H + YGAP) - YGAP
        yy = y0 + 82 + (panel_h - 125 - col_h) / 2
        for ri, name in enumerate(col):
            positions[name] = (x, int(yy + ri * (BOX_H + YGAP)))
    panel_layouts.append((title, color, columns, y0, panel_h, positions))
    y0 += panel_h + 28
H = y0 + 45

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
       f'<rect x="0" y="0" width="{W}" height="{H}" fill="#f4f7fb"/>',
       '<text x="55" y="69" font-family="Arial" font-size="39" font-weight="700" fill="#18283e">Modelo entidad-relación · Rapitrip</text>',
       '<text x="55" y="112" font-family="Arial" font-size="19" fill="#52627a">Relaciones dibujadas a partir de claves foráneas declaradas en las migraciones SQL.</text>',
       '<text x="55" y="142" font-family="Arial" font-size="17" fill="#66768d">La línea une la tabla referenciada con la tabla que contiene la FK. Las entidades compartidas se repiten en cada área para facilitar la lectura.</text>']

drawn_edges = set()
for title, color, columns, py, ph, pos in panel_layouts:
    svg.append(f'<rect x="55" y="{py}" width="3390" height="{ph}" fill="#ffffff" stroke="#dce4ef" stroke-width="2"/>')
    svg.append(f'<rect x="55" y="{py}" width="3390" height="59" fill="{color}"/>')
    svg.append(f'<text x="78" y="{py+40}" font-family="Arial" font-size="25" font-weight="700" fill="white">{escape(title)}</text>')
    edges = defaultdict(list)
    for child in pos:
        for col, parent, parent_col in tables[child]["fk"]:
            if parent in pos:
                edges[(parent, child)].append(col)
                drawn_edges.add((child, col, parent))
    # Route lines behind entity cards. Parallel FK columns share a single connection.
    for ei, ((parent, child), cols) in enumerate(edges.items()):
        px, py2 = pos[parent]
        cx, cy = pos[child]
        sy = py2 + BOX_H / 2
        ey = cy + BOX_H / 2
        if parent == child:
            sx = px + BOX_W - 42
            ex = px + BOX_W - 18
            points = f"{sx},{py2} {sx},{py2-18} {ex},{py2-18} {ex},{py2}"
        elif px < cx:
            sx, ex = px + BOX_W, cx
            mid = sx + (ex - sx) * (0.43 + (ei % 3) * 0.07)
            points = f"{sx},{sy} {mid},{sy} {mid},{ey} {ex},{ey}"
        elif px > cx:
            sx, ex = px, cx + BOX_W
            mid = min(sx, ex) - 30 - (ei % 5) * 9
            points = f"{sx},{sy} {mid},{sy} {mid},{ey} {ex},{ey}"
        else:
            sx = px + BOX_W
            ex = cx + BOX_W
            mid = sx + 27 + (ei % 4) * 12
            points = f"{sx},{sy} {mid},{sy} {mid},{ey} {ex},{ey}"
        svg.append(f'<polyline points="{points}" fill="none" stroke="{color}" stroke-opacity="0.57" stroke-width="3"/>')
        svg.append(f'<circle cx="{ex}" cy="{ey}" r="5" fill="{color}"/>')
    for col in columns:
        for name in col:
            x, yy = pos[name]
            is_context = not ((name.startswith("identity.") and title == "Identidad y acceso") or
                              (name.startswith("commerce.") and title.startswith("Comercios")) or
                              (name.startswith("sales.") and title in ("Pedidos y entregas", "Geografía y parámetros operativos", "Pagos, caja, liquidaciones y facturas")) or
                              (name.startswith(("audit.", "private.")) and title.startswith("Auditoría")))
            fill = "#f0f4fa" if is_context else "#ffffff"
            border = "#aebdd0" if is_context else color
            svg.append(f'<rect x="{x}" y="{yy}" width="{BOX_W}" height="{BOX_H}" fill="{fill}" stroke="{border}" stroke-width="2"/>')
            svg.append(f'<text x="{x+15}" y="{yy+30}" font-family="Arial" font-size="20" font-weight="700" fill="#21334e">{escape(name)}</text>')
            pk = ", ".join(tables[name]["pk"]) or "—"
            fk_count = len(tables[name]["fk"])
            info = f"PK: {pk}    ·    {fk_count} FK declarada{'s' if fk_count != 1 else ''}"
            svg.append(f'<text x="{x+15}" y="{yy+57}" font-family="Arial" font-size="16" fill="#5e7088">{escape(info)}</text>')

all_fk = {(child, col, parent) for child, data in tables.items() for col, parent, _ in data["fk"] if parent in tables}
missing = all_fk - drawn_edges
svg.append(f'<text x="55" y="{H-26}" font-family="Arial" font-size="17" fill="#5f7085">Fuente: supabase/migrations · {len(tables)} tablas · {len(all_fk)} FK entre tablas · {len(drawn_edges)} relaciones representadas en líneas · {len(missing)} sin línea</text>')
svg.append('</svg>')
out = base / "modelo_er_con_relaciones.svg"
out.write_text("\n".join(svg), encoding="utf-8")
mxfile = ET.Element("mxfile", {"host": "app.diagrams.net", "type": "device"})
diagram = ET.SubElement(mxfile, "diagram", {"id": "rapitrip-er", "name": "Modelo ER"})
graph = ET.SubElement(diagram, "mxGraphModel", {"dx": "1800", "dy": "1200", "grid": "1", "gridSize": "10", "page": "1", "pageScale": "1", "pageWidth": str(W), "pageHeight": str(H)})
root = ET.SubElement(graph, "root")
ET.SubElement(root, "mxCell", {"id": "0"})
ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
for pi, (title, color, columns, py, ph, pos) in enumerate(panel_layouts):
    cell = ET.SubElement(root, "mxCell", {"id": f"panel-{pi}", "value": title, "style": f"rounded=0;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#dce4ef;fontColor={color};fontStyle=1;fontSize=24;verticalAlign=top;align=left;spacingLeft=18;spacingTop=8;", "vertex": "1", "parent": "1"})
    ET.SubElement(cell, "mxGeometry", {"x": "55", "y": str(py), "width": "3390", "height": str(ph), "as": "geometry"})
    for name, (x, yy) in pos.items():
        node_id = f"p{pi}-{name}"
        pk = ", ".join(tables[name]["pk"]) or "—"
        detail = f"{name}\nPK: {pk}"
        node = ET.SubElement(root, "mxCell", {"id": node_id, "value": detail, "style": f"rounded=0;whiteSpace=wrap;html=0;fillColor=#ffffff;strokeColor={color};fontColor=#21334e;align=left;verticalAlign=middle;spacingLeft=12;fontSize=16;", "vertex": "1", "parent": "1"})
        ET.SubElement(node, "mxGeometry", {"x": str(x), "y": str(yy), "width": str(BOX_W), "height": str(BOX_H), "as": "geometry"})
    edge_columns = defaultdict(list)
    for child in pos:
        for col, parent, _ in tables[child]["fk"]:
            if parent in pos:
                edge_columns[(parent, child)].append(col)
    for ei, ((parent, child), cols) in enumerate(edge_columns.items()):
        edge = ET.SubElement(root, "mxCell", {"id": f"p{pi}-edge-{ei}", "value": "FK: " + ", ".join(cols), "style": f"edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=0;strokeColor={color};strokeWidth=2;fontSize=12;fontColor=#41536b;labelBackgroundColor=#ffffff;endArrow=none;", "edge": "1", "parent": "1", "source": f"p{pi}-{parent}", "target": f"p{pi}-{child}"})
        ET.SubElement(edge, "mxGeometry", {"relative": "1", "as": "geometry"})
drawio = base / "modelo_er_con_relaciones.drawio"
ET.ElementTree(mxfile).write(drawio, encoding="utf-8", xml_declaration=True)
print(f"{W}x{H}; {len(all_fk)} FK; {len(drawn_edges)} drawn; {len(missing)} missing: {sorted(missing)}")
