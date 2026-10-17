/** Resultado de una acción del cliente. `expired` avisa que la sesión venció y hay que volver a ingresar. */
export type CustomerResult = { ok: true; message?: string } | { ok: false; error: string; expired?: boolean };

export const expiredResult: CustomerResult = { ok: false, error: "Tu sesión venció. Ingresa de nuevo y conservamos lo que escribiste.", expired: true };
