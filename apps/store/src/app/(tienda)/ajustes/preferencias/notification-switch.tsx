"use client";

import { Alert } from "@rapitrip/ui";
import { Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import type { CustomerResult } from "@/lib/result";

/** Interruptor de los correos de pedido. Cambia al instante y vuelve atrás si la base de datos no lo guarda. */
export function NotificationSwitch({ enabled, save }: { enabled: boolean; save: (input: unknown) => Promise<CustomerResult> }) {
  const router = useRouter();
  const [value, setOptimistic] = useOptimistic(enabled);
  const [result, setResult] = useState<CustomerResult | null>(null);
  const [pending, start] = useTransition();

  function toggle() {
    setResult(null);
    start(async () => {
      setOptimistic(!value);
      const outcome = await save({ enabled: !value });
      if (!outcome.ok && outcome.expired) return router.replace(`/ingresar?next=${encodeURIComponent("/ajustes/preferencias")}&expirada=1`);
      setResult(outcome);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
        <span className="flex items-start gap-3">
          <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-hoja" />
          <span>
            <span id="avisos-pedidos" className="block text-[14px] font-semibold text-tinta">
              Correos de mis pedidos
            </span>
            <span className="block text-[12.5px] text-tinta-suave">Cuando recibimos tu pedido y si se cancela.</span>
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={value}
          aria-labelledby="avisos-pedidos"
          disabled={pending}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-300 ease-fluido focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja disabled:opacity-70 ${value ? "bg-hoja" : "bg-borde-campo"}`}
        >
          <span aria-hidden="true" className={`absolute left-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ease-fluido ${value ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>
      {result ? <Alert tone={result.ok ? "info" : "error"}>{result.ok ? result.message : result.error}</Alert> : null}
    </div>
  );
}
