import { Alert, Card, CardHeader, DataTable } from "@rapitrip/ui";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { confirmAnonymization, getClientDetail, requestExport } from "./actions";
import { CandidateActions, ExportForm } from "./controls";

const candidatesSchema = z.array(z.object({ user_id: z.string().uuid(), candidate_since: z.string().nullable(), last_sign_in_at: z.string().nullable() }));

export default async function DatosPersonalesPage() {
  const session = await requireConsoleAccess("admin");
  if (session.role !== "superadmin") redirect("/admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.rpc("list_anonymization_candidates");
  const parsed = candidatesSchema.safeParse(data ?? []);
  if (error || !parsed.success) console.error("[datos-personales]", error?.message ?? "formato inesperado");
  const rows = parsed.success ? parsed.data : [];

  return (
    <>
      <PageHeader title="Datos personales" description="Anonimización de cuentas inactivas y exportaciones. Cada consulta y cada cambio quedan auditados." />
      {error || !parsed.success ? <Alert tone="error" className="mb-5">No pudimos cargar los candidatos. Recarga la página.</Alert> : null}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title="Cuentas candidatas a anonimizar" subtitle="Clientes sin actividad durante el plazo definido" />
          <DataTable
            caption="Cuentas candidatas a anonimizar"
            rows={rows}
            rowKey={(row) => row.user_id}
            emptyTitle="No hay cuentas candidatas"
            emptyHint="Aparecen aquí las cuentas de clientes inactivas que cumplen el plazo."
            columns={[
              { header: "Candidata desde", cell: (row) => formatDate(row.candidate_since) },
              { header: "Último ingreso", cell: (row) => formatDate(row.last_sign_in_at) },
              { header: "Acciones", cell: (row) => <CandidateActions userId={row.user_id} detail={getClientDetail} anonymize={confirmAnonymization} /> },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Exportar datos" subtitle="El archivo se cifra y solo tú ves la frase para abrirlo" />
          <ExportForm request={requestExport} />
        </Card>
      </div>
    </>
  );
}
