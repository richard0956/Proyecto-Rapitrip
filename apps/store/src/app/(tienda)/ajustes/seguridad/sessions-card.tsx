"use client";

import { LogOut, MonitorSmartphone } from "lucide-react";
import { useState } from "react";

/**
 * Sesiones: cerrar la sesión de este dispositivo o de todos. Cerrar en todos pide confirmar con un segundo clic, porque también
 * saca de esta pantalla.
 */
export function SessionsCard({ signOut, signOutEverywhere }: { signOut: () => Promise<void>; signOutEverywhere: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-crema/70 p-4 ring-1 ring-borde">
        <span className="flex items-center gap-3">
          <MonitorSmartphone aria-hidden="true" className="size-5 shrink-0 text-hoja" />
          <span>
            <span className="block text-[14px] font-semibold text-tinta">Este dispositivo</span>
            <span className="block text-[12.5px] text-tinta-suave">Sesión activa ahora. Por seguridad dura como máximo un día.</span>
          </span>
        </span>
        <form action={signOut}>
          <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-superficie px-4 text-[13px] font-semibold text-tinta ring-1 ring-borde-campo transition-colors hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja">
            <LogOut aria-hidden="true" className="size-4" />
            Cerrar sesión
          </button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4 ring-1 ring-rojo/25">
        <span>
          <span className="block text-[14px] font-semibold text-tinta">Todos los dispositivos</span>
          <span className="block text-[12.5px] text-tinta-suave">Útil si ingresaste en un equipo ajeno o perdiste tu teléfono.</span>
        </span>
        {confirming ? (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setConfirming(false)} className="inline-flex min-h-10 items-center rounded-full px-3 text-[13px] font-semibold text-tinta-suave hover:bg-crema focus-visible:outline-2 focus-visible:outline-hoja">
              No
            </button>
            <form action={signOutEverywhere}>
              <button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-full bg-rojo px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rojo dark:text-[#2a151b]">
                Sí, cerrar en todos
              </button>
            </form>
          </div>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="inline-flex min-h-10 items-center gap-2 rounded-full bg-rosa px-4 text-[13px] font-semibold text-rojo transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-rojo">
            <LogOut aria-hidden="true" className="size-4" />
            Cerrar en todos
          </button>
        )}
      </div>
    </div>
  );
}
