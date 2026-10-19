import { ImageOff } from "lucide-react";
import { productImageUrl } from "@/lib/money";

/** Imagen de producto del bucket público, con carga diferida y un marcador cuando no hay foto. */
export function ProductImage({ path, alt, priority = false, className = "" }: { path: string | null | undefined; alt: string; priority?: boolean; className?: string }) {
  const src = productImageUrl(path);
  if (!src) {
    return (
      <div role="img" aria-label={`${alt} (sin foto)`} className={`flex items-center justify-center bg-menta/60 text-tinta-suave ${className}`}>
        <ImageOff aria-hidden="true" className="size-7" />
      </div>
    );
  }
  // El bucket es del propio Supabase y la CSP ya lo permite; el optimizador de Next no puede leer orígenes locales.
  return <img src={src} alt={alt} loading={priority ? "eager" : "lazy"} decoding="async" className={`object-cover ${className}`} />;
}
