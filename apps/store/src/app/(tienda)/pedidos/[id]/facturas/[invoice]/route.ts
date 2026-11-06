import { getSessionInfo } from "@rapitrip/supabase";
import { NextResponse } from "next/server";
import { isUuid } from "@/lib/catalog";
import { serverSupabase } from "@/lib/supabase";

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/**
 * PDF de una factura o nota de crédito del pedido. La función de borde `invoice-pdf` usa la sesión del cliente: la base decide si
 * el documento es suyo. Antes se comprueba que pertenezca a este pedido, para que la dirección no admita otros números.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; invoice: string }> }) {
  const { id, invoice } = await params;
  if (!isUuid(id) || !isUuid(invoice)) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const supabase = await serverSupabase();
  const session = await getSessionInfo(supabase);
  if (!session.signedIn) return NextResponse.redirect(new URL(`/ingresar?next=${encodeURIComponent(`/pedidos/${id}`)}`, siteUrl()));

  const { data: rows, error: listError } = await supabase.rpc("order_invoices", { p_order: id });
  if (listError) return NextResponse.json({ error: "Tu sesión venció. Ingresa de nuevo para descargar tus facturas." }, { status: 401 });
  if (!rows?.some((row) => row.id === invoice)) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });

  const { data, error } = await supabase.functions.invoke("invoice-pdf", { body: { invoice_id: invoice } });
  if (error || !(data instanceof Blob)) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    return NextResponse.json({ error: "No pudimos generar el PDF. Inténtalo de nuevo en unos minutos." }, { status: status === 403 || status === 404 ? status : 502 });
  }

  const number = rows.find((row) => row.id === invoice)?.number ?? "factura";
  return new NextResponse(data, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${number}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
