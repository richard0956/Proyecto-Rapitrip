"""Generate an ER overview from the project's SQL migrations (standard library only)."""
from collections import defaultdict
from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "supabase" / "migrations"
OUT = Path(__file__).with_name("modelo_entidad_relacion.svg")


def split_items(body):
    items, start, depth, quote = [], 0, 0, None
    for i, char in enumerate(body):
        if quote:
            if char == quote and (i == 0 or body[i - 1] != "\\"):
                quote = None
        elif char in "'\"":
            quote = char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            items.append(body[start:i].strip())
            start = i + 1
    items.append(body[start:].strip())
    return items


tables = {}
for path in sorted(MIGRATIONS.glob("*.sql")):
    sql = re.sub(r"--[^\n]*", "", path.read_text(encoding="utf-8-sig"))
    for match in re.finditer(r"\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\(", sql, re.I):
        name = match.group(1).lower()
        pos, depth = match.end(), 1
        while depth and pos < len(sql):
            depth += (sql[pos] == "(") - (sql[pos] == ")")
            pos += 1
        body = sql[match.end():pos - 1]
        table = tables.setdefault(name, {"pk": [], "fk": [], "other": []})
        for item in split_items(body):
            first = re.match(r'\s*"?([\w]+)"?\s+([\w.]+)', item)
            if not first:
                continue
            col = first.group(1).lower()
            if col in ("constraint", "primary", "foreign", "unique", "check"):
                pk = re.search(r"\bprimary\s+key\s*\(([^)]+)\)", item, re.I)
                if pk:
                    table["pk"] += [x.strip().strip('"') for x in pk.group(1).split(",")]
                fk = re.search(r"\bforeign\s+key\s*\(([^)]+)\)\s*references\s+([\w.]+)\s*\(([^)]+)\)", item, re.I)
                if fk:
                    table["fk"].append((fk.group(1).strip(), fk.group(2).lower(), fk.group(3).strip()))
                continue
            if re.search(r"\bprimary\s+key\b", item, re.I):
                table["pk"].append(col)
            ref = re.search(r"\breferences\s+([\w.]+)\s*\(([^)]+)\)", item, re.I)
            if ref:
                table["fk"].append((col, ref.group(1).lower(), ref.group(2).strip()))
            elif col not in table["pk"]:
                table["other"].append(col)
    # Later migrations add columns and explicit FK constraints.
    for statement in sql.split(";"):
        alter = re.search(r"\balter\s+table\s+(?:if\s+exists\s+)?([\w.]+)", statement, re.I)
        if not alter or alter.group(1).lower() not in tables:
            continue
        table = tables[alter.group(1).lower()]
        for fk in re.finditer(r"\bforeign\s+key\s*\(([^)]+)\)\s*references\s+([\w.]+)\s*\(([^)]+)\)", statement, re.I):
            table["fk"].append((fk.group(1).strip(), fk.group(2).lower(), fk.group(3).strip()))
        for fk in re.finditer(r"\badd\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)\s+[\w.]+[^,;]*?\breferences\s+([\w.]+)\s*\(([^)]+)\)", statement, re.I | re.S):
            table["fk"].append((fk.group(1).lower(), fk.group(2).lower(), fk.group(3).strip()))

for table in tables.values():
    table["pk"] = list(dict.fromkeys(table["pk"]))
    table["fk"] = list(dict.fromkeys(table["fk"]))

groups = [
    ("IDENTIDAD Y ACCESO", "identity", ["profiles", "profile_pii", "user_roles", "commerces", "couriers", "invitations", "commerce_requests", "push_subscriptions", "deletion_requests", "feedback", "institutional_domains", "access_reviews"]),
    ("COMERCIOS Y CATÁLOGO", "commerce", ["stores", "store_hours", "store_exceptions", "master_items", "products", "product_variants", "product_images", "inventory", "stock_movements", "catalog_reports", "catalog_notices", "catalog_reviews", "catalog_measures"]),
    ("PEDIDOS Y ENTREGAS", "sales", ["checkouts", "orders", "order_items", "order_events", "order_delivery", "order_offers", "order_codes", "delivery_evidence", "delivery_issues", "return_requests", "customer_addresses", "delivery_quotes"]),
    ("GEOGRAFÍA Y REGLAS", "sales", ["departments", "department_anchors", "delivery_zones", "delivery_settings", "delivery_class_settings", "programmed_bands", "evidence_settings", "cash_settings", "document_counters"]),
    ("PAGOS, CAJA Y FACTURAS", "sales", ["payment_events", "cash_registers", "cash_sessions", "cash_session_incidents", "cash_handoffs", "cash_handoff_items", "cash_accountability", "commerce_agreements", "settlements", "settlement_items", "settlement_reversals", "reconciliations", "invoices", "invoice_buyers"]),
    ("AUDITORÍA Y SERVICIOS", None, ["audit.events", "audit.login_events", "audit.it_incidents", "private.role_management", "private.session_activity", "private.email_outbox", "private.push_outbox", "private.login_attempts", "private.whatsapp_outbox"]),
]

