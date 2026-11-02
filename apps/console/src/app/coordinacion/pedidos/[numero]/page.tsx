import { Alert } from "@rapitrip/ui";
import { notFound } from "next/navigation";
import { requireConsoleAccess } from "@/lib/guard";
import { serverSupabase } from "@/lib/supabase";
import { assignCourier, cancelOffer, offerableCouriers, offerOrder, orderRoute, orderTrace, reclassifyOrder, resetCode, resolveIssue, setOrderStatus } from "../../actions";
import { loadDispatch } from "../../load-dispatch";
import { DispatchDetail } from "./dispatch-detail";

export const metadata = { title: "Pedido" };

/** Ficha de despacho de un pedido web para coordinación. */
export default async function PedidoCoordinacionPage({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = await params;
  if (!/^\d{1,9}$/.test(numero)) notFound();
  await requireConsoleAccess("coordinacion");
  const { rows, couriers, failed } = await loadDispatch(await serverSupabase(), Number(numero));
  const row = rows[0];
  if (!row && !failed) notFound();

  return (
    <>
      {failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo el pedido. Recarga la página.</Alert> : null}
      {row ? (
        <DispatchDetail
          row={row}
          couriers={couriers}
          setStatus={setOrderStatus}
          assign={assignCourier}
          reclassify={reclassifyOrder}
          loadRoute={orderRoute}
          courierApp={{ loadOfferable: offerableCouriers, offer: offerOrder, cancelOffer, resolveIssue, resetCode, loadTrace: orderTrace }}
        />
      ) : null}
    </>
  );
}
