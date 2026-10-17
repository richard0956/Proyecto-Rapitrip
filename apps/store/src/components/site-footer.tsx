import { Logo } from "@rapitrip/ui";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-selva/10 bg-papel/60">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-4 py-14 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-4">
          <Logo tone="light" className="[&_img]:h-9" />
          <img src="/brand/lema-tinta.webp" width={720} height={65} alt="Seguridad y Confianza" className="h-4 w-auto opacity-80" />
        </div>
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-7 gap-y-2 text-[13px] font-bold text-hoja">
          <Link href="/vende" className="underline-offset-4 hover:underline">
            Vende en Rapitrip
          </Link>
          <Link href="/ingresar" className="underline-offset-4 hover:underline">
            Ingresar
          </Link>
          <Link href="/registro" className="underline-offset-4 hover:underline">
            Crear cuenta
          </Link>
        </nav>
        <p className="text-xs text-tinta-suave">© {new Date().getFullYear()} Rapitrip</p>
      </div>
    </footer>
  );
}