assigned = [f"{schema}.{name}" if "." not in name else name for _, schema, names in groups for name in names]
assert set(assigned) == set(tables), f"Missing or extra: {set(assigned) ^ set(tables)}"

COL_W, GAP, LEFT = 510, 24, 40
TOP, HEADER_H = 170, 76
FONT = "Arial, Segoe UI, sans-serif"
colors = ["#4d88f5", "#16a6a3", "#a17af7", "#e6a24c", "#e4778b", "#7e94aa"]
layouts = []
for gi, (title, schema, names) in enumerate(groups):
    x = LEFT + gi * (COL_W + GAP)
    y = TOP + HEADER_H
    cards = []
    for short in names:
        name = f"{schema}.{short}" if "." not in short else short
        data = tables[name]
        refs = [f"{col} → {target}" for col, target, _ in data["fk"]]
        others = [c for c in data["other"] if c not in data["pk"] and c not in [f[0] for f in data["fk"]]][:2]
        lines = [f"PK  {', '.join(data['pk'])}" if data["pk"] else "PK  —"]
        lines += ["FK  " + r for r in refs]
        if others:
            lines.append("Campos  " + ", ".join(others))
        h = 47 + len(lines) * 24 + 14
        cards.append((name, x, y, h, lines))
        y += h + 14
    layouts.append((title, x, cards, y))

WIDTH = LEFT * 2 + len(groups) * COL_W + (len(groups) - 1) * GAP
HEIGHT = max(z[-1] for z in layouts) + 105
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" viewBox="0 0 {WIDTH} {HEIGHT}">',
       f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#f4f7fb"/>',
       f'<text x="40" y="68" font-family="{FONT}" font-size="36" font-weight="700" fill="#17243b">Modelo entidad-relación · Rapitrip</text>',
       f'<text x="40" y="108" font-family="{FONT}" font-size="18" fill="#53647c">Estructura derivada de {len(list(MIGRATIONS.glob("*.sql")))} migraciones SQL · {len(tables)} tablas · claves y relaciones declaradas</text>',
       f'<text x="40" y="139" font-family="{FONT}" font-size="16" fill="#6a7890">Cada línea FK indica la columna que referencia otra tabla. Las vistas, funciones y relaciones no declaradas como FK se omiten.</text>']
for gi, (title, x, cards, _) in enumerate(layouts):
    color = colors[gi]
    svg.append(f'<rect x="{x}" y="{TOP}" width="{COL_W}" height="58" rx="12" fill="{color}"/>')
    svg.append(f'<text x="{x+18}" y="{TOP+37}" font-family="{FONT}" font-size="20" font-weight="700" fill="white">{escape(title)}</text>')
    for name, cx, cy, h, lines in cards:
        svg.append(f'<rect x="{cx}" y="{cy}" width="{COL_W}" height="{h}" rx="10" fill="white" stroke="#dce4ef" stroke-width="1.5"/>')
        svg.append(f'<rect x="{cx}" y="{cy}" width="7" height="{h}" rx="3" fill="{color}"/>')
        svg.append(f'<text x="{cx+20}" y="{cy+31}" font-family="{FONT}" font-size="19" font-weight="700" fill="#20324e">{escape(name)}</text>')
        for j, line in enumerate(lines):
            font = 15 if len(line) > 55 else 16
            svg.append(f'<text x="{cx+20}" y="{cy+59+j*24}" font-family="{FONT}" font-size="{font}" fill="{("#3f5b85" if j == 0 else "#52647b")}">{escape(line)}</text>')
svg.append(f'<text x="40" y="{HEIGHT-35}" font-family="{FONT}" font-size="15" fill="#6a7890">Fuente: supabase/migrations · Generado a partir de CREATE TABLE y referencias FOREIGN KEY / REFERENCES.</text>')
svg.append('</svg>')
OUT.write_text("\n".join(svg), encoding="utf-8")
print(f"{len(tables)} tables; {sum(len(x['fk']) for x in tables.values())} foreign keys; {WIDTH}x{HEIGHT}; {OUT}")
