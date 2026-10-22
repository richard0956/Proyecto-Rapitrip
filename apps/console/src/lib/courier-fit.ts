import type { DeliveryClass } from "./delivery-class";

export type VehicleClass = "moto" | "vehiculo";
export type CourierInfo = { id: string; name: string; vehicleType: string; vehicleClass: VehicleClass | null; department: string | null };

export const toVehicleClass = (value: string | null | undefined): VehicleClass | null => (value === "moto" || value === "vehiculo" ? value : null);

export type CourierFit = { ok: true } | { ok: false; reason: string };

/**
 * ¿Puede este repartidor llevar este pedido? Misma regla que `assign_order_courier` en la base de datos (que es quien manda):
 * un express lo lleva cualquiera (moto, vehículo o uno aún sin clasificar); un programado, solo un vehículo que trabaje en el
 * departamento de la tienda (si la tienda ya tiene departamento).
 */
export function courierFits(order: { deliveryClass: DeliveryClass; originDepartment: string | null }, courier: Pick<CourierInfo, "vehicleClass" | "department">): CourierFit {
  if (order.deliveryClass !== "programado") return { ok: true };
  if (courier.vehicleClass !== "vehiculo") return { ok: false, reason: "Un pedido programado solo lo lleva un repartidor con vehículo." };
  if (order.originDepartment && courier.department !== order.originDepartment) return { ok: false, reason: "El repartidor debe trabajar en el departamento de la tienda." };
  return { ok: true };
}
