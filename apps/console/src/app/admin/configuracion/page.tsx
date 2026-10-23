import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { defaultEvidenceSettings, type EvidenceSettings } from "@/lib/evidence-settings";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { saveEvidenceSettings } from "./actions";
import { EvidenceSettingsForm } from "./evidence-settings-form";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("evidence_settings_list").select("*").maybeSingle();
  if (error) console.error("[configuracion]", error.message);
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
      <PageHeader title="Configuración" description="Reglas de la operación. Hoy: la evidencia que se exige al repartidor en cada entrega." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar las reglas actuales. Se muestran los valores acordados: no guardes hasta recargar.</Alert> : null}
      <EvidenceSettingsForm initial={initial} save={saveEvidenceSettings} />
    </>
  );
}
