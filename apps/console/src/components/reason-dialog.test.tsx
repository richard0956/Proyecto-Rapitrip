import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { ReasonDialog } from "./reason-dialog";

beforeEach(() => vi.clearAllMocks());

function setup(onConfirm = vi.fn().mockResolvedValue({ ok: true }), onClose = vi.fn()) {
  render(<ReasonDialog open onClose={onClose} title="Suspender rol" confirmLabel="Suspender" onConfirm={onConfirm} />);
  return { onConfirm, onClose, user: userEvent.setup() };
}

describe("ReasonDialog", () => {
  it("no deja confirmar con un motivo más corto que el mínimo", async () => {
    const { user } = setup();
    const confirm = screen.getByRole("button", { name: "Suspender" });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByLabelText("Motivo"), "corto");
    expect(confirm).toBeEnabled();
    await user.clear(screen.getByLabelText("Motivo"));
    await user.type(screen.getByLabelText("Motivo"), "abc");
    expect(confirm).toBeDisabled();
  });

  it("envía el motivo sin espacios sobrantes y refresca al terminar", async () => {
    const { user, onConfirm, onClose } = setup();
    await user.type(screen.getByLabelText("Motivo"), "  incumplimiento reiterado  ");
    await user.click(screen.getByRole("button", { name: "Suspender" }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("incumplimiento reiterado"));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("muestra el error y no cierra si la acción falla", async () => {
    const { user, onClose } = setup(vi.fn().mockResolvedValue({ ok: false, error: "no tienes permiso" }));
    await user.type(screen.getByLabelText("Motivo"), "motivo válido");
    await user.click(screen.getByRole("button", { name: "Suspender" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("no tienes permiso");
    expect(onClose).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
