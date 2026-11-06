import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvoicesCard, type InvoiceItem } from "./invoices-card";

const venta: InvoiceItem = { id: "v1", kind: "venta", number: "RT-V-000123", issuedLabel: "5 nov 2026, 2:32 p. m.", totalLabel: "C$ 200.00" };
const nota: InvoiceItem = { id: "n1", kind: "nota_credito_venta", number: "RT-NCV-000045", issuedLabel: "6 nov 2026, 9:00 a. m.", totalLabel: "C$ 200.00" };

describe("InvoicesCard", () => {
  it("lista cada documento con su número, total y enlace al PDF del pedido", () => {
    render(<InvoicesCard orderId="o1" invoices={[venta, nota]} />);
    expect(screen.getByText("RT-V-000123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Descargar PDF de Factura de venta RT-V-000123/ })).toHaveAttribute("href", "/pedidos/o1/facturas/v1");
    expect(screen.getByRole("link", { name: /Nota de crédito \(venta\) RT-NCV-000045/ })).toHaveAttribute("href", "/pedidos/o1/facturas/n1");
  });
  it("marca la nota de crédito como anulación y avisa que no tiene validez fiscal", () => {
    render(<InvoicesCard orderId="o1" invoices={[venta, nota]} />);
    expect(screen.getAllByText("Anulación")).toHaveLength(1);
    expect(screen.getByText(/sin validez fiscal/)).toBeInTheDocument();
  });
  it("sin documentos no dibuja nada", () => {
    const { container } = render(<InvoicesCard orderId="o1" invoices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
