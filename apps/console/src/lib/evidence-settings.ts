import { z } from "zod";

/** Reglas de evidencia de las entregas (límites iguales a los de la base de datos). */
export const evidenceSettingsSchema = z.object({
  pickupPhoto: z.boolean(),
  deliveryPhoto: z.boolean(),
  pickupCode: z.boolean(),
  deliveryCode: z.boolean(),
  alertDistanceM: z.number().int().min(20).max(2000),
  retentionDays: z.number().int().min(7).max(365),
});
export type EvidenceSettings = z.infer<typeof evidenceSettingsSchema>;

/** Lo acordado con el negocio: todo obligatorio, alerta a 150 m y fotos 3 meses. */
export const defaultEvidenceSettings: EvidenceSettings = { pickupPhoto: true, deliveryPhoto: true, pickupCode: true, deliveryCode: true, alertDistanceM: 150, retentionDays: 90 };
