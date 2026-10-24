import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EvidenceSettingsForm } from "./evidence-settings-form";

const initial = { pickupPhoto: true, deliveryPhoto: true, pickupCode: true, deliveryCode: true, alertDistanceM: 150, retentionDays: 90 };

describe("EvidenceSettingsForm", () => {
  it("parte de las reglas vigentes", () => {
    render(<EvidenceSettingsForm initial={initial} save={vi.fn()} />);
    expect(screen.getByLabelText(/Foto al recoger/)).toBeChecked();
    expect(screen.getByLabelText(/Código de entrega/)).toBeChecked();
    expect(screen.getByLabelText(/Distancia de alerta/)).toHaveValue("150");
    expect(screen.getByLabelText(/Conservar las fotos/)).toHaveValue("90");
  });

  it("guarda los cambios como números", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, message: "Guardamos las reglas." });
    const user = userEvent.setup();
    render(<EvidenceSettingsForm initial={initial} save={save} />);
    await user.clear(screen.getByLabelText(/Distancia de alerta/));
    await user.type(screen.getByLabelText(/Distancia de alerta/), "200");
    await user.clear(screen.getByLabelText(/Conservar las fotos/));
    await user.type(screen.getByLabelText(/Conservar las fotos/), "60");
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ ...initial, alertDistanceM: 200, retentionDays: 60 }));
    expect(await screen.findByText("Guardamos las reglas.")).toBeInTheDocument();
  });

  it("no deja guardar valores fuera de rango", async () => {
    const user = userEvent.setup();
    render(<EvidenceSettingsForm initial={initial} save={vi.fn()} />);
    await user.clear(screen.getByLabelText(/Distancia de alerta/));
    await user.type(screen.getByLabelText(/Distancia de alerta/), "5");
    expect(screen.getByText("Escribe un número entre 20 y 2000.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar reglas" })).toBeDisabled();
    await user.clear(screen.getByLabelText(/Conservar las fotos/));
    await user.type(screen.getByLabelText(/Conservar las fotos/), "999");
    expect(screen.getByText("Escribe un número entre 7 y 365.")).toBeInTheDocument();
  });

  it("quitar una exigencia advierte que ese paso queda sin protección", async () => {
    const user = userEvent.setup();
    render(<EvidenceSettingsForm initial={initial} save={vi.fn()} />);
    expect(screen.queryByText(/deja de proteger ese paso/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/Foto al entregar/));
    expect(screen.getByText(/deja de proteger ese paso/)).toBeInTheDocument();
  });

  it("muestra el error de la base de datos", async () => {
    const user = userEvent.setup();
    render(<EvidenceSettingsForm initial={initial} save={vi.fn().mockResolvedValue({ ok: false, error: "acción reservada al administrador" })} />);
    await user.click(screen.getByRole("button", { name: "Guardar reglas" }));
    expect(await screen.findByText("acción reservada al administrador")).toBeInTheDocument();
  });
});
