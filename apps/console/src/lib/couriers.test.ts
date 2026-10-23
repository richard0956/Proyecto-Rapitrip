import { describe, expect, it } from "vitest";
import { courierCounts, courierTotals, filterCouriers, formatKm, formatMinutes, rankCouriers, type CourierStat } from "./couriers";

const base: CourierStat = { id: "1", name: "Carlos Núñez", phone: "8888-0001", vehicle: "Moto", status: "activo", since: "1 oct", deliveries: 0, km: 0, avgMinutes: null, activeOrders: 0, cashPending: 0, cashPendingOrders: 0 };
const rows: CourierStat[] = [
  { ...base, deliveries: 12, km: 40.5, avgMinutes: 35 },
  { ...base, id: "2", name: "María López", phone: "8888-0002", vehicle: "Camioneta", deliveries: 20, km: 25, avgMinutes: 50, activeOrders: 2, cashPending: 400, cashPendingOrders: 2 },
  { ...base, id: "3", name: "Pedro Gómez", status: "inactivo", deliveries: 3, km: 90, avgMinutes: 20 },
  { ...base, id: "4", name: "Sin pedidos" },
];

describe("repartidores", () => {
  it("busca por nombre, teléfono o vehículo sin importar acentos", () => {
    expect(filterCouriers(rows, { query: "nunez", status: "todos" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterCouriers(rows, { query: "0002", status: "todos" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterCouriers(rows, { query: "camioneta", status: "todos" }).map((r) => r.id)).toEqual(["2"]);
  });

  it("filtra por estado y cuenta para las píldoras", () => {
    expect(filterCouriers(rows, { query: "", status: "inactivo" }).map((r) => r.id)).toEqual(["3"]);
    expect(courierCounts(rows)).toEqual({ todos: 4, activo: 3, inactivo: 1 });
  });

  it("ordena a los mejores por entregas, por kilómetros y por rapidez", () => {
    expect(rankCouriers(rows, "entregas", 3).map((r) => r.id)).toEqual(["2", "1", "3"]);
    expect(rankCouriers(rows, "km", 2).map((r) => r.id)).toEqual(["3", "1"]);
    expect(rankCouriers(rows, "rapidez", 3).map((r) => r.id)).toEqual(["3", "1", "2"]);
  });

  it("no pone en el ranking a quien no tiene actividad ni tiempo medido", () => {
    expect(rankCouriers(rows, "entregas", 10).map((r) => r.id)).not.toContain("4");
    expect(rankCouriers([{ ...base, deliveries: 2, avgMinutes: null }], "rapidez", 3)).toEqual([]);
  });

  it("suma los totales de la flota", () => {
    expect(courierTotals(rows)).toEqual({ deliveries: 35, km: 155.5, active: 2, cashPending: 400, couriers: 3 });
  });

  it("da formato a kilómetros y minutos", () => {
    expect(formatKm(40.5)).toMatch(/^40[,.]5 km$/);
    expect(formatKm(0)).toBe("0 km");
    expect(formatMinutes(35)).toBe("35 min");
    expect(formatMinutes(null)).toBe("—");
    expect(formatMinutes(95)).toBe("1 h 35 min");
  });
});
