import { buttonStyles } from "@rapitrip/ui";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata = { title: "Página no encontrada" };

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-xl flex-1 flex-col items-center px-4 py-20 text-center">
        <p className="text-5xl font-extrabold text-hoja">404</p>
        <h1 className="mt-3 text-[26px] font-extrabold text-tinta">No encontramos esa página</h1>
        <p className="mt-2 text-[13.5px] text-tinta-suave">Puede que el enlace esté mal escrito o que la página ya no exista.</p>
        <Link href="/" className={buttonStyles({ variant: "primary", className: "mt-6" })}>
          Volver al inicio
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
