import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { approveRequest, rejectRequest } from "./actions";
import { RequestsWorkspace, type RequestRow } from "./requests-workspace";

export default async function SolicitudesPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("commerce_requests_list").select("*").order("created_at", { ascending: false });
  if (error) console.error("[solicitudes]", error.message);

  const now = Date.now();
  const rows: RequestRow[] = (data ?? []).flatMap((row) =>
    row.id && row.status
      ? [{ id: row.id, name: row.business_name ?? "Sin nombre", status: row.status, receivedAgo: timeAgo(row.created_at, now), receivedAt: formatDateTime(row.created_at), decisionReason: row.decision_reason, reviewedAt: row.reviewed_at ? formatDateTime(row.reviewed_at) : null }]
      : [],
  );

  return (
    <>
      <PageHeader title="Solicitudes de comercio" description="Revisa los datos y documentos antes de afiliar un comercio." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar las solicitudes. Recarga la página.</Alert> : null}
      <RequestsWorkspace rows={rows} approve={approveRequest} reject={rejectRequest} />
    </>
  );
}
