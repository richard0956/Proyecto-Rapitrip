"use client";

import { Alert, TextareaField } from "@rapitrip/ui";
import { Send, Star } from "lucide-react";
import { useState, type FormEvent } from "react";
import { friendlyError } from "@/lib/api-error";
import { getSupabase } from "@/lib/client";
import { useAuthGuard } from "@/lib/use-auth-guard";

/** Los temas que acepta `send_feedback`, sin «compra»: el repartidor no compra. */
const topics = [
  { value: "entrega", label: "Entregas" },
  { value: "app", label: "La app" },
  { value: "otro", label: "Otro" },
] as const;
type Topic = (typeof topics)[number]["value"];

const ratingLabels = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];

type Result = { ok: true; message: string } | { ok: false; error: string };

/**
 * Comentario para el equipo de Rapitrip: tema, de 1 a 5 estrellas y el mensaje. Usa el mismo `send_feedback` que la tienda (lo
 * lee la administración en la consola). Tras enviarlo, el formulario se limpia.
 */
export function FeedbackForm() {
  const supabase = getSupabase();
  const guard = useAuthGuard();
  const [topic, setTopic] = useState<Topic>("entrega");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    if (rating === 0) return setResult({ ok: false, error: "Elige una calificación de 1 a 5 estrellas." });
    setPending(true);
    const { error } = await supabase.rpc("send_feedback", { p_topic: topic, p_rating: rating, p_message: message.trim() });
    setPending(false);
    if (error) {
      if (!guard(error)) setResult({ ok: false, error: friendlyError(error, "No pudimos enviar el comentario. Inténtalo de nuevo.") });
      return;
    }
    setRating(0);
    setMessage("");
    setResult({ ok: true, message: "¡Gracias! Recibimos tu comentario." });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset>
        <legend className="mb-2 px-1 text-[13px] font-bold text-tinta">Tema</legend>
        <div className="grid grid-cols-3 gap-1 rounded-full bg-crema p-1 ring-1 ring-borde">
          {topics.map((item) => (
            <label
              key={item.value}
              className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-full text-[13.5px] font-bold text-tinta-suave transition-colors duration-300 ease-fluido has-[:checked]:bg-selva has-[:checked]:text-sobre-acento has-[:checked]:shadow-pulsa has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja"
            >
              <input type="radio" name="tema-comentario" value={item.value} checked={topic === item.value} onChange={() => setTopic(item.value)} className="sr-only" />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 px-1 text-[13px] font-bold text-tinta">Calificación</legend>
        <div className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className="relative cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja">
                <input type="radio" name="calificacion" value={value} checked={rating === value} onChange={() => setRating(value)} className="sr-only" aria-label={`${value} de 5 — ${ratingLabels[value]}`} />
                <Star aria-hidden="true" className={`size-8 transition-[color,fill,transform] duration-300 ease-fluido active:scale-90 ${value <= rating ? "fill-naranja text-naranja" : "text-borde-campo"}`} />
              </label>
            ))}
          </div>
          <span className="text-[13px] font-semibold text-tinta-suave" aria-live="polite">
            {rating ? ratingLabels[rating] : "Sin calificar"}
          </span>
        </div>
      </fieldset>

      {/* `text-base` (16px): con menos, Safari del iPhone amplía la página al enfocar el campo. */}
      <TextareaField label="Tu comentario" className="text-base" maxLength={1000} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Qué te gustó o qué podemos mejorar" required />
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
      <button
        type="submit"
        disabled={pending || message.trim().length < 5}
        className="group inline-flex min-h-12 items-center justify-between gap-2 rounded-full bg-selva py-1.5 pl-6 pr-1.5 text-[14px] font-bold text-sobre-acento shadow-pulsa transition-[background-color,transform] duration-500 ease-fluido hover:bg-tinta active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
      >
        {pending ? "Enviando…" : "Enviar comentario"}
        <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-esmeralda text-panel transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
          <Send className="size-4" />
        </span>
      </button>
    </form>
  );
}
