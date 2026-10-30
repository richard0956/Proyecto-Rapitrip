import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { expiredResult } from "@/lib/result";
import { DeletionCard } from "./deletion-card";

const actions = () => ({ request: vi.fn().mockResolvedValue({ ok: true, message: "Recibimos tu solicitud." }), cancel: vi.fn().mockResolvedValue({ ok: true, message: "Solicitud cancelada." }) });

beforeEach(() => vi.clearAllMocks());

describe("DeletionCard", () => {
  it("exige confirmar con la casilla antes de solicitar", async () => {
    const a = actions();
    render(<DeletionCard last={null} actions={a} />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Solicitar eliminación" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.type(screen.getByLabelText("Motivo (opcional)"), " Ya no compro ");
    await user.click(button);
    expect(await screen.findByRole("status")).toHaveTextContent("Recibimos tu solicitud.");
    expect(a.request).toHaveBeenCalledWith({ reason: "Ya no compro", confirmed: true });
    expect(refresh).toHaveBeenCalled();
  });

  it("con una solicitud pendiente muestra el estado y permite cancelarla", async () => {
    const a = actions();
    render(<DeletionCard last={{ status: "pendiente", created_at: "2026-10-29T12:00:00Z", resolution_note: null }} actions={a} />);
    expect(screen.getByText("Solicitud en revisión")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Solicitar eliminación" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("button", { name: "Cancelar solicitud" }));
    await waitFor(() => expect(a.cancel).toHaveBeenCalled());
    expect(await screen.findByRole("status")).toHaveTextContent("Solicitud cancelada.");
  });

  it("si fue rechazada muestra la nota del equipo y deja pedirla de nuevo", () => {
    render(<DeletionCard last={{ status: "rechazada", created_at: "2026-10-01T12:00:00Z", resolution_note: "Tienes un pedido en curso" }} actions={actions()} />);
    expect(screen.getByText(/Tienes un pedido en curso/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Solicitar eliminación" })).toBeInTheDocument();
  });

  it("con la sesión vencida lleva a ingresar", async () => {
    const a = actions();
    a.request.mockResolvedValue(expiredResult);
    render(<DeletionCard last={null} actions={a} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Solicitar eliminación" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fajustes%2Fdatos&expirada=1"));
  });
});
