"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/use-online";

/** Aviso fijo cuando el teléfono pierde la conexión. Lo ya subido está a salvo y lo pendiente se sube solo al volver. */
export function ConnectionBanner({ pending = 0 }: { pending?: number }) {
  const online = useOnline();
  if (online && pending === 0) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-durazno px-4 py-2 text-[12.5px] font-bold text-durazno-texto">
      <WifiOff className="size-4 shrink-0" aria-hidden="true" />
      {online ? `Subiendo ${pending} foto${pending === 1 ? "" : "s"} pendiente${pending === 1 ? "" : "s"}…` : pending > 0 ? `Sin conexión. ${pending} foto${pending === 1 ? "" : "s"} se subirá${pending === 1 ? "" : "n"} al volver la señal.` : "Sin conexión. Vuelve a intentarlo cuando tengas señal."}
    </div>
  );
}
