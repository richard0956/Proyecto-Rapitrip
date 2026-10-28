import { formatMoney } from "@/lib/money";

/** Insignia «-20 %» de un producto o presentación en descuento. */
export function DiscountBadge({ pct, className = "" }: { pct: number; className?: string }) {
  if (pct <= 0) return null;
  return (
    <span className={`inline-flex items-center rounded-full bg-hoja px-2.5 py-1 text-[11px] font-extrabold leading-none text-sobre-acento shadow-sm ${className}`}>
      <span aria-hidden="true">-{pct}%</span>
      <span className="sr-only">Descuento del {pct} por ciento</span>
    </span>
  );
}

/** Precio anterior tachado; no muestra nada si no hay descuento. */
export function PriceWas({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <span className={`text-tinta-suave line-through ${className}`}>
      <span className="sr-only">Antes </span>
      {formatMoney(value)}
    </span>
  );
}
