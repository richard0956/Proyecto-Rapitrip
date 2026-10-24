import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PickupHandoff } from "./pickup-handoff";

const photo = { ok: true as const, photo: { url: "https://x.test/r.jpg", takenAt: "2026-10-23T15:00:00Z", purged: false } };

describe("PickupHandoff", () => {
  it("con el pedido listo muestra el código para el repartidor", async () => {
    const loadCode = vi.fn().mockResolvedValue({ ok: true, code: "4821" });
    render(<PickupHandoff orderId="o1" status="listo" loadCode={loadCode} loadPhoto={vi.fn()} />);
    expect(await screen.findByLabelText("Código de recogida 4 8 2 1")).toHaveTextContent("4821");
    expect(loadCode).toHaveBeenCalledWith("o1");
  });

  it("si el código falla, avisa sin romper la pantalla", async () => {
    render(<PickupHandoff orderId="o1" status="listo" loadCode={vi.fn().mockResolvedValue({ ok: false, error: "No pudimos cargar el código de recogida." })} loadPhoto={vi.fn()} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/No pudimos cargar el código/);
  });

  it("ya recogido, muestra la foto que tomó el repartidor y no pide el código", async () => {
    const loadCode = vi.fn();
    render(<PickupHandoff orderId="o1" status="en_camino" loadCode={loadCode} loadPhoto={vi.fn().mockResolvedValue(photo)} />);
    expect(await screen.findByAltText(/Foto del paquete al recogerlo/)).toHaveAttribute("src", "https://x.test/r.jpg");
    expect(loadCode).not.toHaveBeenCalled();
  });

  it("una foto eliminada por antigüedad se explica", async () => {
    render(<PickupHandoff orderId="o1" status="entregado" loadCode={vi.fn()} loadPhoto={vi.fn().mockResolvedValue({ ok: true, photo: { url: null, takenAt: "2026-07-01T15:00:00Z", purged: true } })} />);
    expect(await screen.findByText(/se eliminó pasados 3 meses/)).toBeInTheDocument();
  });

  it("antes de estar listo no muestra nada", () => {
    const { container } = render(<PickupHandoff orderId="o1" status="preparando" loadCode={vi.fn()} loadPhoto={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
