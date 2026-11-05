import { describe, expect, it } from "vitest";
import { salesShare } from "./sales-share";

const stores = [
  { id: "t1", commerce_id: "a" },
  { id: "t2", commerce_id: "a" },
  { id: "t3", commerce_id: "b" },
  ...["c", "d", "e", "f", "g"].map((c) => ({ id: `t-${c}`, commerce_id: c })),
];
const commerces = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id, name: `Comercio ${id.toUpperCase()}` }));

describe("ventas por comercio", () => {
  it("suma las tiendas de cada comercio y los ordena de mayor a menor", () => {
    const slices = salesShare([{ store_id: "t1", sales: 100 }, { store_id: "t2", sales: 50 }, { store_id: "t3", sales: 300 }], stores, commerces);
    expect(slices.map((s) => [s.label, s.value])).toEqual([["Comercio B", 300], ["Comercio A", 150]]);
    expect(slices[0]!.color).toBe("var(--esmeralda)");
  });

  it("deja cinco comercios y junta el resto en «Otros comercios»; los que no vendieron no aparecen", () => {
    const sales = [{ store_id: "t1", sales: 700 }, { store_id: "t3", sales: 600 }, ...["c", "d", "e", "f", "g"].map((c, i) => ({ store_id: `t-${c}`, sales: 500 - i * 100 })), { store_id: "t2", sales: 0 }];
    const slices = salesShare(sales, stores, commerces);
    expect(slices).toHaveLength(6);
    expect(slices.at(-1)).toEqual({ label: "Otros comercios", value: 200 + 100, color: "var(--bruma)" });
  });
});
