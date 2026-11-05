import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { defaultEvidenceSettings, type EvidenceSettings } from "@/lib/evidence-settings";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { addInstitutionalDomain, removeInstitutionalDomain, saveEvidenceSettings } from "./actions";
import { DomainsCard } from "./domains-card";
import { EvidenceSettingsForm } from "./evidence-settings-form";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const session = await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [{ data, error }, domains] = await Promise.all([supabase.from("evidence_settings_list").select("*").maybeSingle(), supabase.rpc("list_institutional_domains")]);
  if (error) console.error("[configuracion]", error.message);
  if (domains.error) console.error("[configuracion:dominios]", domains.error.message);
  const initial: EvidenceSettings = data
    ? {
        pickupPhoto: data.require_pickup_photo ?? true,
        deliveryPhoto: data.require_delivery_photo ?? true,
        pickupCode: data.require_pickup_code ?? true,
        deliveryCode: data.require_delivery_code ?? true,
        alertDistanceM: Number(data.alert_distance_m ?? defaultEvidenceSettings.alertDistanceM),
        retentionDays: Number(data.retention_days ?? defaultEvidenceSettings.retentionDays),
      }
    : defaultEvidenceSettings;

  return (
    <>
      <PageHeader title="Configuración" description="Reglas de la operación: la evidencia que se exige al repartidor en cada entrega y los correos con los que se invita al equipo." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar las reglas actuales. Se muestran los valores acordados: no guardes hasta recargar.</Alert> : null}
      <div className="flex flex-col gap-5">
        <EvidenceSettingsForm initial={initial} save={saveEvidenceSettings} />
        <DomainsCard domains={(domains.data ?? []).map((row) => row.domain)} canEdit={session.role === "superadmin"} add={addInstitutionalDomain} remove={removeInstitutionalDomain} />
      </div>
    </>
  );
}
