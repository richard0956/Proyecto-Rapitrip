"use client";

import { Alert, Button, SelectField, TextareaField } from "@rapitrip/ui";
import { Flag } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import type { CustomerResult } from "@/lib/result";

const kinds = [
  { value: "precio", label: "El precio" },
  { value: "disponibilidad", label: "La disponibilidad" },
  { value: "descripcion", label: "La descripción" },
  { value: "imagen", label: "Las fotos" },
  { value: "otro", label: "Otra cosa" },
] as const;

/** «¿Algo no coincide?»: el cliente reporta una inconsistencia del catálogo (Norma 8.2). Se abre solo si se pide. */
export function ReportIssue({ productId, report }: { productId: string; report: (input: { productId: string; kind: string; description: string }) => Promise<CustomerResult> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [pending, start] = useTransition();

  if (result?.ok) return <Alert tone="info">{result.message}</Alert>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 self-start text-[13px] font-semibold text-tinta-suave underline-offset-4 hover:text-tinta hover:underline">
        <Flag aria-hidden="true" className="size-3.5" />
        ¿Algo no coincide con el producto? Repórtalo
      </button>
    );
  }

  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(null);
        start(async () => setResult(await report({ productId, kind, description: description.trim() })));
      }}
    >
      <p className="text-[13.5px] font-bold text-tinta">Reportar un error en este producto</p>
      <SelectField label="¿Qué no coincide?" value={kind} onChange={(e) => setKind(e.target.value)} required>
        <option value="">Elige una opción</option>
        {kinds.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
          </option>
        ))}
      </SelectField>
      <TextareaField label="Cuéntanos qué viste" rows={3} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Por ejemplo: en la tienda cuesta 120, aquí dice 150." required />
      {result && !result.ok ? (
        <Alert tone="error">
          {result.error}
          {result.expired ? (
            <>
              {" "}
              <Link href={`/ingresar?next=${encodeURIComponent(`/productos/${productId}`)}`} className="font-bold underline">
                Ingresar
              </Link>
            </>
          ) : null}
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" type="submit" disabled={pending || !kind || description.trim().length < 10}>
          {pending ? "Enviando…" : "Enviar reporte"}
        </Button>
        <Button variant="ghost" type="button" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
