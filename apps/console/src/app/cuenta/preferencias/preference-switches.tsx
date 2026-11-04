"use client";

import { Alert, cn, setMotionReduced, useMotionReduced } from "@rapitrip/ui";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-error";

/** Interruptor accesible (role="switch") con título y explicación al lado. */
function Switch({ checked, onChange, label, text, disabled }: { checked: boolean; onChange: (value: boolean) => void; label: string; text: string; disabled?: boolean }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4 rounded-panel bg-papel p-4 ring-1 ring-borde transition-colors hover:ring-menta-borde", disabled && "cursor-not-allowed opacity-60")}>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-tinta">{label}</span>
        <span className="block text-[12.5px] leading-snug text-tinta-suave">{text}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn("relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja", checked ? "bg-hoja" : "bg-borde-campo")}
      >
        <span className={cn("inline-block size-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </button>
    </label>
  );
}

/** Correos de pedidos de la tienda: se guarda en la cuenta (sirve en cualquier dispositivo). */
export function OrderEmailSwitch({ enabled, save }: { enabled: boolean; save: (enabled: boolean) => Promise<ActionResult> }) {
  const router = useRouter();
  const [value, setValue] = useState(enabled);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  function change(next: boolean) {
    setValue(next);
    setResult(null);
    start(async () => {
      const outcome = await save(next);
      setResult(outcome);
      if (!outcome.ok) setValue(!next);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <Switch checked={value} onChange={change} disabled={pending} label="Avisos de mis compras" text="Si también compras en la tienda de Rapitrip con esta cuenta, te escribimos cuando tu pedido se recibe o se cancela." />
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? (result.message ?? "Listo.") : result.error}</Alert> : null}
    </div>
  );
}

/** Reducir animaciones: se guarda en este navegador y se aplica al instante (la introducción y las transiciones se apagan). */
export function MotionSwitch() {
  const reduced = useMotionReduced();
  return <Switch checked={reduced} onChange={setMotionReduced} label="Reducir animaciones" text="Quita la introducción de marca y las transiciones entre pantallas. Útil en computadoras lentas o si el movimiento te molesta." />;
}
