import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/** Páginas de la tienda: cabecera y pie. El acceso (ingresar, registro, recuperar) usa su propia pantalla completa. */
export default function TiendaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-boton focus:bg-hoja focus:px-4 focus:py-2 focus:font-bold focus:text-white">
        Saltar al contenido
      </a>
      <SiteHeader />
      <div id="contenido" className="flex-1">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
