import { normalizeText } from "./directory";

export type CourierStat = {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  status: "activo" | "inactivo";
  since: string;
  /** Entregas, kilómetros de esas entregas y tiempo promedio «en camino» → «entregado» en el periodo. */
  deliveries: number;
  km: number;
  avgMinutes: number | null;
  /** Pedidos asignados que siguen en curso y efectivo cobrado que caja aún no recibe. */
  activeOrders: number;
  cashPending: number;
  cashPendingOrders: number;
};

export type CourierFilters = { query: string; status: "todos" | "activo" | "inactivo" };

/** Busca por nombre, teléfono o vehículo (sin acentos) y filtra por estado. */
export function filterCouriers(rows: CourierStat[], { query, status }: CourierFilters): CourierStat[] {
  const needle = normalizeText(query);
  return rows.filter((row) => {
    if (status !== "todos" && row.status !== status) return false;
    return needle === "" || [row.name, row.phone, row.vehicle].some((text) => normalizeText(text).includes(needle));
  });
}

export function courierCounts(rows: CourierStat[]) {
  return { todos: rows.length, activo: rows.filter((row) => row.status === "activo").length, inactivo: rows.filter((row) => row.status === "inactivo").length };
}

/** Los mejores del periodo. «rapidez» es el menor tiempo promedio entre quienes tienen entregas medidas. */
export function rankCouriers(rows: CourierStat[], by: "entregas" | "km" | "rapidez", limit = 3): CourierStat[] {
  const byName = (a: CourierStat, b: CourierStat) => a.name.localeCompare(b.name, "es");
  if (by === "rapidez") return rows.filter((row) => row.deliveries > 0 && row.avgMinutes !== null).sort((a, b) => (a.avgMinutes ?? 0) - (b.avgMinutes ?? 0) || byName(a, b)).slice(0, limit);
  if (by === "km") return rows.filter((row) => row.km > 0).sort((a, b) => b.km - a.km || byName(a, b)).slice(0, limit);
  return rows.filter((row) => row.deliveries > 0).sort((a, b) => b.deliveries - a.deliveries || byName(a, b)).slice(0, limit);
}

export function courierTotals(rows: CourierStat[]) {
  return {
    deliveries: rows.reduce((total, row) => total + row.deliveries, 0),
    km: rows.reduce((total, row) => total + row.km, 0),
    active: rows.reduce((total, row) => total + row.activeOrders, 0),
    cashPending: rows.reduce((total, row) => total + row.cashPending, 0),
    couriers: rows.filter((row) => row.status === "activo").length,
  };
}

const km = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });
export const formatKm = (value: number) => `${km.format(value)} km`;

export function formatMinutes(value: number | null): string {
  if (value === null) return "—";
  const total = Math.round(value);
  return total >= 60 ? `${Math.floor(total / 60)} h ${total % 60} min` : `${total} min`;
}
