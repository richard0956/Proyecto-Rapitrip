import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordForm, passwordStrength } from "./password-form";

async function fill(user: ReturnType<typeof userEvent.setup>, password = "NuevaClave#2026") {
  await user.type(screen.getByLabelText("Contraseña nueva"), password);
  await user.type(screen.getByLabelText("Repite la contraseña"), password);
}

describe("passwordStrength", () => {
  it("sube con el largo y la mezcla de caracteres", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("abcdefgh").score).toBe(1);
    expect(passwordStrength("NuevaClave#2026").score).toBe(4);
  });
});

describe("PasswordForm", () => {
  it("guarda la contraseña nueva y avisa", async () => {
    const user = userEvent.setup();
    const change = vi.fn().mockResolvedValue({ ok: true });
    render(<PasswordForm actions={{ change, sendCode: vi.fn() }} />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(change).toHaveBeenCalledWith({ password: "NuevaClave#2026" });
    expect(await screen.findByText("Tu contraseña se actualizó.")).toBeInTheDocument();
  });

  it("no envía si las contraseñas no coinciden", async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<PasswordForm actions={{ change, sendCode: vi.fn() }} />);
    await user.type(screen.getByLabelText("Contraseña nueva"), "NuevaClave#2026");
    await user.type(screen.getByLabelText("Repite la contraseña"), "OtraClave#2026");
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByText("Las contraseñas no coinciden.")).toBeInTheDocument();
  });

  it("si Supabase pide reautenticación, manda el código y completa el cambio con él", async () => {
    const user = userEvent.setup();
    const change = vi.fn().mockResolvedValueOnce({ ok: false, needsCode: true, error: "Confirma con el código." }).mockResolvedValueOnce({ ok: true });
    const sendCode = vi.fn().mockResolvedValue({ ok: true });
    render(<PasswordForm actions={{ change, sendCode }} />);
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Guardar contraseña" }));
    await waitFor(() => expect(sendCode).toHaveBeenCalled());
    await user.click(screen.getAllByRole("textbox")[0]!);
    await user.paste("123456");
    await user.click(screen.getByRole("button", { name: "Confirmar y guardar" }));
    expect(change).toHaveBeenLastCalledWith({ password: "NuevaClave#2026", code: "123456" });
    expect(await screen.findByText("Tu contraseña se actualizó.")).toBeInTheDocument();
  });
});
