/** Los mismos datos del gráfico en una tabla solo para lectores de pantalla. */
export function ChartTable({ caption, labels, series, formatValue }: { caption: string; labels: string[]; series: { name: string; values: number[] }[]; formatValue: (n: number) => string }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Punto</th>
          {series.map((s) => (
            <th key={s.name} scope="col">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {labels.map((label, i) => (
          <tr key={`${label}-${i}`}>
            <th scope="row">{label}</th>
            {series.map((s) => (
              <td key={s.name}>{formatValue(s.values[i] ?? 0)}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const defaultFormat = (n: number) => new Intl.NumberFormat("es").format(n);
