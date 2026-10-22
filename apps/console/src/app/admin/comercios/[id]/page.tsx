import { Alert, Badge, Card, CardHeader, DataTable, buttonStyles } from "@rapitrip/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/shell";
import { formatDate } from "@/lib/format";
import { requireConsoleAccess } from "@/lib/guard";
import { formatStoreDateTime, storeState } from "@/lib/stores";
import { serverSupabase } from "@/lib/supabase";
import { setCommerceStatus } from "../actions";
import { StatusControl } from "./status-control";

export default async function ComercioDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [commerce, stores, products, accounts] = await Promise.all([
    supabase.from("commerces_list").select("id, name, status, created_at, kind, ruc").eq("id", id).maybeSingle(),
    supabase.from("stores_list").select("id, name, address, status, closed_until, open_now").eq("commerce_id", id).order("name"),
    supabase.from("products_list").select("id, store_id, status").eq("commerce_id", id),
    supabase.from("accounts_staff").select("full_name, email, role_status").eq("role", "comercio").eq("commerce_id", id),
  ]);
  if (!commerce.data || !commerce.data.id || !commerce.data.name) notFound();
  const failed = stores.error || products.error || accounts.error;
  if (failed) console.error("[comercio:detalle]", stores.error?.message, products.error?.message, accounts.error?.message);

  const suspended = commerce.data.status === "suspendido";
  const counts = new Map<string, { published: number; draft: number }>();
  for (const row of products.data ?? []) {
    if (!row.store_id || row.status === "archivado") continue;
    const entry = counts.get(row.store_id) ?? { published: 0, draft: 0 };
    if (row.status === "publicado") entry.published += 1;
    else entry.draft += 1;
    counts.set(row.store_id, entry);
  }
  const owner = accounts.data?.[0];

  return (
    <>
      <PageHeader
        title={commerce.data.name}
        description={`Afiliado desde ${formatDate(commerce.data.created_at)} · ${commerce.data.kind === "empresa" ? `Empresa, RUC ${commerce.data.ruc}` : "Vendedor propio"}.`}
        actions={
          <Link href="/admin/comercios" className={buttonStyles({ variant: "ghost" })}>
            <ArrowLeft className="size-4" aria-hidden="true" />
            Comercios
          </Link>
        }
      />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todos los datos del comercio. Recarga la página.</Alert> : null}
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="p-5">
          <CardHeader title="Tiendas" subtitle="Solo lectura: las gestiona el comercio desde su consola." />
          <DataTable
            caption="Tiendas del comercio"
            rows={stores.data ?? []}
            rowKey={(row) => row.id ?? ""}
            emptyTitle="Sin tiendas"
            emptyHint="El comercio todavía no ha creado ninguna."
            columns={[
              {
                header: "Tienda",
                cell: (row) => (
                  <span className="block">
                    <span className="block font-bold">{row.name}</span>
                    <span className="block text-xs text-tinta-suave">{row.address ?? "Sin dirección"}</span>
                  </span>
                ),
              },
              {
                header: "Estado",
                cell: (row) => {
                  const state = storeState(row);
                  return (
                    <span className="block">
                      <Badge tone={state.tone}>{state.label}</Badge>
                      {row.closed_until && new Date(row.closed_until) > new Date() ? <span className="mt-1 block text-xs text-tinta-suave">hasta {formatStoreDateTime(row.closed_until)}</span> : null}
                    </span>
                  );
                },
              },
              { header: "Productos", cell: (row) => <span className="tabular-nums">{counts.get(row.id ?? "")?.published ?? 0} publicados · {counts.get(row.id ?? "")?.draft ?? 0} en borrador</span> },
            ]}
          />
        </Card>
        <div className="flex flex-col gap-5">
          <Card className="p-5">
            <CardHeader title="Estado del comercio" actions={<Badge tone={suspended ? "danger" : "positive"}>{suspended ? "Suspendido" : "Activo"}</Badge>} />
            <p className="mb-3 text-[12.5px] text-tinta-suave">
              {suspended ? "Mientras esté suspendido, su cuenta no puede entrar y sus tiendas figuran cerradas. Nada se borra." : "Suspender un comercio bloquea el acceso de su cuenta y cierra sus tiendas. Se puede revertir."}
            </p>
            <StatusControl id={commerce.data.id} name={commerce.data.name} suspended={suspended} setStatus={setCommerceStatus} />
          </Card>
          <Card className="p-5">
            <CardHeader title="Cuenta del comercio" />
            {owner ? (
              <p className="text-sm text-tinta">
                <span className="block font-bold">{owner.full_name ?? "Sin nombre"}</span>
                <span className="block text-xs text-tinta-suave">{owner.email}</span>
                <span className="mt-1.5 block"><Badge tone={owner.role_status === "activo" ? "positive" : "warning"}>{owner.role_status === "activo" ? "Activa" : "Suspendida"}</Badge></span>
              </p>
            ) : (
              <p className="text-[13px] text-tinta-suave">Sin cuenta activa asociada.</p>
            )}
            <Link href="/admin/usuarios" className="mt-3 inline-block text-[13px] font-bold text-hoja underline underline-offset-2">
              Gestionar en Usuarios y roles
            </Link>
          </Card>
        </div>
      </div>
    </>
  );
}
