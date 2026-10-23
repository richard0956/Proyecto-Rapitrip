import { requireConsoleAccess } from "@/lib/guard";
import { realDay } from "@/lib/filters";
import { orderStatuses, orderStatusLabel, paymentLabel } from "@/lib/orders";
import { toCsv } from "@/lib/report-csv";
import { formatStoreDateTime } from "@/lib/stores";
import { parsePeriod } from "@/lib/dashboard";
import { serverSupabase } from "@/lib/supabase";

const DAY_MS = 86_400_000;

/** Informe de ventas del día para coordinación: una fila por pedido. `?dia=AAAA-MM-DD` (por defecto, hoy en Nicaragua). */
export async function GET(request: Request) {
  await requireConsoleAccess("coordinacion");
  const requested = realDay(new URL(request.url).searchParams.get("dia") ?? undefined);
  const today = parsePeriod("hoy");
  // Medianoche local de Nicaragua (UTC−6) del día pedido, como instante UTC.
  const fromMs = requested ? new Date(`${requested}T06:00:00.000Z`).getTime() : new Date(today.from).getTime();
  const day = requested ?? new Date(fromMs - 6 * 3_600_000).toISOString().slice(0, 10);

  const supabase = await serverSupabase();
  const { data, error } = await supabase
    .from("orders_list")
    .select("number, store_name, channel, payment_method, payment_status, subtotal, delivery_fee, total, status, created_at")
    .gte("created_at", new Date(fromMs).toISOString())
    .lt("created_at", new Date(fromMs + DAY_MS).toISOString())
    .order("created_at");
  if (error) {
    console.error("[coordinacion:informe]", error.message);
    return new Response("No pudimos generar el informe. Inténtalo de nuevo.", { status: 500 });
  }

  const csv = toCsv(
    (data ?? []).map((row) => ({
      number: row.number === null ? null : Number(row.number),
      store: row.store_name,
      channel: row.channel === "mostrador" ? "Mostrador" : "Web",
      payment: paymentLabel(row.payment_method, row.payment_status),
      subtotal: Number(row.subtotal ?? 0),
      delivery: Number(row.delivery_fee ?? 0),
      total: Number(row.total ?? 0),
      status: orderStatuses.find((status) => status === row.status) ? orderStatusLabel[row.status as keyof typeof orderStatusLabel] : row.status,
      created: formatStoreDateTime(row.created_at),
    })),
    [
      { key: "number", header: "Número" },
      { key: "store", header: "Tienda" },
      { key: "channel", header: "Canal" },
      { key: "payment", header: "Pago" },
      { key: "subtotal", header: "Subtotal" },
      { key: "delivery", header: "Envío" },
      { key: "total", header: "Total" },
      { key: "status", header: "Estado" },
      { key: "created", header: "Creado" },
    ],
  );
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="pedidos-${day}.csv"`, "cache-control": "no-store" },
  });
}
