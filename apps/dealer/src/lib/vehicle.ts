import type { CourierMe } from "./types";

const labels: Record<string, string> = { moto: "Moto", vehiculo: "Vehículo" };

/** Cómo se nombra el vehículo del repartidor: la clase si la tiene; si no, el tipo que anotó coordinación. */
export function vehicleLabel(me: Pick<CourierMe, "vehicle_class" | "vehicle_type"> | null | undefined): string | null {
  if (!me) return null;
  return (me.vehicle_class ? labels[me.vehicle_class] : null) ?? me.vehicle_type ?? null;
}
