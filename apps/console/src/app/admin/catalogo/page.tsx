import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { createMasterItem, renameMasterItem, setMasterItemStatus } from "./actions";
import { MasterCatalog, type MasterRow } from "./master-catalog";

export const metadata = { title: "Catálogo maestro" };

export default async function CatalogoMaestroPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const { data, error } = await supabase.from("master_items_list").select("id, kind, name, parent_id, status").order("name");
  if (error) console.error("[catalogo-maestro]", error.message);

  const rows: MasterRow[] = (data ?? []).flatMap((row) =>
    row.id && row.name && (row.kind === "categoria" || row.kind === "marca" || row.kind === "tipo_producto" || row.kind === "atributo")
      ? [{ id: row.id, kind: row.kind, name: row.name, parentId: row.parent_id, status: row.status === "inactivo" ? ("inactivo" as const) : ("activo" as const) }]
      : [],
  );

  return (
    <>
      <PageHeader title="Catálogo maestro" description="Categorías, marcas, tipos de producto y atributos que los comercios usan para clasificar. Es orientativo: no es obligatorio para publicar." />
      {error ? <Alert tone="error" className="mb-5">No pudimos cargar el catálogo. Recarga la página.</Alert> : null}
      <MasterCatalog rows={rows} create={createMasterItem} rename={renameMasterItem} setStatus={setMasterItemStatus} />
    </>
  );
}
