"use client";

import { Alert, Button, TextareaField } from "@rapitrip/ui";
import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { CustomerResult } from "@/lib/result";

const topics = [
  { value: "compra", label: "Compra" },
  { value: "entrega", label: "Entrega" },
  { value: "app", label: "La tienda" },
  { value: "otro", label: "Otro" },
] as const;
type Topic = (typeof topics)[number]["value"];

const ratingLabels = ["", "Muy mala", "Mala", "Regular", "Buena", "Excelente"];

/** Comentario con tema, calificación de 1 a 5 estrellas y mensaje. Tras enviarlo, el formulario se limpia. */
export function FeedbackForm({ send }: { send: (input: unknown) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [topic, setTopic] = useState<Topic>("compra");
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [pending, start] = useTransition();

  function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    if (rating === 0) return setResult({ ok: false, error: "Elige una calificación de 1 a 5 estrellas." });
    start(async () => {
      const outcome = await send({ topic, rating, message: message.trim() });
      if (!outcome.ok && outcome.expired) return router.replace(`/ingresar?next=${encodeURIComponent("/ajustes/ayuda")}&expirada=1`);
      setResult(outcome);
      if (outcome.ok) {
        setRating(0);
        setMessage("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-tinta">Tema</legend>
        <div className="flex flex-wrap gap-2">
          {topics.map((item) => (
            <label key={item.value} className="relative cursor-pointer rounded-full bg-crema px-4 py-2 text-[13px] font-semibold text-tinta ring-1 ring-borde transition-colors has-[:checked]:bg-selva has-[:checked]:text-sobre-acento has-[:checked]:ring-selva has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja">
              <input type="radio" name="tema-comentario" value={item.value} checked={topic === item.value} onChange={() => setTopic(item.value)} className="sr-only" />
              {item.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-bold text-tinta">Calificación</legend>
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className="relative cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-hoja">
                <input type="radio" name="calificacion" value={value} checked={rating === value} onChange={() => setRating(value)} className="sr-only" aria-label={`${value} de 5 — ${ratingLabels[value]}`} />
                <Star aria-hidden="true" className={`size-7 transition-colors ${value <= rating ? "fill-naranja text-naranja" : "text-borde-campo"}`} />
              </label>
            ))}
          </div>
          <span className="text-[13px] font-semibold text-tinta-suave" aria-live="polite">
            {rating ? ratingLabels[rating] : "Sin calificar"}
          </span>
        </div>
      </fieldset>

      <TextareaField label="Tu comentario" maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Qué te gustó o qué podemos mejorar" required />
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
      <Button variant="primary" type="submit" disabled={pending || message.trim().length < 5} className="self-start">
        {pending ? "Enviando…" : "Enviar comentario"}
      </Button>
    </form>
  );
}
