import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { SettlementsWorkspace, type CommerceSettlement } from "./settlements-workspace";

const commerce: CommerceSettlement = { commerceId: "11111111-1111-1111-1111-111111111111", name: "Farmacia", pendingOrders: 3, pendingAmount: 540, pendingReversals: 180, commissionPct: 10, periodDays: 7, bearer: "comercio", lastSettledAt: null, dueIso: new Date(Date.now() + 86_400_000 * 3).toISOString() };
const summary = { month: "2026-11", charged: 0, chargedOrders: 0, settled: 0, commission: 0, reversed: 0, netPaid: 0, overdueUnsettled: 0, pendingReversals: 0, mismatched: 0, lastReconciledAt: null };
const props = { initialTab: "pendientes" as const, history: [], summary, reconciliations: [], months: [{ value: "2026-11", label: "noviembre de 2026" }] };

describe("liquidaciones", () => {
  it("muestra el neto a pagar (monto menos reversiones) y registra la liquidación con su referencia", async () => {
    const user = userEvent.setup();
    const recordSettlement = vi.fn(async () => ({ ok: true as const, message: "Liquidación N.° 1 registrada." }));
    render(<SettlementsWorkspace {...props} commerces={[commerce]} actions={{ saveAgreement: vi.fn(), recordSettlement, recordReconciliation: vi.fn() }} />);
    expect(screen.getByText(/10 % de comisión · cada 7 días/)).toBeInTheDocument();
    expect(screen.getByText("Neto a pagar").nextSibling).toHaveTextContent("360");
    await user.type(screen.getByLabelText("Referencia del pago (opcional)"), "Transferencia 001");
    await user.click(screen.getByRole("button", { name: /Registrar liquidación/ }));
    expect(recordSettlement).toHaveBeenCalledWith({ commerceId: commerce.commerceId, reference: "Transferencia 001" });
    expect(await screen.findByText("Liquidación N.° 1 registrada.")).toBeInTheDocument();
  });

  it("el convenio no deja liquidar cada más de 15 días: lo manda la base de datos y se muestra el error", async () => {
    const user = userEvent.setup();
    const saveAgreement = vi.fn(async () => ({ ok: false as const, error: "La liquidación no puede pasar de 15 días (Norma 9.1.3)." }));
    render(<SettlementsWorkspace {...props} commerces={[commerce]} actions={{ saveAgreement, recordSettlement: vi.fn(), recordReconciliation: vi.fn() }} />);
    await user.click(screen.getByRole("button", { name: "Editar convenio" }));
    const days = screen.getByLabelText("Cada cuántos días (máx. 15)");
    await user.clear(days);
    await user.type(days, "30");
    await user.click(screen.getByRole("button", { name: "Guardar convenio" }));
    expect(saveAgreement).toHaveBeenCalledWith(expect.objectContaining({ periodDays: 30 }));
    expect(await screen.findByText(/Norma 9.1.3/)).toBeInTheDocument();
  });

  it("la conciliación sin diferencias lo dice y pide registrarla", async () => {
    const user = userEvent.setup();
    const recordReconciliation = vi.fn(async () => ({ ok: true as const, message: "Conciliación registrada." }));
    render(<SettlementsWorkspace {...props} initialTab="conciliacion" commerces={[]} actions={{ saveAgreement: vi.fn(), recordSettlement: vi.fn(), recordReconciliation }} />);
    expect(screen.getByText(/No hay diferencias/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Diferencias encontradas"), "Ninguna");
    await user.click(screen.getByRole("button", { name: /Registrar conciliación/ }));
    expect(recordReconciliation).toHaveBeenCalledWith({ month: "2026-11", differences: "Ninguna" });
  });
});
