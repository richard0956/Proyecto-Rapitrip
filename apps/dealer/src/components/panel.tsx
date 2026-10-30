import { cn, Reveal } from "@rapitrip/ui";
import { ChevronRight, Sparkle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Panel verde de la marca, del mismo linaje que el héroe de la tienda: se aclara hacia abajo, con brillos difusos y estrellas.
 * `overflow-clip` y no `overflow-hidden`: con hidden, enfocar un botón adentro desplaza el contenido (los brillos lo hacen desplazable).
 */
export function GreenPanel({ labelledBy, className, children }: { labelledBy: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={labelledBy} className={cn("relative isolate overflow-clip rounded-[2rem] bg-[linear-gradient(180deg,var(--panel)_0%,#0d5644_58%,#14705a_100%)] px-5 pb-5 pt-6 text-white shadow-flota", className)}>
      <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-72 rounded-full bg-esmeralda/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -left-20 -z-10 size-72 rounded-full bg-marino/50 blur-3xl" />
      <Sparkle aria-hidden="true" className="absolute right-[12%] top-[14%] size-6 fill-esmeralda text-esmeralda" />
      <Sparkle aria-hidden="true" className="absolute right-[26%] top-[30%] size-3.5 fill-esmeralda/70 text-esmeralda/70" />
      {children}
    </section>
  );
}

/** Píldora pequeña de cristal arriba del panel («Tu jornada», «Tu actividad»…). */
export function PanelTag({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-esmeralda ring-1 ring-white/15">
      {icon} {children}
    </p>
  );
}

/** Cifra sobre el panel verde: una baldosa de cristal como los pasos de «Para comercios» de la tienda. */
export function PanelStat({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <li className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-white/[0.07] p-3 ring-1 ring-white/10">
      <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full bg-esmeralda/20 text-esmeralda">
        {icon}
      </span>
      <span className="truncate font-titulo text-[22px] font-extrabold leading-none tabular-nums tracking-tight">{value}</span>
      <span className="text-[11.5px] font-semibold leading-tight text-white/70">{label}</span>
    </li>
  );
}

/** Bandeja blanca de esquinas amplias, la misma que agrupa cada bloque de la portada de la tienda. */
export function Tray({ children }: { children: ReactNode }) {
  return <Reveal className="rounded-[2rem] bg-superficie p-4 shadow-[0_30px_60px_-44px_rgb(6_54_42/0.4)] ring-1 ring-selva/[0.04]">{children}</Reveal>;
}

/** Estado vacío cálido dentro de una bandeja, como el de «Ofertas y promociones» de la tienda. */
export function WarmEmpty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-tarjeta bg-gradient-to-br from-calido via-superficie to-menta/60 px-6 py-8 text-center ring-1 ring-selva/[0.05]">
      <span aria-hidden="true" className="flex size-14 items-center justify-center rounded-2xl bg-superficie text-hoja shadow-[0_12px_24px_-14px_rgb(6_54_42/0.45)]">
        {icon}
      </span>
      <div>
        <p className="text-[16px] font-bold text-tinta">{title}</p>
        {children ? <p className="mt-1 text-[13.5px] text-tinta-suave">{children}</p> : null}
      </div>
    </div>
  );
}

/** Título de sección con su contador y, si hay adónde ir, la píldora oscura «Ver todo» de la tienda. */
export function SectionTitle({ id, title, text, count, href, linkLabel }: { id: string; title: string; text?: string; count?: number; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-end justify-between gap-3 px-1">
      <div className="min-w-0">
        <h2 id={id} className="flex items-center gap-2 text-[22px] font-bold leading-tight tracking-tight text-tinta">
          {title}
          {count ? <span className="rounded-full bg-menta px-2 py-0.5 text-[12px] font-extrabold tabular-nums text-hoja">{count}</span> : null}
        </h2>
        {text ? <p className="mt-0.5 text-[13px] text-tinta-suave">{text}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          className="group inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-tinta py-1 pl-4 pr-1 text-[13px] font-semibold text-sobre-acento transition-colors duration-500 ease-fluido hover:bg-selva focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hoja"
        >
          {linkLabel ?? "Ver todo"}
          <span aria-hidden="true" className="flex size-8 items-center justify-center rounded-full bg-superficie text-tinta transition-transform duration-500 ease-fluido group-hover:translate-x-0.5">
            <ChevronRight className="size-4" />
          </span>
        </Link>
      ) : null}
    </div>
  );
}
