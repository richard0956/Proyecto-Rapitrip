import { Alert } from "@rapitrip/ui";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { formatDateTime, timeAgo } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { approveRequest, rejectRequest } from "./actions";
import { RequestsWorkspace, type RequestRow } from "./requests-workspace";

const detailsSchema = z.object({ contact_name: z.string().catch(""), phone: z.string().catch(""), address: z.string().catch(""), category: z.string().catch("") });

/** Los datos los escribe el solicitante: se leen con tolerancia, sin asumir que vengan completos. */
function readDetails(value: unknown) {
  const parsed = detailsSchema.safeParse(value && typeof value === "object" ? value : {});
  const d = parsed.success ? parsed.data : { contact_name: "", phone: "", address: "", category: "" };
  return { contactName: d.contact_name, phone: d.phone, address: d.address, category: d.category };
}

export default async function SolicitudesPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("commerce_requests_list").select("*").order("created_at", { ascending: false });
  if (error) console.error("[solicitudes]", error.message);

  const rows: RequestRow[] = (data ?? []).flatMap((row) =>
    row.id && row.status
      ? [{ id: row.id, name: row.business_name ?? "Sin nombre", status: row.status, receivedAgo: timeAgo(row.created_at), receivedAt: formatDateTime(row.created_at), decisionReason: row.decision_reason, reviewedAt: row.reviewed_at ? formatDateTime(row.reviewed_at) : null, details: readDetails(row.details) }]
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
