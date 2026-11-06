import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/http.ts";
import { type InvoiceDoc, renderInvoicePdf } from "../_shared/invoice_pdf.ts";
import { stripeRequest } from "../_shared/stripe.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Enlace al recibo de Stripe del pago. Es solo un complemento: si Stripe no responde, el PDF sale igual sin él. */
async function stripeReceiptUrl(paymentIntent: string): Promise<string | null> {
  if (!Deno.env.get("STRIPE_SECRET_KEY") || !/^pi_[A-Za-z0-9_]+$/.test(paymentIntent)) return null;
  try {
    const intent = await stripeRequest<{ latest_charge?: { receipt_url?: string } | string | null }>(
      "GET", `/v1/payment_intents/${paymentIntent}?expand[]=latest_charge`);
    const charge = intent.latest_charge;
    return typeof charge === "object" && charge?.receipt_url ? charge.receipt_url : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "método no permitido" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization) return json({ error: "no autenticado" }, 401);
  const body = await req.json().catch(() => null);
  if (typeof body?.invoice_id !== "string" || !UUID.test(body.invoice_id)) return json({ error: "invoice_id es obligatorio" }, 400);

  // La RPC decide quién puede ver el documento (cliente dueño, comercio solo la de venta, administración) y qué datos recibe.
  const asCaller = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data, error } = await asCaller.rpc("get_invoice", { p_invoice: body.invoice_id });
  if (error) {
    const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 400;
    return json({ error: error.message }, status);
  }
  const doc = data as InvoiceDoc;

  // El comercio no recibe la referencia de pago, así que para él nunca hay recibo.
  const isOriginal = doc.kind === "venta" || doc.kind === "servicio";
  const receiptUrl = isOriginal && doc.data.payment_method === "tarjeta" && doc.data.payment_intent_id
    ? await stripeReceiptUrl(doc.data.payment_intent_id)
    : null;

  const pdf = await renderInvoicePdf(doc, { receiptUrl });
  return new Response(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${doc.number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
