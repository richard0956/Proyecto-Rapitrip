import { Alert, Card, CardHeader, EmptyState, KpiCard, buttonStyles, ButtonIsland } from "@rapitrip/ui";
import { Clock, PackageX, Store, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { storeState } from "@/lib/stores";

export default async function ComercioHome() {
  await requireConsoleAccess("comercio");
  const supabase = await serverSupabase();
  const [profile, stores, stock] = await Promise.all([
    supabase.from("my_profile").select("full_name").maybeSingle(),
    supabase.from("stores_list").select("id, name, status, closed_until, open_now, hour_ranges").order("name"),
    supabase.from("inventory_list").select("*", { count: "exact", head: true }).in("stock_state", ["agotado", "bajo"]).eq("variant_status", "activa"),
  ]);
  if (stores.error) console.error("[comercio:inicio]", stores.error.message);
  if (stock.error) console.error("[comercio:inicio:stock]", stock.error.message);
  const rows = stores.data ?? [];
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0];
  const open = rows.filter((row) => storeState(row).tone === "positive").length;
  const noHours = rows.filter((row) => row.status === "activa" && !row.hour_ranges);

  return (
    <>
      <PageHeader
        title={firstName ? `Hola, ${firstName}` : "Hola"}
        description="El estado de tus tiendas de un vistazo."
        actions={
          <Link href="/comercio/tiendas" className={buttonStyles({ variant: "primary", className: "pr-5" })}>
            Mis tiendas
            <ButtonIsland />
          </Link>
        }
      />
      {stores.error ? <Alert tone="error" className="mb-5">No pudimos cargar tus tiendas. Recarga la página.</Alert> : null}
      <ul className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li><KpiCard icon={<Store className="size-[18px]" />} label="Tiendas" value={rows.length} hint="Registradas en tu comercio" /></li>
        <li><KpiCard icon={<Clock className="size-[18px]" />} tone="lavanda" label="Abiertas ahora" value={open} hint="Según horario y cierres" /></li>
        <li>
          <Link href="/comercio/inventario" className="group block h-full rounded-tarjeta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
            <KpiCard icon={<PackageX className="size-[18px]" />} tone="durazno" label="Stock por reponer" value={stock.error ? "—" : (stock.count ?? 0)} hint="Variantes agotadas o con stock bajo" />
          </Link>
        </li>
        <li><KpiCard icon={<TriangleAlert className="size-[18px]" />} tone="durazno" label="Sin horario" value={noHours.length} hint="Nunca estarán abiertas hasta definirlo" /></li>
      </ul>
      <Card className="p-5">
        <CardHeader title="Tus tiendas" />
        {rows.length === 0 ? (
          <EmptyState title="Todavía no tienes tiendas">Crea la primera en «Mis tiendas» para definir su horario.</EmptyState>
        ) : (
          <ul className="flex flex-col divide-y divide-borde">
            {rows.map((row) => {
              const state = storeState(row);
              return (
                <li key={row.id}>
                  <Link href={`/comercio/tiendas/${row.id}`} className="flex items-center justify-between gap-3 rounded-campo py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja">
                    <span className="font-bold text-tinta">{row.name}</span>
                    <span className={state.tone === "positive" ? "text-xs font-bold text-exito" : "text-xs font-bold text-tinta-suave"}>{state.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
