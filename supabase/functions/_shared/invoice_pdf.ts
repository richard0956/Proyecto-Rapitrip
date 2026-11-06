import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

/** Documento tal como lo devuelve `public.get_invoice`. */
export type InvoiceLine = { product: string; variant?: string | null; sku?: string | null; quantity: number; unit_price: number | string; line_total: number | string };
export type InvoiceDoc = {
  kind: "venta" | "servicio" | "nota_credito_venta" | "nota_credito_servicio";
  number: string;
  issued_at: string;
  total: number | string;
  reason?: string | null;
  sha256: string;
  credit_for_number?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_anonymized?: boolean;
  payment_status: string;
  delivered_at?: string | null;
  delivery_confirmed_at?: string | null;
  data: {
    legend?: string;
    order_number: number;
    store_name: string;
    commerce_name?: string | null;
    payment_method: "efectivo" | "tarjeta";
    payment_intent_id?: string | null;
    currency?: string | null;
    delivery_class?: string | null;
    eta_min_days?: number | null;
    eta_max_days?: number | null;
    lines: InvoiceLine[];
  };
};

const LEGEND = "Comprobante interno de Rapitrip, sin validez fiscal";
const ZONE = "America/Managua";

export const documentTitle = (kind: InvoiceDoc["kind"]): string =>
  ({ venta: "FACTURA DE VENTA", servicio: "FACTURA DE SERVICIO", nota_credito_venta: "NOTA DE CRÉDITO - VENTA", nota_credito_servicio: "NOTA DE CRÉDITO - SERVICIO" })[kind];

export const paymentStatusLabel = (status: string, method: string): string =>
  ({
    pendiente: method === "efectivo" ? "Pendiente de cobro en la entrega" : "Pendiente de pago",
    pagado: "Pagado",
    fallido: "Pago fallido",
    reembolso_pendiente: "Reembolso en curso",
    reembolsado: "Reembolsado",
  } as Record<string, string>)[status] ?? status;

/** La fuente estándar solo codifica Latin-1: lo demás se cambia por «?» para que el PDF nunca falle por un carácter raro. */
export function pdfSafe(text: unknown): string {
  return String(text ?? "")
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[^ -ÿ]/g, "?");
}

