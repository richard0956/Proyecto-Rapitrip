import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { session, updateUser, reauthenticate } = vi.hoisted(() => ({ session: { area: "admin" }, updateUser: vi.fn(), reauthenticate: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/guard", () => ({ requireAnyConsoleSession: vi.fn(async () => session) }));
vi.mock("@/lib/supabase", () => ({ serverSupabase: vi.fn(async () => ({ auth: { updateUser, reauthenticate } })) }));

import { helpFor } from "@/lib/help";
import { MOTION_KEY } from "@rapitrip/ui";
import { changePassword, reauthenticateForPassword } from "./actions";
import { HelpManual } from "./ayuda/help-manual";
import { MotionSwitch } from "./preferencias/preference-switches";

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
  reauthenticate.mockResolvedValue({ error: null });
});

describe("cambio de contraseña", () => {
  it("dirección y administración pueden cambiarla", async () => {
    session.area = "admin";
    expect(await changePassword({ password: "Rapitrip-2026!" })).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({ password: "Rapitrip-2026!" });
  });

  it("caja, coordinación y comercio no: la restablece la administración", async () => {
    for (const area of ["caja", "coordinacion", "comercio"]) {
      session.area = area;
      expect(await changePassword({ password: "Rapitrip-2026!" })).toEqual({ ok: false, error: "Tu contraseña la restablece la administración." });
      expect(await reauthenticateForPassword()).toMatchObject({ ok: false });
    }
    expect(updateUser).not.toHaveBeenCalled();
    expect(reauthenticate).not.toHaveBeenCalled();
  });

  it("si Supabase pide confirmar la identidad, avisa que hace falta el código", async () => {
    session.area = "admin";
    updateUser.mockResolvedValue({ error: { code: "reauthentication_needed", message: "" } });
    expect(await changePassword({ password: "Rapitrip-2026!" })).toMatchObject({ ok: false, needsCode: true });
  });
});

describe("manual de ayuda", () => {
  it("el buscador deja solo los temas que coinciden", async () => {
    const user = userEvent.setup();
    render(<HelpManual guide={helpFor("caja", false)} />);
    expect(screen.getByText("Manual de Caja")).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Buscar en el manual" }), "voucher");
    expect(screen.getByRole("status")).toHaveTextContent("1 tema");
    expect(screen.getAllByText("Registrar una venta").length).toBeGreaterThan(0);
    expect(screen.queryByText("Cerrar la caja", { selector: "summary span" })).not.toBeInTheDocument();
  });
});

describe("reducir animaciones", () => {
  it("se guarda en el navegador y se aplica al instante", async () => {
    const user = userEvent.setup();
    localStorage.removeItem(MOTION_KEY);
    delete document.documentElement.dataset.motion;
    render(<MotionSwitch />);
    const toggle = screen.getByRole("switch", { name: "Reducir animaciones" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(document.documentElement.dataset.motion).toBe("reducido");
    expect(localStorage.getItem(MOTION_KEY)).toBe("reducido");
    await user.click(toggle);
    expect(document.documentElement.dataset.motion).toBeUndefined();
    expect(localStorage.getItem(MOTION_KEY)).toBeNull();
  });
});
