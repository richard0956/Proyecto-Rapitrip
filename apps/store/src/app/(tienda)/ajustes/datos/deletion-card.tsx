"use client";

import { Alert, TextareaField } from "@rapitrip/ui";
import { Clock, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { CustomerResult } from "@/lib/result";

type Request = { status: string; created_at: string; resolution_note: string | null } | null;
type Actions = { request: (input: unknown) => Promise<CustomerResult>; cancel: () => Promise<CustomerResult> };

const fecha = new Intl.DateTimeFormat("es", { dateStyle: "long" });

/**
 * Eliminar la cuenta: explica qué se borra, pide confirmar con una casilla y envía la solicitud (con un motivo opcional). Con una
 * solicitud pendiente muestra su estado y permite cancelarla; si fue rechazada, muestra la nota del equipo.
 */
export function DeletionCard({ last, actions }: { last: Request; actions: Actions }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [pending, start] = useTransition();

  function run(task: () => Promise<CustomerResult>) {
    setResult(null);
    start(async () => {
      const outcome = await task();
      if (!outcome.ok && outcome.expired) return router.replace(`/ingresar?next=${encodeURIComponent("/ajustes/datos")}&expirada=1`);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  }

  if (last?.status === "pendiente") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-calido/70 p-4 ring-1 ring-naranja/20">
          <span className="flex items-start gap-3">
            <Clock aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-naranja" />
            <span>
              <span className="block text-[14px] font-semibold text-tinta">Solicitud en revisión</span>
              <span className="block text-[12.5px] text-tinta-suave">La enviaste el {fecha.format(new Date(last.created_at))}. Tu cuenta sigue activa hasta que la atendamos.</span>
            </span>
          </span>
          <button type="button" disabled={pending} onClick={() => run(actions.cancel)} className="inline-flex min-h-10 items-center rounded-full bg-superficie px-4 text-[13px] font-semibold text-tinta ring-1 ring-borde-campo hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja disabled:opacity-60">
            {pending ? "Cancelando…" : "Cancelar solicitud"}
          </button>
        </div>
        {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {last?.status === "rechazada" ? <Alert tone="warning">No pudimos eliminar tu cuenta{last.resolution_note ? `: ${last.resolution_note}` : "."} Puedes enviar otra solicitud.</Alert> : null}
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[13px] leading-relaxed text-tinta-suave marker:text-rojo">
        <li>Borramos tu nombre, correo, teléfono, foto y direcciones, y ya no podrás ingresar.</li>
        <li>Tus pedidos quedan en los registros de las tiendas, pero sin tus datos personales.</li>
        <li>No se puede deshacer. Si solo quieres dejar de recibir correos, apágalos en Preferencias.</li>
      </ul>
      <TextareaField label="Motivo (opcional)" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cuéntanos por qué te vas; nos ayuda a mejorar." />
      <label className="flex cursor-pointer items-start gap-3 text-[13.5px] text-tinta">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[var(--rojo)]" />
        Entiendo que eliminar mi cuenta borra mis datos personales y no se puede deshacer.
      </label>
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
      <button
        type="button"
        disabled={pending || !confirmed}
        onClick={() => run(() => actions.request({ reason: reason.trim() || undefined, confirmed: true }))}
        className="inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-rojo px-5 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo disabled:cursor-not-allowed disabled:opacity-50 dark:text-[#2a151b]"
      >
        <Trash2 aria-hidden="true" className="size-4" />
        {pending ? "Enviando…" : "Solicitar eliminación"}
      </button>
    </div>
  );
}
