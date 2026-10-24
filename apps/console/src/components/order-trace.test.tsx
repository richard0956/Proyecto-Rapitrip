import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TraceResult } from "@/lib/order-trace-server";
import { OrderTrace } from "./order-trace";

const ok: TraceResult = {
  ok: true,
  entries: [
    { at: "2026-10-23T14:00:00Z", kind: "estado", title: "Listo" },
    { at: "2026-10-23T14:05:00Z", kind: "oferta", title: "Ana rechazó la propuesta", detail: "Estoy muy lejos", alert: true },
    { at: "2026-10-23T14:20:00Z", kind: "evidencia", title: "Foto de recogida en la tienda", detail: "a 40 m del punto" },
  ],
  photos: [
    { id: "p1", kind: "recogida", label: "Recogida", takenAt: "2026-10-23T14:20:00Z", url: "https://x.test/a.jpg", purged: false, alert: false },
    { id: "p2", kind: "entrega", label: "Entrega", takenAt: "2026-10-23T14:50:00Z", url: null, purged: true, alert: true },
  ],
  cash: { method: "efectivo", total: 350, collected: 330, code: "CE-9F3A21", receivedAt: null },
};

describe("OrderTrace", () => {
  it("no consulta nada hasta que se pide", () => {
    const load = vi.fn();
    render(<OrderTrace orderId="o1" load={load} />);
    expect(load).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ver historial y evidencias" })).toBeInTheDocument();
  });

  it("muestra la línea de tiempo, las fotos, las alertas y el cobro", async () => {
    const load = vi.fn().mockResolvedValue(ok);
    render(<OrderTrace orderId="o1" load={load} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver historial y evidencias" }));
    expect(await screen.findByText("Ana rechazó la propuesta")).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith("o1");
    expect(screen.getByText("Estoy muy lejos")).toBeInTheDocument();
    expect(screen.getByText("1 por revisar")).toBeInTheDocument();
    // La foto con enlace se abre en otra pestaña; la eliminada lo explica.
    expect(screen.getByRole("link", { name: /Recogida/ })).toHaveAttribute("href", "https://x.test/a.jpg");
    expect(screen.getByText("Foto eliminada por antigüedad")).toBeInTheDocument();
    // Cobró de menos: la diferencia salta a la vista.
    expect(screen.getByText(/Faltan .*20/)).toBeInTheDocument();
    expect(screen.getByText("Pendiente de caja")).toBeInTheDocument();
  });

  it("un pedido sin alertas lo dice", async () => {
    render(<OrderTrace orderId="o1" load={vi.fn().mockResolvedValue({ ok: true, entries: [{ at: "2026-10-23T14:00:00Z", kind: "estado", title: "Listo" }], photos: [], cash: null })} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver historial y evidencias" }));
    expect(await screen.findByText("Sin alertas")).toBeInTheDocument();
  });

  it("un error permite reintentar", async () => {
    const load = vi.fn().mockResolvedValueOnce({ ok: false, error: "No pudimos cargar el historial del pedido." }).mockResolvedValueOnce(ok);
    render(<OrderTrace orderId="o1" load={load} />);
    await userEvent.click(screen.getByRole("button", { name: "Ver historial y evidencias" }));
    expect(await screen.findByText(/No pudimos cargar el historial/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText("Ana rechazó la propuesta")).toBeInTheDocument();
  });
});
