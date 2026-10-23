import { ChartTable, defaultFormat } from "./chart-table";

const W = 600;
const H = 170;
const TOP = 14;
const BOTTOM = 142;

/** Barras verticales (por ejemplo pedidos por día). Escala con `max(1, mayor valor)`. */
export function BarChart({ labels, values, formatValue = defaultFormat, ariaLabel }: { labels: string[]; values: number[]; formatValue?: (n: number) => string; ariaLabel: string }) {
  if (labels.length === 0) return <p className="py-8 text-center text-sm text-tinta-suave">Sin datos en este periodo</p>;
  const max = Math.max(1, ...values);
  const slot = W / labels.length;
  const barW = Math.min(46, slot * 0.62);
  const step = Math.max(1, Math.ceil(labels.length / 10));
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block h-auto w-full">
        <line x1="0" x2={W} y1={BOTTOM} y2={BOTTOM} style={{ stroke: "var(--borde)" }} />
        {labels.map((label, i) => {
          const value = values[i] ?? 0;
          const h = (Math.max(0, value) / max) * (BOTTOM - TOP);
          const cx = slot * i + slot / 2;
          return (
            <g key={`${label}-${i}`}>
              <rect x={cx - barW / 2} y={BOTTOM - h} width={barW} height={h} rx="4" style={{ fill: "var(--esmeralda)" }}>
                <title>{`${label}: ${formatValue(value)}`}</title>
              </rect>
              {i % step === 0 ? (
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="12" style={{ fill: "var(--tinta-suave)" }}>
                  {label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ChartTable caption={ariaLabel} labels={labels} series={[{ name: "Valor", values }]} formatValue={formatValue} />
    </div>
  );
}
