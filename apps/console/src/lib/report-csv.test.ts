import { describe, expect, it } from "vitest";
import { toCsv } from "./report-csv";

const columns = [
  { key: "store", header: "Tienda" },
  { key: "total", header: "Total" },
];

describe("toCsv", () => {
  it("empieza con BOM y el encabezado, y separa filas con \r\n", () => {
    const csv = toCsv([{ store: "A", total: 10 }], columns);
    expect(csv.startsWith("\uFEFFTienda,Total\r\n")).toBe(true);
    expect(csv.endsWith("A,10\r\n")).toBe(true);
  });

  it("entrecomilla y duplica las comillas cuando el valor tiene coma o comilla", () => {
    expect(toCsv([{ store: 'Panadería "El Sol", S.A.', total: 1 }], columns)).toContain('"Panadería ""El Sol"", S.A.",1');
  });

  it("entrecomilla los saltos de línea", () => {
    expect(toCsv([{ store: "Calle 1\nCasa 2", total: 1 }], columns)).toContain('"Calle 1\nCasa 2",1');
  });

  it("neutraliza valores que Excel tomaría por fórmula", () => {
    for (const bad of ["=SUM(A1)", "+1", "-2+3", "@cmd"]) {
      expect(toCsv([{ store: bad, total: 1 }], columns)).toContain(`'${bad},1`);
    }
  });

  it("los números negativos no se confunden con fórmulas", () => {
    expect(toCsv([{ store: "A", total: -5 }], columns)).toContain("A,-5\r\n");
  });

  it("null sale vacío", () => {
    expect(toCsv([{ store: null, total: 2 }], columns)).toContain(",2\r\n");
  });
});
