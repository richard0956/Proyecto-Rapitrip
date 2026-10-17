import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Lema } from "./lema";
import { Logo } from "./logo";

export type AuthLayoutProps = {
  subtitle?: string;
  headline: string;
  text: string;
  points: string[];
  footer?: string | null;
  children: ReactNode;
};

/**
 * Pantalla partida compacta: panel de marca en verde (con un toque del azul secundario) a la izquierda, solo en escritorio,
 * y el formulario en una tarjeta de doble bisel a la derecha. Las medidas se ajustan a la altura para que todo quepa en un portátil.
 */
export function AuthLayout({ subtitle, headline, text, points, footer, children }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-selva px-10 py-8 text-white lg:flex lg:flex-col xl:px-14">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 size-[460px] rounded-full bg-esmeralda/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 -left-32 size-[420px] rounded-full bg-marino/60 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-white/15 to-transparent" />
        <Logo tone="dark" subtitle={subtitle} priority className="relative" />
        <div className="relative my-auto max-w-[460px] py-8">
          <h2 className="text-[clamp(26px,3.2vw,36px)] font-bold leading-[1.1] tracking-tight [text-wrap:balance]">{headline}</h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-nav-texto/80">{text}</p>
          <ul className="mt-7 flex flex-col gap-2.5">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 rounded-2xl bg-white/[0.05] p-2.5 pr-4 text-[13.5px] leading-snug text-nav-texto ring-1 ring-white/10">
                <span aria-hidden="true" className="flex size-7 shrink-0 items-center justify-center rounded-full bg-esmeralda text-selva">
                  <Check className="size-3.5" strokeWidth={2.25} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-end justify-between gap-4">
          <Lema tone="dark" />
          {footer ? <p className="text-xs font-medium text-bruma">{footer}</p> : null}
        </div>
      </aside>
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-6 overflow-hidden px-4 py-8">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-menta/70 blur-3xl" />
        <Logo tone="light" subtitle={subtitle} priority className="relative lg:hidden [&_img]:h-9" />
        <div className="relative w-full max-w-[420px]">{children}</div>
      </main>
    </div>
  );
}
