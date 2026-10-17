import { Alert, Card, DataTable } from "@rapitrip/ui";
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
      {error || !parsed.success ? <Alert tone="error" className="mb-6">No pudimos cargar los candidatos. Recarga la página.</Alert> : null}
      <section aria-labelledby="candidatos" className="mb-10">
        <h2 id="candidatos" className="mb-3 font-titulo text-xl text-selva">
          Cuentas candidatas a anonimizar
        </h2>
        <DataTable
          caption="Cuentas candidatas a anonimizar"
          rows={rows}
          rowKey={(row) => row.user_id}
          emptyTitle="No hay cuentas candidatas"
          emptyHint="Aparecen aquí las cuentas de clientes sin actividad durante el plazo definido."
          columns={[
            { header: "Candidata desde", cell: (row) => formatDate(row.candidate_since) },
            { header: "Último ingreso", cell: (row) => formatDate(row.last_sign_in_at) },
            { header: "Acciones", cell: (row) => <CandidateActions userId={row.user_id} detail={getClientDetail} anonymize={confirmAnonymization} /> },
          ]}
        />
      </section>
      <Card>
        <h2 className="mb-1 font-titulo text-xl text-selva">Exportar datos</h2>
        <p className="mb-4 text-sm text-tinta-suave">El archivo se cifra y solo tú ves la frase para abrirlo.</p>
        <ExportForm request={requestExport} />
      </Card>
    </>
  );
}
