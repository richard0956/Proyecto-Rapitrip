import { ChartTable, defaultFormat } from "./chart-table";

const strokes = { hoja: "var(--hoja)", marino: "var(--marino)", gris: "var(--tinta-suave)" } as const;

export type LineSeries = { name: string; tone: keyof typeof strokes; dashed?: boolean; values: number[] };

const W = 720;
const H = 200;
const LEFT = 64;
const RIGHT = 14;
const TOP = 14;
const BOTTOM = 168;

/** Gráfico de líneas con rejilla; la primera serie lleva relleno suave. Escala con `max(1, mayor valor)`: nunca divide entre cero. */
export function LineChart({ series, labels, formatValue = defaultFormat, ariaLabel }: { series: LineSeries[]; labels: string[]; formatValue?: (n: number) => string; ariaLabel: string }) {
  if (labels.length === 0 || series.length === 0 || series.every((s) => s.values.every((v) => v === 0))) return <p className="py-8 text-center text-sm text-tinta-suave">Sin datos en este periodo</p>;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const count = labels.length;
  const x = (i: number) => (count === 1 ? (LEFT + W - RIGHT) / 2 : LEFT + (i * (W - RIGHT - LEFT)) / (count - 1));
  const y = (v: number) => BOTTOM - (Math.max(0, v) / max) * (BOTTOM - TOP);
  const points = (values: number[]) => values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const step = Math.max(1, Math.ceil(count / 8));
  // Con máximos pequeños (3 unidades) los cuartos se redondean al mismo entero: se quitan las repetidas.
  const tickValues = [...new Set([0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t)))];
  const main = series[0]!;

  return (
    <div>
      <div className="overflow-x-auto" tabIndex={0} role="group" aria-label={`${ariaLabel} (se desplaza con las flechas)`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} className="block h-auto w-full min-w-[560px]">
        {tickValues.map((value) => (
          <g key={value}>
            <line x1={LEFT} x2={W - RIGHT} y1={y(value)} y2={y(value)} style={{ stroke: "var(--borde)" }} />
            <text x={LEFT - 6} y={y(value) + 3} textAnchor="end" fontSize="12" style={{ fill: "var(--tinta-suave)" }}>
              {formatValue(value)}
            </text>
          </g>
        ))}
        {labels.map((label, i) =>
          i % step === 0 ? (
            <text key={`${label}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="12" style={{ fill: "var(--tinta-suave)" }}>
              {label}
            </text>
          ) : null,
        )}
        {main.values.length > 1 ? <polygon points={`${points(main.values)} ${x(main.values.length - 1)},${BOTTOM} ${x(0)},${BOTTOM}`} style={{ fill: strokes[main.tone], opacity: 0.12 }} /> : null}
        {series.map((s) => (
          <polyline key={s.name} points={points(s.values)} fill="none" strokeWidth={s.dashed ? 2 : 3} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "5 4" : undefined} style={{ stroke: strokes[s.tone] }} />
        ))}
        {main.values.length > 0 ? <circle cx={x(main.values.length - 1)} cy={y(main.values[main.values.length - 1] ?? 0)} r="4.5" strokeWidth="2" style={{ fill: strokes[main.tone], stroke: "var(--papel)" }} /> : null}
      </svg>
      </div>
      {series.length > 1 ? (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-tinta-suave">
          {series.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-[3px] w-4 rounded" style={{ background: strokes[s.tone] }} />
              {s.name}
            </li>
          ))}
        </ul>
      ) : null}
      <ChartTable caption={ariaLabel} labels={labels} series={series} formatValue={formatValue} />
    </div>
  );
}
