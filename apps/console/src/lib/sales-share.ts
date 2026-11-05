/** Colores de las porciones por comercio (de mayor a menor venta); «Otros comercios» va en gris. */
// En oscuro `hoja` y `esmeralda` son el mismo verde: por eso el quinto es `rojo` y no `hoja`.
const shareColors = ["var(--esmeralda)", "var(--marino)", "var(--naranja)", "var(--durazno-texto)", "var(--rojo)"];

/**
 * Parte de las ventas de cada comercio: suma sus tiendas, deja los cinco que más venden y junta el resto en «Otros
 * comercios». El anillo muestra el monto y el porcentaje de cada uno.
 */
export function salesShare(
  byStore: { store_id: string | null; sales: number | null }[],
  stores: { id: string | null; commerce_id: string | null }[],
  commerces: { id: string | null; name: string | null }[],
) {
  const ownerOf = new Map(stores.flatMap((row) => (row.id && row.commerce_id ? [[row.id, row.commerce_id] as const] : [])));
  const nameOf = new Map(commerces.flatMap((row) => (row.id ? [[row.id, row.name ?? "Comercio"] as const] : [])));
  const totals = new Map<string, number>();
  for (const row of byStore) {
    const owner = (row.store_id && ownerOf.get(row.store_id)) ?? "sin-comercio";
    totals.set(owner, (totals.get(owner) ?? 0) + Number(row.sales ?? 0));
  }
  const ranked = [...totals.entries()].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]);
  const top = ranked.slice(0, shareColors.length).map(([id, value], index) => ({ label: nameOf.get(id) ?? "Comercio", value, color: shareColors[index]! }));
  const rest = ranked.slice(shareColors.length).reduce((total, [, value]) => total + value, 0);
  return rest > 0 ? [...top, { label: "Otros comercios", value: rest, color: "var(--bruma)" }] : top;
}
