import { NextResponse } from "next/server";
import { requireAnyConsoleSession } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * PDF de una factura o nota de crédito para el personal de consola. La función de borde `invoice-pdf` usa la sesión de quien
 * pide y la base decide qué ve: administración todo; el comercio, solo la factura de venta de sus pedidos y sus notas.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ invoice: string }> }) {
  const { invoice } = await params;
  if (!UUID.test(invoice)) return NextResponse.json({ error: "Documento no encontrado." }, { status: 404 });
  await requireAnyConsoleSession();

  const supabase = await serverSupabase();
  // Primero la base: dice si el documento existe y es visible para esta cuenta, y da el número para nombrar el archivo.
  const doc = await supabase.rpc("get_invoice", { p_invoice: invoice });
  if (doc.error) {
    const status = doc.error.code === "42501" ? 403 : doc.error.code === "P0002" ? 404 : 502;
    return NextResponse.json({ error: status === 403 ? "No puedes ver este documento." : status === 404 ? "Documento no encontrado." : "No pudimos cargar el documento." }, { status });
  }
  const number = typeof (doc.data as { number?: unknown } | null)?.number === "string" ? (doc.data as { number: string }).number : `factura-${invoice.slice(0, 8)}`;

  const { data, error } = await supabase.functions.invoke("invoice-pdf", { body: { invoice_id: invoice } });
  if (error || !(data instanceof Blob)) {
    const status = (error as { context?: { status?: number } } | null)?.context?.status;
    if (status !== 403 && status !== 404) console.error("[facturas:pdf]", error?.message ?? "respuesta inesperada");
    return NextResponse.json(
      { error: status === 403 ? "No puedes ver este documento." : status === 404 ? "Documento no encontrado." : "No pudimos generar el PDF. Inténtalo de nuevo en unos minutos." },
      { status: status === 403 || status === 404 ? status : 502 },
    );
  }
  return new NextResponse(data, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${number}.pdf"`, "Cache-Control": "no-store" },
  });
}
