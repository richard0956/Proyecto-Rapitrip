import { cn } from "./cn";
import { defaultFormat } from "./chart-table";

/** Barras horizontales con etiqueta y valor (ventas por tienda, productos más vendidos, pedidos por etapa). */
export function HBarList({ items, formatValue = defaultFormat }: { items: { label: string; value: number; tone?: "hoja" | "marino" }[]; formatValue?: (n: number) => string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-tinta-suave">Sin datos</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-[13px]">
          <span className="truncate font-semibold text-tinta">{item.label}</span>
          <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full bg-menta">
            <span className={cn("block h-full rounded-full", item.tone === "marino" ? "bg-marino" : "bg-esmeralda")} style={{ width: `${Math.max(2, (Math.max(0, item.value) / max) * 100)}%` }} />
          </span>
          <span className="tabular-nums text-tinta-suave">{formatValue(item.value)}</span>
        </li>
      ))}
    </ul>
  );
}
