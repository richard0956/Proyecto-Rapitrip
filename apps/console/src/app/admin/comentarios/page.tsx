import { Alert, Badge, DataTable } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { formatDateTime } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";

const topicLabel: Record<string, string> = { compra: "Compra", entrega: "Entrega", app: "La app", otro: "Otro" };

export default async function ComentariosPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("list_feedback", { p_limit: 200 });
  if (error) console.error("[comentarios]", error.message);
  const rows = data ?? [];

  return (
    <>
      <PageHeader title="Comentarios" description="Lo que los clientes escriben desde Ajustes → Ayuda." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar los comentarios. Recarga la página.</Alert> : null}
      <DataTable
        caption="Comentarios de clientes"
        rows={rows}
        rowKey={(row) => row.id}
        emptyTitle="Aún no hay comentarios"
        columns={[
          { header: "Fecha", cell: (row) => <span className="whitespace-nowrap tabular-nums">{formatDateTime(row.created_at)}</span> },
          { header: "Cliente", cell: (row) => row.full_name || "—" },
          { header: "Tema", cell: (row) => <Badge tone="neutral">{topicLabel[row.topic] ?? row.topic}</Badge> },
          { header: "Calificación", cell: (row) => <span className="whitespace-nowrap tabular-nums" aria-label={`${row.rating} de 5`}>{"★".repeat(row.rating)}{"☆".repeat(5 - row.rating)}</span> },
          { header: "Comentario", cell: (row) => <span className="block max-w-md whitespace-pre-line">{row.message}</span> },
        ]}
      />
    </>
  );
}
