import { Logo } from "@rapitrip/ui";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-borde bg-papel">
      <div className="mx-auto flex max-w-[1176px] flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <Logo tone="light" />
        <nav aria-label="Pie de página" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-bold text-hoja">
          <Link href="/vende" className="underline-offset-2 hover:underline">
            Vende en Rapitrip
          </Link>
          <Link href="/ingresar" className="underline-offset-2 hover:underline">
            Ingresar
          </Link>
          <Link href="/registro" className="underline-offset-2 hover:underline">
            Crear cuenta
          </Link>
        </nav>
        <p className="text-xs text-tinta-suave">© {new Date().getFullYear()} Rapitrip</p>
      </div>
    </footer>
  );
}
