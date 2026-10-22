import { Alert } from "@rapitrip/ui";
import { defaultExpressLimits } from "@rapitrip/validation";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { createMasterItem, renameMasterItem, setDeliveryLimits, setMasterItemProgramadoOnly, setMasterItemStatus } from "./actions";
import { DeliveryLimitsCard } from "./delivery-limits-card";
import { MasterCatalog, type MasterRow } from "./master-catalog";

export const metadata = { title: "Catálogo maestro" };

export default async function CatalogoMaestroPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [{ data, error }, limitsRow] = await Promise.all([
    supabase.from("master_items_list").select("id, kind, name, parent_id, status, programado_only").order("name"),
    supabase.from("delivery_class_settings_view").select("max_unit_kg, max_side_cm, max_sum_cm, max_order_kg").maybeSingle(),
  ]);
  if (error || limitsRow.error) console.error("[catalogo-maestro]", error?.message, limitsRow.error?.message);
  const limits =
    limitsRow.data?.max_unit_kg != null && limitsRow.data.max_side_cm != null && limitsRow.data.max_sum_cm != null && limitsRow.data.max_order_kg != null
      ? { max_unit_kg: Number(limitsRow.data.max_unit_kg), max_side_cm: Number(limitsRow.data.max_side_cm), max_sum_cm: Number(limitsRow.data.max_sum_cm), max_order_kg: Number(limitsRow.data.max_order_kg) }
      : defaultExpressLimits;

  const rows: MasterRow[] = (data ?? []).flatMap((row) =>
    row.id && row.name && (row.kind === "categoria" || row.kind === "marca" || row.kind === "tipo_producto" || row.kind === "atributo")
      ? [{ id: row.id, kind: row.kind, name: row.name, parentId: row.parent_id, status: row.status === "inactivo" ? ("inactivo" as const) : ("activo" as const), programadoOnly: row.programado_only === true }]
      : [],
  );

  return (
    <>
      <PageHeader title="Catálogo maestro" description="Categorías, marcas, tipos de producto y atributos que los comercios usan para clasificar. Es orientativo: no es obligatorio para publicar." />
      {error || limitsRow.error ? <Alert tone="error" className="mb-5">No pudimos cargar todo el catálogo. Recarga la página.</Alert> : null}
      <div className="flex flex-col gap-5">
        <DeliveryLimitsCard limits={limits} save={setDeliveryLimits} />
        <MasterCatalog rows={rows} create={createMasterItem} rename={renameMasterItem} setStatus={setMasterItemStatus} setProgramadoOnly={setMasterItemProgramadoOnly} />
      </div>
    </>
  );
}
