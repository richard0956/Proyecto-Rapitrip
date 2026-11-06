import { Alert } from "@rapitrip/ui";
import { CashSettingsCard, RegistersCard } from "@/components/cash-admin";
import { AccountabilityCard, CashKpis, CustodyCard, HandoffHistoryCard } from "@/components/cash-control";
import { PageHeader } from "@/components/shell";
import { decideAccountability, saveCashSettings, saveRegister } from "@/lib/cash-control-actions";
import { requireConsoleAccess } from "@/lib/guard";
import { loadCashAdmin, loadCashControl } from "@/lib/load-cash-control";
import { serverSupabase } from "@/lib/supabase";

export const metadata = { title: "Control de efectivo" };

/**
 * Efectivo con responsable en todo momento: a cargo de qué repartidor está, cada entrega a una caja física, las faltas a
 * nombre de cada persona y la medida que decide la administración. También las cajas físicas y los límites.
 */
export default async function ControlEfectivoPage() {
  await requireConsoleAccess("admin");
  const supabase = await serverSupabase();
  const [control, admin] = await Promise.all([loadCashControl(supabase), loadCashAdmin(supabase)]);

  return (
    <>
      <PageHeader title="Control de efectivo" description="Quién tiene el efectivo, cada entrega a caja y las faltas por decidir." />
      {control.failed || admin.failed ? <Alert tone="error" className="mb-5">No pudimos cargar todo. Recarga la página.</Alert> : null}
      <div className="flex flex-col gap-5">
        <CashKpis custody={control.custody} open={control.open} />
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <AccountabilityCard open={control.open} resolved={control.resolved} decide={decideAccountability} />
          <CustodyCard rows={control.custody} points={control.points} />
        </div>
        <HandoffHistoryCard rows={control.handoffs} />
        <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
          <RegistersCard registers={admin.registers} cashiers={admin.cashiers} save={saveRegister} />
          <CashSettingsCard settings={admin.settings} save={saveCashSettings} />
        </div>
      </div>
    </>
  );
}
