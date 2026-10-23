import { Alert } from "@rapitrip/ui";
import { DirectoryTable } from "@/components/directory-table";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { loadDirectory } from "./load-directory";

export const metadata = { title: "Comercios" };

export default async function ComerciosPage() {
  await requireConsoleAccess("admin");
  const { rows, failed } = await loadDirectory("empresa");
  return (
    <>
      <PageHeader title="Comercios" description="Empresas con RUC afiliadas a Rapitrip y sus tiendas activas. Los vendedores propios están en Vendedores." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar los comercios. Recarga la página.</Alert> : null}
      <DirectoryTable rows={rows} kind="empresa" noun={{ one: "comercio", many: "comercios" }} detailBase="/admin/comercios" />
    </>
  );
}
