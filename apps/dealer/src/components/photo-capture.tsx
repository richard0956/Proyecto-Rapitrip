"use client";

import { cn } from "@rapitrip/ui";
import { Camera, CircleCheck, Clock } from "lucide-react";
import { useId, useRef, useState } from "react";

type Props = {
  label: string;
  hint?: string;
  /** Hora ya registrada en el servidor, si la foto ya subió. */
  uploadedAt: string | null;
  /** La foto está guardada en el teléfono esperando señal. */
  pending: boolean;
  /** Permite tomar otra foto aunque ya haya una (intentos fallidos). */
  allowRetake?: boolean;
  onCapture: (file: File) => Promise<void>;
};

const time = new Intl.DateTimeFormat("es-NI", { hour: "2-digit", minute: "2-digit", timeZone: "America/Managua" });

/**
 * Abre la cámara trasera del teléfono (sin permisos extra: es un campo de archivo con `capture`). La foto se reduce, se guarda
 * en el teléfono y se sube sola; el estado dice si ya está en el servidor, si espera señal o si falta.
 */
export function PhotoCapture({ label, hint, uploadedAt, pending, allowRetake, onCapture }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = uploadedAt !== null;
  const locked = done && !allowRetake;

  async function onChange(file: File | undefined) {
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      await onCapture(file);
    } catch {
      setError("No pudimos preparar la foto. Inténtalo de nuevo.");
    } finally {
      setWorking(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-tinta-suave">{label}</p>
      <input ref={input} id={id} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => void onChange(e.target.files?.[0])} disabled={working || locked} />
      <label
        htmlFor={id}
        className={cn(
          "flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-campo border-2 border-dashed px-4 text-[15px] font-bold focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-hoja",
          done ? "border-hoja bg-menta text-hoja" : pending ? "border-naranja bg-durazno text-durazno-texto" : "border-borde-campo bg-white text-tinta",
          (working || locked) && "cursor-default opacity-80",
        )}
      >
        {done ? <CircleCheck className="size-5" aria-hidden="true" /> : pending ? <Clock className="size-5" aria-hidden="true" /> : <Camera className="size-5" aria-hidden="true" />}
        {working ? "Preparando la foto…" : done ? `Foto lista · ${time.format(new Date(uploadedAt))}${allowRetake ? " · tomar otra" : ""}` : pending ? "Guardada · se sube al volver la señal" : "Tomar foto"}
      </label>
      {hint && !done ? <p className="text-xs text-tinta-suave">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-bold text-rojo">
          {error}
        </p>
      ) : null}
    </div>
  );
}
