import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Páginas de la tienda: encabezado de dos pisos y pie. El acceso (ingresar, registro, recuperar) usa su propia pantalla completa. */
export default function TiendaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus:rounded-full focus:bg-hoja focus:px-5 focus:py-3 focus:font-bold focus:text-white">
        Saltar al contenido
      </a>
      <SiteHeader />
      <div id="contenido" className="flex-1 pt-4 sm:pt-6">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
