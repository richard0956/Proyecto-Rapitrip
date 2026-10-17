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
        <div aria-hidden="true" className="pointer-events-none absolute -top-60 right-[-120px] size-[480px] rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 right-[-180px] size-[420px] rounded-full bg-white/10" />
        <Logo subtitle={subtitle} />
        <div className="relative my-auto max-w-[500px]">
          <h2 className="max-w-[480px] text-[40px] font-extrabold leading-[1.15] tracking-tight [text-wrap:wrap]">{headline}</h2>
          <p className="mt-6 text-base text-menta">{text}</p>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((point) => (
              <li key={point} className="flex items-center gap-3 text-[15px]">
                <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-menta-borde text-selva">
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>
        {footer ? <p className="relative text-xs font-bold text-menta-borde">{footer}</p> : null}
      </aside>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="rounded-boton bg-selva px-4 py-3 lg:hidden">
          <Logo subtitle={subtitle} />
        </div>
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}
