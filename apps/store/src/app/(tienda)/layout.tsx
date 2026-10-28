import type { ReactNode } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

/**
 * Páginas de la tienda: encabezado, contenido y pie comparten el mismo contenedor (1180 px con 12/24 px de margen lateral), así
 * los bordes del contenido quedan alineados con la barra y con el pie en todas las páginas. Cada página solo fija su ancho
 * máximo, sin márgenes propios. El acceso (ingresar, registro, recuperar) usa su propia pantalla completa.
 */
export default function TiendaLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-40 focus:rounded-full focus:bg-hoja focus:px-5 focus:py-3 focus:font-bold focus:text-white">
        Saltar al contenido
      </a>
      <SiteHeader />
      <div id="contenido" className="flex-1 px-3 pt-6 sm:px-6 sm:pt-8">
        {children}
      </div>
      <SiteFooter />
    </>
  );
}
