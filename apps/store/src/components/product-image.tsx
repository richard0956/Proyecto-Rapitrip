import { productImageUrl } from "@/lib/money";

/**
 * Imagen de producto del bucket público, con carga diferida. Sin foto muestra un marcador con la inicial del producto
 * sobre un degradado suave, para que las tarjetas sin imagen no se vean vacías. `fit="contain"` muestra la foto entera
 * sobre blanco (vitrina); por omisión la recorta para llenar el marco.
 */
export function ProductImage({ path, alt, priority = false, fit = "cover", className = "" }: { path: string | null | undefined; alt: string; priority?: boolean; fit?: "cover" | "contain"; className?: string }) {
  const src = productImageUrl(path);
  if (!src) {
    return (
      <div
        role="img"
        aria-label={`${alt} (sin foto)`}
        className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-menta via-papel to-durazno/70 ${className}`}
      >
        <span aria-hidden="true" className="select-none text-[clamp(3rem,9vw,5rem)] font-extrabold leading-none text-hoja/25">
          {alt.trim().charAt(0).toUpperCase() || "·"}
        </span>
      </div>
    );
  }
  // El bucket es del propio Supabase y la CSP ya lo permite; el optimizador de Next no puede leer orígenes locales.
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={`${fit === "contain" ? "bg-white object-contain p-2" : "object-cover"} ${className}`} />;
}
