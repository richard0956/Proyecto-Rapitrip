import { Reveal } from "@rapitrip/ui";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { GreenPanel, PanelTag } from "./panel";

/** Encabezado de cada sección de ajustes (Preferencias, Cuenta, Ayuda): el panel verde con la flecha de vuelta a Perfil. */
export function SettingsHeader({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <Reveal>
      <GreenPanel labelledBy="titulo-ajuste">
        <div className="flex items-center gap-2.5">
          <Link
            href="/perfil"
            aria-label="Volver a Perfil"
            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition-colors duration-500 ease-fluido hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
          </Link>
          <PanelTag icon={icon}>Ajustes</PanelTag>
        </div>
        <h1 id="titulo-ajuste" className="mt-4 text-[28px] font-extrabold leading-tight tracking-tight">
          {title}
        </h1>
        <p className="mt-1 text-[14px] text-white/80">{text}</p>
      </GreenPanel>
    </Reveal>
  );
}

/** Bandeja de una parte de un ajuste: ícono, título y una línea de ayuda arriba del contenido (como `SectionCard` de la tienda). */
export function SettingsSection({ id, icon, title, text, children }: { id: string; icon: ReactNode; title: string; text?: string; children: ReactNode }) {
  return (
    <Reveal className="rounded-[2rem] bg-superficie p-4 shadow-[0_30px_60px_-44px_rgb(6_54_42/0.4)] ring-1 ring-selva/[0.04]">
      <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-4">
        <div className="flex items-start gap-3 px-1">
          <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-menta text-hoja">
            {icon}
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={`${id}-titulo`} className="text-[18px] font-bold leading-tight tracking-tight text-tinta">
              {title}
            </h2>
            {text ? <p className="mt-0.5 text-[12.5px] text-tinta-suave">{text}</p> : null}
          </div>
        </div>
        {children}
      </section>
    </Reveal>
  );
}
