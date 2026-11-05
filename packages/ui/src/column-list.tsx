import { cn } from "./cn";
import { ChartTable, defaultFormat } from "./chart-table";

/**
 * Columnas verticales para un ranking corto (ventas por tienda): valor arriba, nombre abajo en hasta dos líneas con el nombre completo al pasar
 * el cursor (más `detail`, por ejemplo la tienda). La primera columna, la mayor, va en el verde de la marca; el resto en un tono más suave. Escala con `max(1, mayor valor)`.
 */
export function ColumnList({ items, ariaLabel, formatValue = defaultFormat }: { items: { label: string; value: number; detail?: string }[]; ariaLabel: string; formatValue?: (n: number) => string }) {
  if (items.length === 0) return <p className="py-6 text-center text-sm text-tinta-suave">Sin datos</p>;
  const max = Math.max(1, ...items.map((item) => item.value));
  const top = Math.max(...items.map((item) => item.value));
  return (
    <div>
      <ul aria-hidden="true" className="flex h-56 items-stretch gap-2 sm:gap-3">
        {items.map((item, index) => {
          const leader = item.value === top && item.value > 0;
          return (
            <li key={`${item.label}-${index}`} title={`${item.label}${item.detail ? ` · ${item.detail}` : ""}: ${formatValue(item.value)}`} className="flex min-w-0 flex-1 flex-col items-center gap-1.5 pt-6">
              <div className="relative flex w-full flex-1 items-end justify-center rounded-t-[10px] rounded-b-md bg-crema">
                <div
                  data-bar="y"
                  className={cn("w-full rounded-t-[10px] rounded-b-md transition-[height]", leader ? "bg-esmeralda" : "bg-bruma")}
                  style={{ height: `${Math.max(3, (Math.max(0, item.value) / max) * 100)}%` }}
                />
                <span
                  data-bar-label=""
                  className={cn("absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[12px] font-bold tabular-nums", leader ? "text-tinta" : "text-tinta-suave")}
                  style={{ bottom: `calc(${Math.max(3, (Math.max(0, item.value) / max) * 100)}% + 4px)` }}
                >
                  {formatValue(item.value)}
                </span>
              </div>
              <span className="line-clamp-2 h-8 w-full text-center text-[11.5px] font-semibold leading-4 text-tinta hyphens-auto [overflow-wrap:anywhere]">{item.label}</span>
            </li>
          );
        })}
      </ul>
      <ChartTable caption={ariaLabel} labels={items.map((item) => (item.detail ? `${item.label} · ${item.detail}` : item.label))} series={[{ name: "Valor", values: items.map((item) => item.value) }]} formatValue={formatValue} />
    </div>
  );
}
