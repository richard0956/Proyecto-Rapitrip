import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IncidentForm } from "./incident-form";

const rpc = vi.fn();
vi.mock("@/lib/client", () => ({ getSupabase: () => ({ rpc }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const send = () => screen.getByRole("button", { name: /Enviar reporte|Enviando/ });
const describeIt = (user: ReturnType<typeof userEvent.setup>, text: string) => user.type(screen.getByLabelText("Cuéntanos qué pasó"), text);

describe("IncidentForm", () => {
  beforeEach(() => rpc.mockReset());

  it("hasta elegir la gravedad y describir con 10 caracteres, no se envía", async () => {
    const user = userEvent.setup();
    render(<IncidentForm />);
    expect(send()).toBeDisabled();
    await describeIt(user, "No carga");
    await user.click(screen.getByRole("radio", { name: /Leve/ }));
    expect(send()).toBeDisabled();
    await describeIt(user, " la foto");
    expect(send()).toBeEnabled();
  });

  it("envía tipo, gravedad, pantalla, descripción y el teléfono, y muestra el número de reporte", async () => {
    rpc.mockResolvedValue({ data: "3f2a9c1b-0000-4000-8000-000000000000", error: null });
    const user = userEvent.setup();
    render(<IncidentForm />);
    await user.click(screen.getByRole("radio", { name: /Mi cuenta/ }));
    await user.click(screen.getByRole("radio", { name: "Detalle del pedido" }));
    await user.click(screen.getByRole("radio", { name: /Grave/ }));
    expect(screen.getByText(/avisa por correo al equipo/)).toBeInTheDocument();
    await describeIt(user, "  Me pidió ingresar otra vez sin motivo  ");
    // Norma 1.3.2: sin la información involucrada y los afectados, un incidente de seguridad no se envía.
    expect(send()).toBeDisabled();
    await user.type(screen.getByLabelText("¿Qué información está involucrada?"), "Mi contraseña");
    await user.type(screen.getByLabelText("¿Quiénes están afectados?"), "Mi cuenta");
    await user.click(send());
    expect(rpc).toHaveBeenCalledWith("courier_report_incident", {
      p_type: "seguridad",
      p_severity: "alta",
      p_description: "Me pidió ingresar otra vez sin motivo",
      p_where: "Detalle del pedido",
      p_device: expect.any(String),
      p_data_involved: "Mi contraseña",
      p_affected: "Mi cuenta",
    });
    expect(await screen.findByText("#3F2A9C1B")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reportar otro incidente" }));
    expect(screen.getByLabelText("Cuéntanos qué pasó")).toHaveValue("");
  });

  it("sin pantalla elegida no la manda, y muestra el aviso de la base de datos", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "ya enviaste varios reportes hoy; si es urgente, avisa a coordinación" } });
    const user = userEvent.setup();
    render(<IncidentForm />);
    await user.click(screen.getByRole("radio", { name: /Media/ }));
    await describeIt(user, "La lista de pedidos no se actualiza");
    await user.click(send());
    expect(rpc.mock.calls[0]?.[1]).not.toHaveProperty("p_where");
    expect(await screen.findByText(/avisa a coordinación/)).toBeInTheDocument();
  });
});
