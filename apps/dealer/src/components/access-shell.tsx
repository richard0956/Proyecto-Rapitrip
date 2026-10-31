import { BrandMark, Lema } from "@rapitrip/ui";
import { Bike, Check } from "lucide-react";
import type { ReactNode } from "react";
import { GreenPanel, PanelTag } from "./panel";

const points = ["Acceso solo por invitación de coordinación", "Avisos de propuestas aunque la aplicación esté cerrada", "Cada recogida y entrega queda con su evidencia"];

/**
 * Marco del acceso del repartidor, pensado para el teléfono: el panel verde del inicio con el logo de la tienda (la «R» del emblema
 * y «apitrip» escrito) y, debajo, la tarjeta del formulario. En pantallas grandes, panel y formulario van lado a lado.
 */
export function AccessShell({ children }: { children: ReactNode }) {
  return (
    <main className="group/acceso relative isolate min-h-dvh overflow-clip">
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[62%] -z-10 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-menta/70 blur-3xl" />
      <div className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col justify-center gap-4 px-4 max-lg:group-has-[input:focus]/acceso:justify-start pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] lg:grid lg:max-w-[960px] lg:grid-cols-2 lg:content-center lg:items-center lg:gap-6 [&>*:last-child]:lg:col-span-2 [&>*:last-child]:lg:justify-self-center">
        <GreenPanel labelledBy="acceso-marca">
          {/* El logo va sobre su fondo claro, igual que en el encabezado de la tienda: la «R» del emblema es oscura. */}
          <span className="inline-flex rounded-2xl bg-superficie px-3.5 py-2.5 shadow-[0_12px_24px_-14px_rgb(0_0_0/0.5)]">
            <BrandMark priority className="text-[28px]" />
          </span>
          {/* En el teléfono, mientras se escribe, el panel queda solo con el logo: así el formulario sube y el teclado no lo tapa. */}
          <div className="max-lg:group-has-[input:focus]/acceso:hidden">
            <div className="mt-4">
              <PanelTag icon={<Bike aria-hidden="true" className="size-3.5" />}>Repartidores</PanelTag>
            </div>
            <h2 id="acceso-marca" className="mt-3 text-[24px] font-extrabold leading-tight tracking-tight">
              Tus propuestas y entregas, en el bolsillo
            </h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/80">Recibe propuestas, recoge en la tienda y entrega con código y foto.</p>
            <ul className="mt-4 hidden flex-col gap-2 min-[400px]:flex">
              {points.map((point) => (
                <li key={point} className="flex items-center gap-2.5 rounded-2xl bg-white/[0.07] p-2 pr-3 text-[12.5px] font-semibold leading-snug ring-1 ring-white/10">
                  <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-esmeralda text-panel">
                    <Check className="size-3.5" strokeWidth={2.5} />
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </GreenPanel>
        {children}
        <Lema className="self-center max-lg:group-has-[input:focus]/acceso:hidden" />
      </div>
    </main>
  );
}
