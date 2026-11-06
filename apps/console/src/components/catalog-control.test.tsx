import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { CatalogControl, type CatalogReport } from "./catalog-control";
import { CatalogNotices } from "./catalog-notices";

const report: CatalogReport = {
  id: "r1", commerce: "Farmacia", store: "Centro", product: "Café", source: "cliente", kind: "precio", description: "Cuesta 120, no 150",
  status: "recibido", createdAt: "hoy", createdIso: new Date().toISOString(), reviewNote: null, fixDueIso: null, correctionNote: null,
};
const base = { stale: [], history: [], reviewStatus: { lastAt: null, dueAt: "hoy", overdue: true } };

describe("control de catálogos", () => {
  it("coordinación confirma un reporte con lo que encontró", async () => {
    const user = userEvent.setup();
    const review = vi.fn(async () => ({ ok: true as const }));
    render(<CatalogControl {...base} reports={[report]} recurrences={null} actions={{ review, recordReview: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /Reincidencias/ })).not.toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: "Confirmar y avisar al comercio" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("¿Qué encontraste?"), "El precio no coincide");
    await user.click(confirm);
    expect(review).toHaveBeenCalledWith({ id: "r1", confirmed: true, note: "El precio no coincide" });
  });

  it("la administración ve las reincidencias con su plazo", async () => {
    const user = userEvent.setup();
    render(<CatalogControl {...base} reports={[]} recurrences={[{ commerceId: "c1", commerce: "Farmacia", confirmed: 2, flaggedIso: new Date().toISOString(), lastMeasure: null }]} actions={{ review: vi.fn(), recordReview: vi.fn(), recordMeasure: vi.fn() }} />);
    await user.click(screen.getByRole("button", { name: /Reincidencias/ }));
    expect(screen.getByText(/2 inconsistencias confirmadas en 90 días/)).toBeInTheDocument();
  });

  it("el comercio marca como corregida una inconsistencia confirmada", async () => {
    const user = userEvent.setup();
    const markFixed = vi.fn(async () => ({ ok: true as const }));
    render(<CatalogNotices notices={[{ id: "n1", kind: "inconsistencia", message: "Confirmamos una inconsistencia", createdAt: "hoy", reportId: "r1", reportStatus: "confirmado", fixDueIso: new Date(Date.now() + 3_600_000).toISOString() }]} markFixed={markFixed} />);
    expect(screen.getByText("1 por corregir")).toBeInTheDocument();
    await user.type(screen.getByLabelText("¿Qué corregiste?"), "Actualicé el precio");
    await user.click(screen.getByRole("button", { name: "Ya lo corregí" }));
    expect(markFixed).toHaveBeenCalledWith({ id: "r1", note: "Actualicé el precio" });
  });
});
