import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";

export type AuthLayoutProps = {
  subtitle?: string;
  headline: string;
  text: string;
  points: string[];
  footer?: string | null;
  children: ReactNode;
};

/** Pantalla partida: panel de marca a la izquierda (solo en escritorio) y la tarjeta del formulario a la derecha. */
export function AuthLayout({ subtitle, headline, text, points, footer, children }: AuthLayoutProps) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-hoja px-14 pb-10 pt-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 -top-48 size-[520px] rounded-full bg-esmeralda/15 blur-[2px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-56 -left-24 size-[460px] rounded-full bg-selva/60" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 right-[-140px] size-[360px] rounded-full bg-white/[0.06]" />
        <Logo tone="dark" subtitle={subtitle} priority className="relative" />
        <div className="relative my-auto max-w-[500px]">
          <h2 className="max-w-[480px] text-[40px] font-extrabold leading-[1.12] tracking-tight [text-wrap:wrap]">{headline}</h2>
          <p className="mt-6 text-base text-menta">{text}</p>
          <ul className="mt-9 flex flex-col gap-4">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-[15px]">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-esmeralda text-selva">
                  <Check className="size-3.5" strokeWidth={2.5} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative flex items-end justify-between gap-4">
          <img src="/brand/lema-blanco.webp" width={720} height={65} alt="Seguridad y Confianza" className="h-5 w-auto opacity-90" />
          {footer ? <p className="text-xs font-bold text-bruma">{footer}</p> : null}
        </div>
      </aside>
      <main className="relative flex min-h-dvh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-10">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-1/2 size-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-menta/60 blur-3xl" />
        <Logo tone="light" subtitle={subtitle} priority className="relative lg:hidden [&_img]:h-10" />
        <div className="relative w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}
