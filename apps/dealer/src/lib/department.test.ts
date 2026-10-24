import { describe, expect, it } from "vitest";
import { departmentName } from "./department";

describe("departmentName", () => {
  it("usa el nombre con acentos", () => {
    expect(departmentName("leon")).toBe("León");
    expect(departmentName("rio_san_juan")).toBe("Río San Juan");
    expect(departmentName("raccn")).toBe("Costa Caribe Norte");
  });
  it("un código desconocido se muestra legible; vacío no muestra nada", () => {
    expect(departmentName("nueva_zona")).toBe("Nueva zona");
    expect(departmentName(null)).toBe("");
  });
});
