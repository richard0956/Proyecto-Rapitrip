import { assert, assertEquals } from "jsr:@std/assert@1";
import { PDFDocument, StandardFonts } from "npm:pdf-lib@1.17.1";
import { documentTitle, type InvoiceDoc, money, paymentStatusLabel, pdfSafe, renderInvoicePdf, wrap } from "./invoice_pdf.ts";

const base: InvoiceDoc = {
  kind: "venta",
  number: "RT-V-000123",
  issued_at: "2026-11-05T20:32:00Z",
  total: 400,
  sha256: "a".repeat(64),
  buyer_name: "María Peña",
  buyer_email: "maria@ejemplo.test",
  payment_status: "pagado",
  delivery_confirmed_at: null,
  data: {
    order_number: 88,
    store_name: "Tienda Centro",
    commerce_name: "Café del Norte",
    payment_method: "tarjeta",
    payment_intent_id: "pi_123",
    currency: "NIO",
    delivery_class: "programado",
    eta_min_days: 2,
    eta_max_days: 4,
    lines: [
      { product: "Café molido", variant: "500 g", sku: "CAFE-500", quantity: 2, unit_price: 200, line_total: 400 },
    ],
  },
};

const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";

Deno.test("renderInvoicePdf genera un PDF válido de una página para una factura de venta", async () => {
  const bytes = await renderInvoicePdf(base);
  assert(isPdf(bytes));
  const loaded = await PDFDocument.load(bytes);
  assertEquals(loaded.getPageCount(), 1);
  assertEquals(loaded.getTitle(), "FACTURA DE VENTA RT-V-000123");
});

Deno.test("renderInvoicePdf cubre servicio, nota de crédito, cliente anonimizado y recibo de Stripe", async () => {
  const servicio: InvoiceDoc = { ...base, kind: "servicio", number: "RT-S-000123", total: 30, data: { ...base.data, lines: [{ product: "Servicio de entrega programada", quantity: 1, unit_price: 30, line_total: 30 }] } };
  const nota: InvoiceDoc = { ...base, kind: "nota_credito_venta", number: "RT-NCV-000045", credit_for_number: "RT-V-000123", reason: "Devolución aprobada", buyer_anonymized: true, buyer_name: null, buyer_email: null };
  for (const doc of [servicio, nota]) assert(isPdf(await renderInvoicePdf(doc, { receiptUrl: "https://pay.stripe.com/receipts/payment/CAcaFwoVYWNjdF8xx" })));
});

Deno.test("renderInvoicePdf no falla con caracteres fuera de Latin-1 ni con textos larguísimos", async () => {
  const doc: InvoiceDoc = {
    ...base,
    buyer_name: "李雷 😀 Ñandú",
    data: { ...base.data, lines: [{ product: "X".repeat(400), variant: "紅茶", quantity: 1, unit_price: 1.5, line_total: 1.5 }] },
  };
  assert(isPdf(await renderInvoicePdf(doc)));
});

Deno.test("renderInvoicePdf pasa a otra página con muchas líneas y numera el pie", async () => {
  const lines = Array.from({ length: 60 }, (_, i) => ({ product: `Producto ${i + 1}`, variant: "Única", quantity: 1, unit_price: 10, line_total: 10 }));
  const bytes = await renderInvoicePdf({ ...base, total: 600, data: { ...base.data, lines } });
  const loaded = await PDFDocument.load(bytes);
  assert(loaded.getPageCount() >= 2);
});

Deno.test("pdfSafe deja acentos y ñ, y cambia lo que la fuente no puede escribir", () => {
  assertEquals(pdfSafe("Café Ñandú — ok…"), "Café Ñandú - ok...");
  assertEquals(pdfSafe("a\tb\nc"), "a b c");
  assertEquals(pdfSafe("李"), "?");
  assertEquals(pdfSafe(null), "");
});

Deno.test("money formatea córdobas, dólares y otras monedas", () => {
  assertEquals(money(1234.5, "nio"), "C$ 1,234.50");
  assertEquals(money("30", null), "C$ 30.00");
  assertEquals(money(9, "usd"), "US$ 9.00");
  assertEquals(money(9, "eur"), "EUR 9.00");
});

Deno.test("etiquetas del documento y del estado de pago", () => {
  assertEquals(documentTitle("nota_credito_servicio"), "NOTA DE CRÉDITO - SERVICIO");
  assertEquals(paymentStatusLabel("pendiente", "efectivo"), "Pendiente de cobro en la entrega");
  assertEquals(paymentStatusLabel("reembolsado", "tarjeta"), "Reembolsado");
});

Deno.test("wrap parte por palabras y corta una palabra más larga que la línea", async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const lines = wrap("uno dos tres cuatro cinco seis siete ocho", font, 10, 60);
  assert(lines.length > 1);
  assert(lines.every((l) => font.widthOfTextAtSize(l, 10) <= 60));
  const long = wrap("W".repeat(80), font, 10, 60);
  assert(long.length > 1);
  assert(long.every((l) => font.widthOfTextAtSize(l, 10) <= 60));
  assertEquals(wrap("", font, 10, 60), [""]);
});
