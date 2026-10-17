import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh: vi.fn() }) }));

import { expiredResult } from "@/lib/result";
import { CommerceForm } from "./commerce-form";

async function fill() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nombre del negocio"), "Ferretería El Clavo");
  await user.type(screen.getByLabelText("Teléfono"), "+505 8456 2210");
  await user.type(screen.getByLabelText("Dirección del negocio"), "Bo. Altagracia, Managua");
  await user.type(screen.getByLabelText("Categoría"), "Ferretería");
  await user.click(screen.getByRole("button", { name: "Enviar solicitud" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("CommerceForm", () => {
  it("el botón queda deshabilitado hasta completar los campos", () => {
    render(<CommerceForm initialName="Juan Téllez" submit={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Enviar solicitud" })).toBeDisabled();
  });

  it("precarga el representante y envía los datos del negocio", async () => {
    const submit = vi.fn().mockResolvedValue({ ok: true });
    render(<CommerceForm initialName="Juan Téllez" submit={submit} />);
    await fill();
    expect(submit).toHaveBeenCalledWith({ businessName: "Ferretería El Clavo", contactName: "Juan Téllez", phone: "+505 8456 2210", address: "Bo. Altagracia, Managua", category: "Ferretería" });
    expect(await screen.findByRole("status")).toHaveTextContent("Recibimos la solicitud de «Ferretería El Clavo»");
  });

  it("muestra el motivo si la base de datos rechaza la solicitud", async () => {
    render(<CommerceForm initialName="Juan" submit={vi.fn().mockResolvedValue({ ok: false, error: "ya tienes una solicitud pendiente" })} />);
    await fill();
    expect(await screen.findByRole("alert")).toHaveTextContent("ya tienes una solicitud pendiente");
  });

  it("con la sesión vencida conserva lo escrito y lleva a ingresar", async () => {
    render(<CommerceForm initialName="Juan" submit={vi.fn().mockResolvedValue(expiredResult)} />);
    await fill();
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fvende&expirada=1"));
    expect(JSON.parse(sessionStorage.getItem("rapitrip:vende") ?? "{}")).toMatchObject({ businessName: "Ferretería El Clavo", category: "Ferretería" });
  });
});
