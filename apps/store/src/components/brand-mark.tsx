import { cn } from "@rapitrip/ui";

/**
 * Logo de la tienda con el estilo de títulos del sistema (Bricolage Grotesque, «Rapi» en verde oscuro y «trip» en verde): la «R»
 * es la del emblema oficial y el resto va escrito. Sin baldosa ni fondo, para el encabezado y el pie.
 */
export function BrandMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span role="img" aria-label="Rapitrip" className={cn("inline-flex items-baseline font-titulo text-[22px] font-extrabold leading-none tracking-[-0.03em]", className)}>
      <img src="/brand/emblema-192.webp" width={163} height={192} alt="" loading={priority ? "eager" : "lazy"} decoding="async" className="mr-[0.5px] h-[0.82em] w-auto self-baseline" />
      <span aria-hidden="true" className="text-selva dark:text-tinta">
        api<span className="text-hoja">trip</span>
      </span>
    </span>
  );
}
