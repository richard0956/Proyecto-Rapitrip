import { Alert } from "@rapitrip/ui";
import { PageHeader } from "@/components/shell";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { tabKeys } from "./dispatch-tabs";
import { DispatchWorkspace } from "./dispatch-workspace";
import { loadDispatch } from "./load-dispatch";

export const metadata = { title: "Pedidos" };

/** Pedidos web por etapa, a todo el ancho; cada pedido abre su ficha de despacho en /coordinacion/pedidos/[número]. */
export default async function CoordinacionPage({ searchParams }: { searchParams: Promise<{ vista?: string }> }) {
  const { vista } = await searchParams;
  await requireConsoleAccess("coordinacion");
  const { rows, couriers, failed } = await loadDispatch(await serverSupabase());

  return (
    <>
      <PageHeader title="Pedidos" description="Propón cada pedido a un repartidor, sigue su entrega y atiende sus avisos. La lista se actualiza sola." />
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <DispatchWorkspace rows={rows} couriers={couriers} initialTab={tabKeys.find((key) => key === vista) ?? "listos"} />
    </>
  );
}
