/** Filtros del catálogo: se leen de la URL (la página es del servidor y se puede compartir) y se vuelven a escribir en ella. */
export type CommerceKind = "informal" | "empresa";
export type CatalogSort = "nombre" | "precio_asc" | "precio_desc" | "recientes" | "descuento" | "vendidos";

export const SORT_OPTIONS: { value: CatalogSort; label: string }[] = [
  { value: "nombre", label: "Nombre (A–Z)" },
  { value: "precio_asc", label: "Precio: menor a mayor" },
  { value: "precio_desc", label: "Precio: mayor a menor" },
  { value: "recientes", label: "Más recientes" },
  { value: "descuento", label: "Mayor descuento" },
  { value: "vendidos", label: "Más vendidos" },
];

export const KIND_OPTIONS: { value: CommerceKind | null; label: string }[] = [
  { value: null, label: "Todos" },
  { value: "informal", label: "Vendedor propio" },
  { value: "empresa", label: "Empresa" },
];

export const kindLabel = (kind: string | null | undefined) => (kind === "empresa" ? "Empresa" : "Vendedor propio");

export type CatalogFilters = {
  q: string | null;
  categoria: string | null;
  tienda: string | null;
  min: number | null;
  max: number | null;
  orden: CatalogSort;
  tipo: CommerceKind | null;
  abiertas: boolean;
  /** Solo productos con descuento. */
  descuento: boolean;
  pagina: number;
};

type Params = Record<string, string | string[] | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

function uuid(value: string | string[] | undefined) {
  const text = first(value)?.trim();
  return text && UUID.test(text) ? text : null;
}

/** Precio en córdobas: un número entre 0 y 99 999 999; cualquier otra cosa se ignora. */
function price(value: string | string[] | undefined) {
  const text = first(value)?.trim().replace(",", ".");
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 && n <= 99_999_999 ? Math.round(n * 100) / 100 : null;
}

export function parseFilters(params: Params): CatalogFilters {
  const q = first(params.q)?.trim().slice(0, 80) || null;
  const orden = SORT_OPTIONS.find((o) => o.value === first(params.orden))?.value ?? "nombre";
  const tipo = first(params.tipo) === "empresa" ? "empresa" : first(params.tipo) === "informal" ? "informal" : null;
  const page = Number(first(params.pagina));
  let min = price(params.min);
  let max = price(params.max);
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return {
    q,
    categoria: uuid(params.categoria),
    tienda: uuid(params.tienda),
    min,
    max,
    orden,
    tipo,
    abiertas: first(params.abiertas) === "1",
    descuento: first(params.descuento) === "1",
    pagina: Number.isInteger(page) && page >= 1 && page <= 1000 ? page : 1,
  };
}

/** Dirección del catálogo con los filtros dados. Lo que vale lo mismo que el valor por omisión no se escribe. */
export function filtersHref(base: string, filters: CatalogFilters, changes: Partial<CatalogFilters> = {}) {
  const f = { ...filters, ...changes };
  const search = new URLSearchParams();
  if (f.q) search.set("q", f.q);
  if (f.categoria) search.set("categoria", f.categoria);
  if (f.tienda) search.set("tienda", f.tienda);
  if (f.min !== null) search.set("min", String(f.min));
  if (f.max !== null) search.set("max", String(f.max));
  if (f.orden !== "nombre") search.set("orden", f.orden);
  if (f.tipo) search.set("tipo", f.tipo);
  if (f.abiertas) search.set("abiertas", "1");
  if (f.descuento) search.set("descuento", "1");
  if (f.pagina > 1) search.set("pagina", String(f.pagina));
  const text = search.toString();
  return text ? `${base}?${text}` : base;
}

/** Cuántos filtros (sin contar el orden ni la página) hay activos. */
export function activeFilterCount(f: CatalogFilters) {
  const active = [f.q !== null, f.categoria !== null, f.tienda !== null, f.min !== null, f.max !== null, f.tipo !== null, f.abiertas, f.descuento];
  return active.filter(Boolean).length;
}
