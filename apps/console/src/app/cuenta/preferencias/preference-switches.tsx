"use client";

import { cn, setMotionReduced, useMotionReduced } from "@rapitrip/ui";

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

/** Reducir animaciones: se guarda en este navegador y se aplica al instante (la introducción y las transiciones se apagan). */
export function MotionSwitch() {
  const reduced = useMotionReduced();
  return <Switch checked={reduced} onChange={setMotionReduced} label="Reducir animaciones" text="Quita la introducción de marca y las transiciones entre pantallas. Útil en computadoras lentas o si el movimiento te molesta." />;
}
