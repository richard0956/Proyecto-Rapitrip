export type CsvColumn = { key: string; header: string };

/** Excel y Hojas de cálculo ejecutan como fórmula una celda de texto que empieza por estos caracteres. */
const formulaStart = /^[=+\-@\t\r]/;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // Solo el texto se neutraliza: un número negativo de verdad (-5) es un número, no una fórmula.
  if (typeof value === "string" && formulaStart.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV para Excel: BOM inicial (acentos), coma como separador y `\r\n` entre filas. */
export function toCsv(rows: Record<string, string | number | null | undefined>[], columns: CsvColumn[]): string {
  const lines = [columns.map((column) => cell(column.header)).join(","), ...rows.map((row) => columns.map((column) => cell(row[column.key])).join(","))];
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
