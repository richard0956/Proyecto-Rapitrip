import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeliverPanel } from "./deliver-panel";

function setup(over: Partial<Parameters<typeof DeliverPanel>[0]> = {}) {
  const onConfirm = vi.fn().mockResolvedValue({ result: "ok" });
  render(<DeliverPanel uploadedAt="2026-10-23T15:00:00Z" pending={false} cashTotal={350} onPhoto={vi.fn()} onConfirm={onConfirm} {...over} />);
  return { onConfirm, user: userEvent.setup() };
}
const confirm = () => screen.getByRole("button", { name: /Confirmar entrega|Confirmando/ });
const typeCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(screen.getAllByRole("textbox", { name: /dígito/i })[0]!);
  await user.keyboard(code);
};

describe("DeliverPanel", () => {
  it("en efectivo precarga el total y envía monto, código y quién recibió", async () => {
    const { user, onConfirm } = setup();
    expect(screen.getByText(/Cobra C\$ 350.00 en efectivo/)).toBeInTheDocument();
    expect(screen.getByLabelText("Monto que cobraste")).toHaveValue("350");
    await user.type(screen.getByLabelText(/Recibió otra persona/), "Juan, vecino");
    await typeCode(user, "7305");
    await user.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ code: "7305", cash: 350, receivedBy: "Juan, vecino", note: null });
  });

  it("si el monto no coincide, pide explicar la diferencia antes de confirmar", async () => {
    const { user, onConfirm } = setup();
    const amount = screen.getByLabelText("Monto que cobraste");
    await user.clear(amount);
    await user.type(amount, "300");
    await typeCode(user, "7305");
    expect(await screen.findByLabelText("Explica la diferencia")).toBeInTheDocument();
    expect(confirm()).toBeDisabled();
    await user.type(screen.getByLabelText("Explica la diferencia"), "Solo tenía ese dinero");
    await waitFor(() => expect(confirm()).toBeEnabled());
    await user.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ code: "7305", cash: 300, receivedBy: null, note: "Solo tenía ese dinero" });
  });

  it("un monto ilegible bloquea la confirmación", async () => {
    const { user } = setup();
    const amount = screen.getByLabelText("Monto que cobraste");
    await user.clear(amount);
    await user.type(amount, "abc");
    await typeCode(user, "7305");
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(/monto válido/)).toBeInTheDocument();
  });

  it("un pedido ya pagado no muestra cobro y envía cash nulo", async () => {
    const { user, onConfirm } = setup({ cashTotal: null });
    expect(screen.queryByLabelText("Monto que cobraste")).not.toBeInTheDocument();
    await typeCode(user, "7305");
    await user.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith({ code: "7305", cash: null, receivedBy: null, note: null });
  });

  it("sin la foto de entrega no se puede confirmar", async () => {
    const { user } = setup({ uploadedAt: null });
    await typeCode(user, "7305");
    expect(confirm()).toBeDisabled();
  });

  it("un código de entrega incorrecto avisa", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ result: "incorrecto" });
    const { user } = setup({ onConfirm });
    await typeCode(user, "0000");
    await user.click(confirm());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Código incorrecto/);
  });
});
