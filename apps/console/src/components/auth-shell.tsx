import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";

const points = [
  "Permisos por rol y por comercio, verificados en el servidor",
  "Acceso solo por invitación; nadie conoce tu contraseña",
  "Cada inicio de sesión queda registrado",
];

function siteHost() {
  try {
    return process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL).host : null;
  } catch {
    return null;
  }
}

/** Pantalla partida del prototipo: panel de marca a la izquierda y la tarjeta del formulario a la derecha. */
export function AuthShell({ children }: { children: ReactNode }) {
  const host = siteHost();
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-hoja px-14 pb-10 pt-12 text-white lg:flex lg:flex-col">
        <div aria-hidden="true" className="pointer-events-none absolute -top-60 right-[-120px] size-[480px] rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-52 right-[-180px] size-[420px] rounded-full bg-white/10" />
        <Logo />
        <div className="relative my-auto max-w-[500px]">
          <h2 className="max-w-[480px] text-[40px] font-extrabold leading-[1.15] tracking-tight [text-wrap:wrap]">Una sola consola para operar Rapitrip</h2>
          <p className="mt-6 text-base text-menta">Director, encargado de ventas y comercios afiliados entran por la misma puerta. Cada rol ve solo lo que le corresponde.</p>
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
        {host ? <p className="relative text-xs font-bold text-menta-borde">{host}</p> : null}
      </aside>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10">
        <div className="rounded-boton bg-selva px-4 py-3 lg:hidden">
          <Logo />
        </div>
        <div className="w-full max-w-[460px]">{children}</div>
      </main>
    </div>
  );
}