export function money(value: number | string, currency?: string | null): string {
  const n = Number(value);
  const code = (currency ?? "NIO").toUpperCase();
  const symbol = ({ NIO: "C$", USD: "US$" } as Record<string, string>)[code] ?? code;
  return `${symbol} ${(Number.isFinite(n) ? n : 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function dateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-NI", { dateStyle: "long", timeStyle: "short", timeZone: ZONE }).format(new Date(iso));
}

/** Parte un texto en líneas que caben en `maxWidth`; una palabra más larga que la línea se corta. */
export function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = "";
  const push = () => {
    if (current) lines.push(current);
    current = "";
  };
  for (const word of pdfSafe(text).split(/\s+/).filter(Boolean)) {
    let w = word;
    while (font.widthOfTextAtSize(w, size) > maxWidth) {
      let cut = w.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
      push();
      lines.push(w.slice(0, cut));
      w = w.slice(cut);
    }
    const attempt = current ? `${current} ${w}` : w;
    if (font.widthOfTextAtSize(attempt, size) <= maxWidth) current = attempt;
    else {
      push();
      current = w;
    }
  }
  push();
  return lines.length ? lines : [""];
}

const INK = rgb(0.1, 0.12, 0.11);
const MUTED = rgb(0.4, 0.43, 0.41);
const GREEN = rgb(0.09, 0.4, 0.27);
const LINE = rgb(0.85, 0.87, 0.86);
const PAPER = rgb(0.95, 0.97, 0.96);

/** Genera el PDF de una factura o nota de crédito. `receiptUrl` es el recibo de Stripe (solo pagos con tarjeta), si se pudo consultar. */
export async function renderInvoicePdf(doc: InvoiceDoc, opts: { receiptUrl?: string | null } = {}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28;
  const H = 841.89;
  const M = 48;
  const R = W - M;
  const d = doc.data;
  const isCredit = doc.kind.startsWith("nota_credito");
  const cur = d.currency;

  pdf.setTitle(`${documentTitle(doc.kind)} ${doc.number}`);
  pdf.setAuthor("Rapitrip");
  pdf.setSubject(LEGEND);
  pdf.setCreationDate(new Date(doc.issued_at));

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const text = (s: string, x: number, yy: number, size = 10, font = regular, color = INK) =>
    page.drawText(pdfSafe(s), { x, y: yy, size, font, color });
  const right = (s: string, xr: number, yy: number, size = 10, font = regular, color = INK) => {
    const safe = pdfSafe(s);
    page.drawText(safe, { x: xr - font.widthOfTextAtSize(safe, size), y: yy, size, font, color });
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M, y: yy }, end: { x: R, y: yy }, thickness: 0.6, color: LINE });
  const newPage = () => {
    page = pdf.addPage([W, H]);
    y = H - M;
  };

  // Encabezado
  text("RAPITRIP", M, y - 18, 22, bold, GREEN);
  right(documentTitle(doc.kind), R, y - 10, 12, bold);
  right(doc.number, R, y - 26, 12, bold, GREEN);
  right(`Generada el ${dateTime(doc.issued_at)}`, R, y - 40, 9, regular, MUTED);
  y -= 58;
  page.drawRectangle({ x: M, y: y - 22, width: R - M, height: 22, color: PAPER });
  text(LEGEND, M + 10, y - 15, 9, bold, MUTED);
  y -= 44;

  // Partes
  const col2 = M + 270;
  text(isCredit ? "ANULA / CORRIGE" : doc.kind === "venta" ? "VENDEDOR" : "EMISOR DEL SERVICIO", M, y, 8, bold, MUTED);
  text("CLIENTE", col2, y, 8, bold, MUTED);
  y -= 15;
  let yl = y;
  const seller = doc.kind.endsWith("venta")
    ? [d.commerce_name ?? d.store_name, d.commerce_name && d.store_name !== d.commerce_name ? `Tienda: ${d.store_name}` : null]
    : ["Rapitrip", "Servicio de entrega"];
  if (isCredit && doc.credit_for_number) seller.unshift(`Factura ${doc.credit_for_number}`);
  for (const s of seller.filter(Boolean) as string[]) {
    text(s, M, yl, 10, s === seller[0] ? bold : regular);
    yl -= 14;
  }
  let yr = y;
  const buyerName = doc.buyer_name || "Cliente";
  const buyer = doc.buyer_anonymized
    ? ["Cliente anonimizado"]
    : [buyerName, doc.buyer_email && doc.buyer_email !== buyerName ? doc.buyer_email : null];
  for (const s of buyer.filter(Boolean) as string[]) {
    text(s, col2, yr, 10, s === buyer[0] ? bold : regular);
    yr -= 14;
  }
  y = Math.min(yl, yr) - 10;
  rule(y);
  y -= 20;

  // Datos del pedido
  const info: [string, string][] = [
    ["Pedido", `#${d.order_number}`],
    ["Entrega", d.delivery_class === "programado"
      ? `Programada${d.eta_min_days != null && d.eta_max_days != null ? ` (${d.eta_min_days === d.eta_max_days ? d.eta_max_days : `${d.eta_min_days} a ${d.eta_max_days}`} días)` : ""}`
      : "Express"],
    ["Método de pago", d.payment_method === "tarjeta" ? "Tarjeta" : "Efectivo"],
    ["Estado de pago", paymentStatusLabel(doc.payment_status, d.payment_method)],
  ];
  if (doc.delivery_confirmed_at) info.push(["Recepción", `Confirmada con código el ${dateTime(doc.delivery_confirmed_at)}`]);
  for (const [k, v] of info) {
    text(k, M, y, 9, regular, MUTED);
    text(v, M + 110, y, 10, bold);
    y -= 15;
  }
  y -= 8;

  // Tabla de líneas
  const xQty = R - 190;
  const xUnit = R - 100;
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: R - M, height: 20, color: PAPER });
    text("Descripción", M + 8, y, 9, bold, MUTED);
    right("Cant.", xQty, y, 9, bold, MUTED);
    right("Precio unit.", xUnit, y, 9, bold, MUTED);
    right("Importe", R - 8, y, 9, bold, MUTED);
    y -= 22;
  };
  header();
  for (const line of d.lines) {
    const label = [line.product, line.variant].filter(Boolean).join(" - ");
    const wrapped = wrap(label, regular, 10, xQty - M - 70);
    if (y - wrapped.length * 13 < M + 150) {
      newPage();
      header();
    }
    wrapped.forEach((part, i) => text(part, M + 8, y - i * 13, 10));
    right(String(line.quantity), xQty, y);
    right(money(line.unit_price, cur), xUnit, y);
    right(money(line.line_total, cur), R - 8, y);
    y -= wrapped.length * 13 + 5;
    rule(y + 2);
    y -= 8;
  }

  // Total
  y -= 6;
  page.drawRectangle({ x: R - 230, y: y - 10, width: 230, height: 30, color: PAPER });
  text(isCredit ? "TOTAL ACREDITADO" : "TOTAL", R - 218, y, 10, bold, MUTED);
  right(money(doc.total, cur), R - 10, y, 14, bold, GREEN);
  y -= 40;

  if (isCredit && doc.reason) {
    text("Motivo", M, y, 9, bold, MUTED);
    y -= 14;
    for (const part of wrap(doc.reason, regular, 10, R - M)) {
      text(part, M, y, 10);
      y -= 13;
    }
    y -= 8;
  }

  if (opts.receiptUrl) {
    text("Recibo de pago de Stripe", M, y, 9, bold, MUTED);
    y -= 13;
    for (const part of wrap(opts.receiptUrl, regular, 8, R - M)) {
      text(part, M, y, 8, regular, GREEN);
      y -= 11;
    }
  }

  // Pie de cada página: leyenda y huella para verificar que el contenido no cambió.
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: M - 6 }, end: { x: R, y: M - 6 }, thickness: 0.6, color: LINE });
    p.drawText(pdfSafe(`${LEGEND}.`), { x: M, y: M - 20, size: 8, font: regular, color: MUTED });
    p.drawText(pdfSafe(`Huella ${doc.sha256.slice(0, 16)}...   Página ${i + 1} de ${pages.length}`), {
      x: M, y: M - 31, size: 8, font: regular, color: MUTED,
    });
  });

  return await pdf.save();
}
