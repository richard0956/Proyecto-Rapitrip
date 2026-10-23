import { Alert } from "@rapitrip/ui";
import { DirectoryTable } from "@/components/directory-table";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { loadDirectory } from "../comercios/load-directory";

export const metadata = { title: "Vendedores" };

export default async function VendedoresPage() {
  await requireConsoleAccess("admin");
  const { rows, failed } = await loadDirectory("informal");
  return (
    <>
      <PageHeader title="Vendedores" description="Vendedores propios (sin RUC) afiliados a Rapitrip y sus tiendas activas. Las empresas están en Comercios." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar los vendedores. Recarga la página.</Alert> : null}
      <DirectoryTable rows={rows} kind="informal" noun={{ one: "vendedor", many: "vendedores" }} detailBase="/admin/vendedores" />
    </>
  );
}
