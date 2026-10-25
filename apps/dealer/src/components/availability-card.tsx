"use client";

import { Button, Card, cn } from "@rapitrip/ui";
import { Power } from "lucide-react";

/** Interruptor grande: «Estoy disponible» solo mientras trabaja. La coordinación únicamente propone pedidos a quien está disponible. */
export function AvailabilityCard({ available, busy, onToggle }: { available: boolean; busy: boolean; onToggle: (next: boolean) => void }) {
  return (
    <Card className={cn("flex flex-col gap-4 p-4 transition-colors duration-700 ease-fluido", available && "bg-menta")}>
      <div className="flex items-center gap-3.5">
        <span aria-hidden="true" className={cn("flex size-12 shrink-0 items-center justify-center rounded-full transition-colors duration-700 ease-fluido", available ? "bg-hoja text-white" : "bg-calido text-tinta-suave")}>
          <Power className="size-6" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold leading-tight text-tinta">{available ? "Estoy disponible" : "No estoy disponible"}</p>
          <p className="text-[12.5px] text-tinta-suave">{available ? "Coordinación puede proponerte pedidos." : "No recibirás propuestas nuevas."}</p>
        </div>
      </div>
      <Button variant={available ? "secondary" : "primary"} className="min-h-12" disabled={busy} onClick={() => onToggle(!available)} aria-pressed={available}>
        {available ? "Terminé" : "Empezar"}
      </Button>
    </Card>
  );
}
