import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { formatDateTime } from "@/lib/format";
import { serverSupabase } from "@/lib/supabase";
import { ReturnsPanel, type ReturnRow } from "./returns-panel";

export const metadata = { title: "Devoluciones" };

export default async function DevolucionesPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("return_requests_for_admin");
  if (error) console.error("[admin:devoluciones]", error.message);

  const allPaths = (data ?? []).flatMap((row) => row.photos ?? []);
  const signed = allPaths.length ? await supabase.storage.from("devoluciones").createSignedUrls(allPaths, 600) : { data: [], error: null };
  if (signed.error) console.error("[admin:devoluciones:fotos]", signed.error.message);
  const urlByPath = new Map((signed.data ?? []).flatMap((item) => (item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : [])));

  const rows: ReturnRow[] = (data ?? []).flatMap((row) =>
    row.request_id && row.order_number !== null
      ? [
          {
            id: row.request_id,
            orderNumber: Number(row.order_number),
            store: row.store_name ?? "",
            total: Number(row.total ?? 0),
            method: row.payment_method === "tarjeta" ? "tarjeta" : "efectivo",
            status: row.status as ReturnRow["status"],
            reason: row.reason ?? "",
            photos: (row.photos ?? []).map((path) => ({ label: path.split("/").pop() ?? path, url: urlByPath.get(path) ?? null })),
            decisionNote: row.decision_note,
            requestedAt: formatDateTime(row.requested_at),
            decidedAt: row.decided_at ? formatDateTime(row.decided_at) : null,
          },
        ]
      : [],
  );

  return (
    <>
      <PageHeader title="Devoluciones" description="Aprueba o rechaza las devoluciones con sus fotos. Solo administración decide." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar las devoluciones. Recarga la página.</Alert> : null}
      <ReturnsPanel rows={rows} />
    </>
  );
}
