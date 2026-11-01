import { ChartTable, defaultFormat } from "./chart-table";

export type DonutSlice = { label: string; value: number; color: string };

const SIZE = 160;
const STROKE = 22;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;
// Separación entre porciones (en unidades del trazo); con una sola porción el anillo queda entero.
const GAP = 3;

/** Dona con el total al centro y leyenda con valor y porcentaje (pedidos por estado). `color` es un color CSS, por ejemplo `var(--hoja)`. */
export function DonutChart({ items, ariaLabel, totalLabel = "Total", formatValue = defaultFormat }: { items: DonutSlice[]; ariaLabel: string; totalLabel?: string; formatValue?: (n: number) => string }) {
  const slices = items.filter((item) => item.value > 0);
  const total = slices.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <p className="py-6 text-center text-sm text-tinta-suave">Sin datos</p>;
  const gap = slices.length > 1 ? GAP : 0;
  let offset = 0;
  const arcs = slices.map((item) => {
    const length = (item.value / total) * C;
    const arc = { ...item, dash: Math.max(0.5, length - gap), offset };
    offset += length;
    return arc;
  });
  const percent = (value: number) => `${Math.round((value / total) * 100)} %`;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <div className="relative shrink-0">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={ariaLabel} className="block size-40">
          <g transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}>
            {arcs.map((arc, index) => (
              <circle
                key={`${arc.label}-${index}`}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${arc.dash.toFixed(2)} ${(C - arc.dash).toFixed(2)}`}
                strokeDashoffset={(-arc.offset).toFixed(2)}
                style={{ stroke: arc.color }}
              >
                <title>{`${arc.label}: ${formatValue(arc.value)} (${percent(arc.value)})`}</title>
              </circle>
            ))}
          </g>
        </svg>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold tabular-nums text-tinta">{formatValue(total)}</span>
          <span className="text-micro font-bold uppercase text-tinta-suave">{totalLabel}</span>
        </div>
      </div>
      <ul className="flex w-full min-w-0 flex-col gap-2">
        {arcs.map((arc, index) => (
          <li key={`${arc.label}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto_3rem] items-center gap-2.5 text-[13px]">
            <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: arc.color }} />
            <span className="truncate font-semibold text-tinta">{arc.label}</span>
            <span className="tabular-nums font-bold text-tinta">{formatValue(arc.value)}</span>
            <span className="text-right tabular-nums text-tinta-suave">{percent(arc.value)}</span>
          </li>
        ))}
      </ul>
      <ChartTable caption={ariaLabel} labels={arcs.map((arc) => arc.label)} series={[{ name: "Valor", values: arcs.map((arc) => arc.value) }]} formatValue={formatValue} />
    </div>
  );
}
