"use client";

import { cn } from "@rapitrip/ui";
import { Banknote, Bike, ChevronRight, PackageCheck, Power, Route } from "lucide-react";
import { GreenPanel, PanelStat, PanelTag } from "./panel";

const clock = new Intl.DateTimeFormat("es-NI", { hour: "numeric", minute: "2-digit", timeZone: "America/Managua" });
const cordobas = new Intl.NumberFormat("es-NI", { maximumFractionDigits: 0 });

type Props = {
  name: string | null;
  available: boolean;
  since: string | null;
  busy: boolean;
  inProgress: number;
  deliveredToday: number;
  cashToCollect: number;
  onToggle: (next: boolean) => void;
};

/**
 * Héroe del inicio, del mismo linaje que la portada de la tienda: panel verde que se aclara hacia abajo, estrellas de la marca,
 * saludo grande, las cifras del día en baldosas de cristal y el interruptor de disponibilidad como píldora con su círculo.
 */
export function HomeHero({ name, available, since, busy, inProgress, deliveredToday, cashToCollect, onToggle }: Props) {
  const sinceText = available && since ? `Desde las ${clock.format(new Date(since))}` : null;
  return (
    <GreenPanel labelledBy="saludo">
      <div className="flex flex-wrap items-center gap-2">
        <PanelTag icon={<Bike aria-hidden="true" className="size-3.5" />}>Tu jornada</PanelTag>
        <p className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ring-1 transition-colors duration-700 ease-fluido", available ? "bg-esmeralda/20 text-white ring-esmeralda/40" : "bg-white/5 text-white/70 ring-white/10")}>
          <span aria-hidden="true" className={cn("size-2 rounded-full", available ? "animate-pulse bg-esmeralda motion-reduce:animate-none" : "bg-white/40")} />
          {available ? "En línea" : "Fuera de línea"}
        </p>
      </div>

      <h1 id="saludo" className="mt-4 text-[30px] font-extrabold leading-tight tracking-tight">
        Hola{name ? `, ${name}` : ""}
      </h1>
      <p className="mt-1 text-[14px] text-white/80">Tus propuestas y pedidos de hoy.</p>

      <ul className="mt-5 grid grid-cols-3 gap-2.5">
        <PanelStat icon={<Route className="size-3.5" />} label="En curso" value={inProgress} />
        <PanelStat icon={<PackageCheck className="size-3.5" />} label="Entregados hoy" value={deliveredToday} />
        <PanelStat icon={<Banknote className="size-3.5" />} label="Por cobrar" value={<span className="text-[18px]">C$ {cordobas.format(cashToCollect)}</span>} />
      </ul>

      {/* Disponibilidad: la coordinación solo propone pedidos a quien está disponible. */}
      <div className={cn("mt-4 flex flex-col gap-3 rounded-[1.6rem] p-3 ring-1 transition-colors duration-700 ease-fluido", available ? "bg-esmeralda/15 ring-esmeralda/30" : "bg-white/[0.07] ring-white/10")}>
        <div className="flex items-center gap-3 px-1 pt-1">
          <span aria-hidden="true" className={cn("relative flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-700 ease-fluido", available ? "bg-esmeralda text-panel" : "bg-white/10 text-white/70")}>
            <Power className="size-5" />
            {available ? <span className="absolute inset-0 animate-ping rounded-full bg-esmeralda/40 motion-reduce:hidden" /> : null}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-extrabold leading-tight">{available ? "Estoy disponible" : "No estoy disponible"}</p>
            <p className="text-[12px] text-white/70">{sinceText ?? (available ? "Coordinación puede proponerte pedidos." : "No recibirás propuestas nuevas.")}</p>
          </div>
        </div>
        <button
          type="button"
          aria-pressed={available}
          disabled={busy}
          onClick={() => onToggle(!available)}
          className={cn(
            "group inline-flex min-h-12 w-full items-center gap-2 rounded-full py-1.5 text-[15px] font-bold transition-[background-color,color,transform] duration-500 ease-fluido active:scale-[0.98] disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            available ? "justify-center bg-white/10 px-5 text-white ring-1 ring-white/20 hover:bg-white/15" : "justify-between bg-superficie pl-6 pr-1.5 text-selva shadow-pulsa hover:bg-menta",
          )}
        >
          {available ? "Terminé" : "Empezar"}
          {available ? null : (
            <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-selva text-sobre-acento transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
              <ChevronRight className="size-4" />
            </span>
          )}
        </button>
      </div>
    </GreenPanel>
  );
}
