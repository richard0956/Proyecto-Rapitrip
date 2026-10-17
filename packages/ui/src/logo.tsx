import { cn } from "./cn";

/** Los archivos salen de `brand/source` con `scripts/build-brand-assets.py` y cada app los sirve desde `/brand`. */
const files = {
  lockup: { src: "/brand/logo-completo.webp", width: 960, height: 419 },
  emblem: { src: "/brand/emblema-192.webp", width: 163, height: 192 },
};

/**
 * Marca de Rapitrip con los logos oficiales.
 * - `light` (fondos claros): el logo completo, con la R y «apitrip» en verde.
 * - `dark` (fondos azules): el emblema sobre una baldosa clara y el nombre en texto vivo, en blanco.
 */
export function Logo({ tone = "light", subtitle, className, priority }: { tone?: "dark" | "light"; subtitle?: string; className?: string; priority?: boolean }) {
  const loading = priority ? "eager" : "lazy";
  if (tone === "light") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        <img src={files.lockup.src} width={files.lockup.width} height={files.lockup.height} alt="Rapitrip" loading={loading} decoding="async" className="h-8 w-auto" />
        {subtitle ? <p className="text-[10.5px] text-tinta-suave">{subtitle}</p> : null}
      </div>
    );
  }
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-papel shadow-[inset_0_1px_1px_rgb(255_255_255/0.9),0_10px_20px_-10px_rgb(0_0_0/0.5)]">
        <img src={files.emblem.src} width={files.emblem.width} height={files.emblem.height} alt="" loading={loading} decoding="async" className="h-6 w-auto" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="font-titulo text-[19px] font-bold leading-none tracking-tight text-white">Rapitrip</p>
        {subtitle ? <p className="text-[10.5px] font-medium leading-none text-bruma">{subtitle}</p> : null}
      </div>
    </div>
  );
}
