import { cn } from "@rapitrip/ui";

/** Bloque que ocupa el lugar del contenido mientras llega (mismo estilo que los estados de carga de la tienda). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-concha bg-tinta/10 motion-reduce:animate-none", className)} />;
}

/** Pantalla de carga: un estado accesible y bloques con la forma de lo que vendrá. */
export function LoadingList({ label = "Cargando…", rows = 3, height = "h-28" }: { label?: string; rows?: number; height?: string }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p role="status" className="sr-only">
        {label}
      </p>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}
