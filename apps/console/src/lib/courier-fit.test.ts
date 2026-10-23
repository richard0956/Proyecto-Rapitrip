import { describe, expect, it } from "vitest";
import { courierFits, toVehicleClass } from "./courier-fit";

const express = { deliveryClass: "express" as const, originDepartment: "managua" };
const programado = { deliveryClass: "programado" as const, originDepartment: "managua" };

describe("courierFits", () => {
  it("un express lo lleva cualquiera, incluso uno sin clasificar", () => {
    for (const vehicleClass of ["moto", "vehiculo", null] as const) expect(courierFits(express, { vehicleClass, department: null }).ok).toBe(true);
  });

  it("un programado exige vehículo", () => {
    expect(courierFits(programado, { vehicleClass: "moto", department: "managua" }).ok).toBe(false);
    expect(courierFits(programado, { vehicleClass: null, department: "managua" }).ok).toBe(false);
    expect(courierFits(programado, { vehicleClass: "vehiculo", department: "managua" }).ok).toBe(true);
  });

  it("y que trabaje en el departamento de la tienda", () => {
    const other = courierFits(programado, { vehicleClass: "vehiculo", department: "leon" });
    expect(other).toEqual({ ok: false, reason: "El repartidor debe trabajar en el departamento de la tienda." });
    expect(courierFits(programado, { vehicleClass: "vehiculo", department: null }).ok).toBe(false);
  });

  it("si la tienda aún no tiene departamento, no se exige", () => {
    expect(courierFits({ deliveryClass: "programado", originDepartment: null }, { vehicleClass: "vehiculo", department: null }).ok).toBe(true);
  });

  it("solo reconoce las dos clases de vehículo", () => {
    expect(toVehicleClass("moto")).toBe("moto");
    expect(toVehicleClass("vehiculo")).toBe("vehiculo");
    expect(toVehicleClass("camion")).toBeNull();
    expect(toVehicleClass(null)).toBeNull();
  });
});
