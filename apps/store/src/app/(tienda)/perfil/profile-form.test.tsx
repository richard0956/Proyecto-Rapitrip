import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { expiredResult } from "@/lib/result";
import { ProfileForm } from "./profile-form";

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe("ProfileForm", () => {
  it("guarda y muestra la confirmación", async () => {
    const save = vi.fn().mockResolvedValue({ ok: true, message: "Datos guardados." });
    render(<ProfileForm initial={{ fullName: "Ana", phone: "" }} save={save} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Datos guardados.");
  });

  it("con la sesión vencida guarda un borrador y lleva a ingresar", async () => {
    const save = vi.fn().mockResolvedValue(expiredResult);
    render(<ProfileForm initial={{ fullName: "Ana", phone: "" }} save={save} />);
    const user = userEvent.setup();
    await user.clear(screen.getByLabelText("Nombre completo"));
    await user.type(screen.getByLabelText("Nombre completo"), "Ana María Pérez");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fperfil&expirada=1"));
    expect(JSON.parse(sessionStorage.getItem("rapitrip:perfil") ?? "{}")).toEqual({ fullName: "Ana María Pérez", phone: "" });
  });

  it("recupera el borrador al volver", async () => {
    sessionStorage.setItem("rapitrip:perfil", JSON.stringify({ fullName: "Ana María Pérez", phone: "88887777" }));
    render(<ProfileForm initial={{ fullName: "Ana", phone: "" }} save={vi.fn()} />);
    await waitFor(() => expect(screen.getByLabelText("Nombre completo")).toHaveValue("Ana María Pérez"));
    expect(screen.getByLabelText("Teléfono")).toHaveValue("88887777");
    expect(screen.getByRole("status")).toHaveTextContent("Recuperamos lo que escribiste");
    expect(sessionStorage.getItem("rapitrip:perfil")).toBeNull();
  });
});
