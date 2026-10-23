import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { PayPurchase } from "./pay-purchase";

const pay = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe("PayPurchase", () => {
  it("pide el pago de toda la compra, una sola vez aunque se haga doble clic", async () => {
    let finish: (value: unknown) => void = () => {};
    pay.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<PayPurchase checkoutId="c1" pay={pay} />);
    await userEvent.setup().dblClick(screen.getByRole("button", { name: "Pagar con tarjeta" }));
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith("c1");
    finish({ ok: false, error: "x" });
  });

  it("muestra el motivo si no se pudo abrir el pago", async () => {
    pay.mockResolvedValue({ ok: false, error: "Esta compra ya no espera un pago." });
    render(<PayPurchase checkoutId="c1" pay={pay} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Pagar con tarjeta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esta compra ya no espera un pago.");
  });

  it("con la sesión vencida lleva a ingresar y vuelve a la compra", async () => {
    pay.mockResolvedValue({ ok: false, error: "Tu sesión venció.", expired: true });
    render(<PayPurchase checkoutId="c1" pay={pay} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Pagar con tarjeta" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/ingresar?next=${encodeURIComponent("/compras/c1")}&expirada=1`));
  });
});
