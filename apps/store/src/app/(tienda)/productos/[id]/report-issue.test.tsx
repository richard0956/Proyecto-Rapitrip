import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ReportIssue } from "./report-issue";

describe("reportar un error del producto", () => {
  it("se abre a pedido y envía qué no coincide", async () => {
    const user = userEvent.setup();
    const report = vi.fn(async () => ({ ok: true as const, message: "Gracias. Lo revisaremos." }));
    render(<ReportIssue productId="p1" report={report} />);
    await user.click(screen.getByRole("button", { name: /Algo no coincide/ }));
    await user.selectOptions(screen.getByLabelText("¿Qué no coincide?"), "precio");
    await user.type(screen.getByLabelText("Cuéntanos qué viste"), "En la tienda cuesta 120");
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(report).toHaveBeenCalledWith({ productId: "p1", kind: "precio", description: "En la tienda cuesta 120" });
    expect(await screen.findByText("Gracias. Lo revisaremos.")).toBeInTheDocument();
  });

  it("sin sesión invita a ingresar", async () => {
    const user = userEvent.setup();
    render(<ReportIssue productId="p1" report={async () => ({ ok: false, error: "Ingresa a tu cuenta para enviar el reporte.", expired: true })} />);
    await user.click(screen.getByRole("button", { name: /Algo no coincide/ }));
    await user.selectOptions(screen.getByLabelText("¿Qué no coincide?"), "otro");
    await user.type(screen.getByLabelText("Cuéntanos qué viste"), "No es la misma foto");
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(await screen.findByRole("link", { name: "Ingresar" })).toHaveAttribute("href", "/ingresar?next=%2Fproductos%2Fp1");
  });
});
