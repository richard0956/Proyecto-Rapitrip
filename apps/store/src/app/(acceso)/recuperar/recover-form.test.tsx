import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { resetPasswordForEmail } = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn() }));
vi.mock("@rapitrip/supabase/browser", () => ({ createBrowserSupabase: () => ({ auth: { resetPasswordForEmail } }) }));

import { RecoverForm } from "./recover-form";

async function submit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Correo"), "ana@correo.test");
  await user.click(screen.getByRole("button", { name: "Enviar enlace" }));
}

beforeEach(() => vi.clearAllMocks());

describe("RecoverForm", () => {
  it("responde igual exista o no la cuenta", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const { unmount } = render(<RecoverForm />);
    await submit();
    expect(await screen.findByRole("status")).toHaveTextContent("Si hay una cuenta con ese correo");
    unmount();

    resetPasswordForEmail.mockResolvedValue({ error: { status: 400, message: "User not found" } });
    render(<RecoverForm />);
    await submit();
    expect(await screen.findByRole("status")).toHaveTextContent("Si hay una cuenta con ese correo");
  });

  it("avisa si el servicio falla de verdad", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: { status: 500, message: "boom" } });
    render(<RecoverForm />);
    await submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos enviar el enlace");
  });
});
