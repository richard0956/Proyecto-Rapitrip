import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, refresh } = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

import { expiredResult } from "@/lib/result";
import { FeedbackForm } from "./feedback-form";

beforeEach(() => vi.clearAllMocks());

describe("FeedbackForm", () => {
  it("no deja enviar sin un comentario de al menos 5 caracteres", async () => {
    render(<FeedbackForm send={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Enviar comentario" })).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText("Tu comentario"), "Hola");
    expect(screen.getByRole("button", { name: "Enviar comentario" })).toBeDisabled();
  });

  it("pide una calificación antes de enviar", async () => {
    const send = vi.fn();
    render(<FeedbackForm send={send} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Tu comentario"), "Todo muy bien");
    await user.click(screen.getByRole("button", { name: "Enviar comentario" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Elige una calificación");
    expect(send).not.toHaveBeenCalled();
  });

  it("envía tema, calificación y mensaje, y limpia el formulario", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: "Gracias por tu comentario." });
    render(<FeedbackForm send={send} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("Entrega"));
    await user.click(screen.getByLabelText("4 de 5 — Buena"));
    await user.type(screen.getByLabelText("Tu comentario"), "  Llegó rápido  ");
    await user.click(screen.getByRole("button", { name: "Enviar comentario" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Gracias por tu comentario.");
    expect(send).toHaveBeenCalledWith({ topic: "entrega", rating: 4, message: "Llegó rápido" });
    expect(screen.getByLabelText("Tu comentario")).toHaveValue("");
  });

  it("con la sesión vencida lleva a ingresar", async () => {
    render(<FeedbackForm send={vi.fn().mockResolvedValue(expiredResult)} />);
    const user = userEvent.setup();
    await user.click(screen.getByLabelText("5 de 5 — Excelente"));
    await user.type(screen.getByLabelText("Tu comentario"), "Todo muy bien");
    await user.click(screen.getByRole("button", { name: "Enviar comentario" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/ingresar?next=%2Fajustes%2Fayuda&expirada=1"));
  });
});
