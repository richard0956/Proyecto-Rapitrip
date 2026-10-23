import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PickupPanel } from "./pickup-panel";

function setup(over: Partial<Parameters<typeof PickupPanel>[0]> = {}) {
  const onConfirm = vi.fn().mockResolvedValue({ result: "ok" });
  const onPhoto = vi.fn().mockResolvedValue(undefined);
  render(<PickupPanel uploadedAt={null} pending={false} onPhoto={onPhoto} onConfirm={onConfirm} {...over} />);
  return { onConfirm, onPhoto, user: userEvent.setup() };
}
const confirm = () => screen.getByRole("button", { name: /Confirmar recogida|Confirmando/ });
const typeCode = async (user: ReturnType<typeof userEvent.setup>, code: string) => {
  await user.click(screen.getAllByRole("textbox", { name: /dígito/i })[0]!);
  await user.keyboard(code);
};

describe("PickupPanel", () => {
  it("sin foto no se puede confirmar, aunque el código esté completo", async () => {
    const { user } = setup();
    await typeCode(user, "4821");
    expect(confirm()).toBeDisabled();
    expect(screen.getByText(/Primero toma la foto/)).toBeInTheDocument();
  });

  it("con foto, hace falta el código completo", async () => {
    const { user } = setup({ uploadedAt: "2026-10-23T15:00:00Z" });
    expect(confirm()).toBeDisabled();
    await typeCode(user, "48");
    expect(confirm()).toBeDisabled();
    await user.keyboard("21");
    await waitFor(() => expect(confirm()).toBeEnabled());
  });

  it("envía el código escrito", async () => {
    const { user, onConfirm } = setup({ uploadedAt: "2026-10-23T15:00:00Z" });
    await typeCode(user, "4821");
    await user.click(confirm());
    expect(onConfirm).toHaveBeenCalledWith("4821");
  });

  it("un código incorrecto avisa y limpia las cajas para escribir de nuevo", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ result: "incorrecto" });
    const { user } = setup({ uploadedAt: "2026-10-23T15:00:00Z", onConfirm });
    await typeCode(user, "0000");
    await user.click(confirm());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Código incorrecto/);
    expect(screen.getAllByRole("textbox", { name: /dígito/i }).every((box) => (box as HTMLInputElement).value === "")).toBe(true);
  });

  it("un código bloqueado manda a coordinación", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ result: "bloqueado" });
    const { user } = setup({ uploadedAt: "2026-10-23T15:00:00Z", onConfirm });
    await typeCode(user, "0000");
    await user.click(confirm());
    expect(await screen.findByRole("alert")).toHaveTextContent(/coordinación/);
  });

  it("un error de red se muestra tal cual", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ error: "Sin conexión. Revisa tu señal e inténtalo de nuevo." });
    const { user } = setup({ uploadedAt: "2026-10-23T15:00:00Z", onConfirm });
    await typeCode(user, "4821");
    await user.click(confirm());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Sin conexión/);
  });

  it("la foto guardada en el teléfono se muestra como pendiente de subir", () => {
    setup({ pending: true });
    expect(screen.getByText(/se sube al volver la señal/)).toBeInTheDocument();
  });

  it("los bultos solo aceptan números de 1 a 99", async () => {
    const { user } = setup();
    const field = screen.getByLabelText(/Bultos/);
    await user.type(field, "ab5c");
    expect(field).toHaveValue("5");
  });
});
