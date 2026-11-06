import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { placesFor } from "@/lib/incidents";
import { StaffIncidents, type MyIncident } from "./staff-incidents";

const report = vi.fn();
const resolved: MyIncident = { id: "a1b2c3d4-0000-0000-0000-000000000000", type: "interrupcion", severity: "media", description: "La impresora no responde", status: "resuelto", resolution: "Se reinició el servicio", reportedFrom: "Caja y venta", createdAt: "2026-11-02T15:00:00Z" };

beforeEach(() => {
  vi.clearAllMocks();
  report.mockResolvedValue({ ok: true });
});

describe("StaffIncidents", () => {
  it("envía el tipo, la gravedad, la pantalla y la descripción", async () => {
    const user = userEvent.setup();
    render(<StaffIncidents places={placesFor("caja")} mine={[]} report={report} />);
    const send = screen.getByRole("button", { name: "Enviar reporte" });
    expect(send).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /Seguridad/ }));
    await user.click(screen.getByRole("radio", { name: /Grave/ }));
    expect(screen.getByText(/avisa por correo a la administración/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("¿Dónde pasó? (opcional)"), "Caja y venta");
    await user.type(screen.getByLabelText("Cuéntanos qué pasó"), "Un correo pidió mi contraseña");
    // Norma 1.3.2: un incidente de seguridad no se envía sin la información involucrada y los afectados.
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("¿Qué información está involucrada?"), "Contraseña");
    await user.type(screen.getByLabelText("¿Quiénes están afectados?"), "Mi cuenta");
    await user.click(send);
    expect(report).toHaveBeenCalledWith({ type: "seguridad", severity: "alta", where: "Caja y venta", description: "Un correo pidió mi contraseña", dataInvolved: "Contraseña", affected: "Mi cuenta" });
    expect(await screen.findByText("Reporte enviado")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("muestra el motivo si no se pudo enviar", async () => {
    report.mockResolvedValue({ ok: false, error: "ya enviaste varios reportes hoy" });
    const user = userEvent.setup();
    render(<StaffIncidents places={placesFor("comercio")} mine={[]} report={report} />);
    await user.click(screen.getByRole("radio", { name: /Leve/ }));
    await user.type(screen.getByLabelText("Cuéntanos qué pasó"), "Las fotos del catálogo no cargan");
    await user.click(screen.getByRole("button", { name: "Enviar reporte" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("ya enviaste varios reportes hoy");
  });

  it("lista lo ya reportado con su estado y la resolución", () => {
    render(<StaffIncidents places={placesFor("coordinacion")} mine={[resolved]} report={report} />);
    expect(screen.getByText("#A1B2C3D4")).toBeInTheDocument();
    expect(screen.getByText("Resuelto")).toBeInTheDocument();
    expect(screen.getByText("Se reinició el servicio")).toBeInTheDocument();
  });

  it("las pantallas de cada rol salen de su menú, sin la propia de reportes", () => {
    expect(placesFor("comercio")).toEqual(["Inicio", "Pedidos", "Mis tiendas", "Catálogo", "Inventario", "Liquidaciones", "Mi cuenta", "Inicio de sesión", "Otra pantalla"]);
    expect(placesFor("caja")).not.toContain("Reportar incidente");
  });
});
