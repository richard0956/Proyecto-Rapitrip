import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { AccessReview } from "./access-review";

const base = { dueAt: "5 feb 2027", counts: [{ role: "Cajero", active: 2, suspended: 1 }], history: [] };

describe("revisión trimestral de accesos", () => {
  it("avisa cuando nunca se ha revisado y muestra las cuentas por rol", () => {
    render(<AccessReview {...base} lastAt={null} overdue record={vi.fn()} />);
    expect(screen.getByText("Nunca se ha revisado")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Cajero" })).toBeInTheDocument();
  });

  it("registra lo revisado y los cambios", async () => {
    const user = userEvent.setup();
    const record = vi.fn(async () => ({ ok: true as const }));
    render(<AccessReview {...base} lastAt="5 nov 2026, 10:00" overdue={false} record={record} />);
    expect(screen.getByText("Próxima: 5 feb 2027")).toBeInTheDocument();
    const send = screen.getByRole("button", { name: /Registrar revisión/ });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("¿Qué revisaste y qué encontraste?"), "Revisé todas las cuentas del equipo");
    await user.type(screen.getByLabelText("Cambios que hiciste (opcional)"), "Revoqué un cajero");
    await user.click(send);
    expect(record).toHaveBeenCalledWith({ findings: "Revisé todas las cuentas del equipo", changes: "Revoqué un cajero" });
    expect(await screen.findByText(/La próxima toca en tres meses/)).toBeInTheDocument();
  });
});
