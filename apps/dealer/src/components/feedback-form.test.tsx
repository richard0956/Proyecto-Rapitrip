import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FeedbackForm } from "./feedback-form";

const rpc = vi.fn();
vi.mock("@/lib/client", () => ({ getSupabase: () => ({ rpc }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const send = () => screen.getByRole("button", { name: /Enviar comentario|Enviando/ });

describe("FeedbackForm", () => {
  beforeEach(() => rpc.mockReset());

  it("no ofrece «Compra»: el repartidor comenta entregas, la app u otro", () => {
    render(<FeedbackForm />);
    expect(screen.getAllByRole("radio", { name: /Entregas|La app|Otro/ })).toHaveLength(3);
    expect(screen.queryByRole("radio", { name: /Compra/ })).not.toBeInTheDocument();
  });

  it("pide calificar antes de enviar", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.type(screen.getByLabelText("Tu comentario"), "Todo bien hoy");
    await user.click(send());
    expect(rpc).not.toHaveBeenCalled();
    expect(screen.getByText(/Elige una calificación/)).toBeInTheDocument();
  });

  it("envía tema, estrellas y mensaje, y limpia el formulario", async () => {
    rpc.mockResolvedValue({ data: "f1", error: null });
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByRole("radio", { name: "La app" }));
    await user.click(screen.getByRole("radio", { name: /4 de 5/ }));
    await user.type(screen.getByLabelText("Tu comentario"), "  La app va rápida  ");
    await user.click(send());
    expect(rpc).toHaveBeenCalledWith("send_feedback", { p_topic: "app", p_rating: 4, p_message: "La app va rápida" });
    expect(await screen.findByText(/Recibimos tu comentario/)).toBeInTheDocument();
    expect(screen.getByLabelText("Tu comentario")).toHaveValue("");
  });

  it("muestra el aviso de la base de datos (por ejemplo, el tope diario)", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "ya enviaste varios comentarios hoy; inténtalo mañana" } });
    const user = userEvent.setup();
    render(<FeedbackForm />);
    await user.click(screen.getByRole("radio", { name: /5 de 5/ }));
    await user.type(screen.getByLabelText("Tu comentario"), "Otro comentario");
    await user.click(send());
    expect(await screen.findByText(/inténtalo mañana/)).toBeInTheDocument();
  });
});
