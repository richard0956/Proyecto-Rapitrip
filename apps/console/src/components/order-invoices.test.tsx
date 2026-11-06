import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OrderInvoices, type InvoicesResult } from "./order-invoices";

const venta = { id: "v1", kind: "venta" as const, number: "RT-V-000123", issuedLabel: "5 nov 2026, 2:32 p. m.", totalLabel: "C$ 200.00" };
const nota = { id: "n1", kind: "nota_credito_venta" as const, number: "RT-NCV-000045", issuedLabel: "6 nov 2026, 9:00 a. m.", totalLabel: "C$ 200.00" };

describe("OrderInvoices", () => {
  it("lista los documentos con su enlace al PDF y avisa que no tienen validez fiscal", async () => {
    const load = vi.fn<(id: string) => Promise<InvoicesResult>>().mockResolvedValue({ ok: true, invoices: [venta, nota] });
    render(<OrderInvoices orderId="o1" status="confirmado" load={load} />);
    expect(await screen.findByText("RT-V-000123")).toBeInTheDocument();
    expect(load).toHaveBeenCalledWith("o1");
    expect(screen.getByRole("link", { name: /Descargar PDF de Factura de venta RT-V-000123/ })).toHaveAttribute("href", "/facturas/v1");
    expect(screen.getByRole("link", { name: /Nota de crédito \(venta\) RT-NCV-000045/ })).toHaveAttribute("href", "/facturas/n1");
    expect(screen.getAllByText("Anulación")).toHaveLength(1);
    expect(screen.getByText(/sin validez fiscal/)).toBeInTheDocument();
  });

  it("un pedido sin pagar todavía no pide ni muestra nada", () => {
    const load = vi.fn<(id: string) => Promise<InvoicesResult>>();
    const { container } = render(<OrderInvoices orderId="o1" status="pendiente_pago" load={load} />);
    expect(load).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it("sin documentos no dibuja nada, y si falla lo dice", async () => {
    const empty = vi.fn<(id: string) => Promise<InvoicesResult>>().mockResolvedValue({ ok: true, invoices: [] });
    const { container, unmount } = render(<OrderInvoices orderId="o1" status="listo" load={empty} />);
    await waitFor(() => expect(empty).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
    unmount();

    const broken = vi.fn<(id: string) => Promise<InvoicesResult>>().mockResolvedValue({ ok: false, error: "No pudimos cargar las facturas." });
    render(<OrderInvoices orderId="o2" status="listo" load={broken} />);
    expect(await screen.findByText("No pudimos cargar las facturas.")).toBeInTheDocument();
  });
});
