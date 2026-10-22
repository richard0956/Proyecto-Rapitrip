import { failure, isSessionExpired } from "@rapitrip/supabase";
import type { serverSupabase } from "@/lib/supabase";

type Supabase = Awaited<ReturnType<typeof serverSupabase>>;

export type DepartmentOfPoint = { ok: true; department: string } | { ok: false; error: string; expired?: boolean };

/**
 * Departamento de un punto del mapa. El cliente ya no lo elige: la base de datos lo deduce del pin (`department_for_point`)
 * y con él decide si el envío es express o programado. Un punto fuera de Nicaragua no tiene departamento.
 */
export async function departmentOfPoint(supabase: Supabase, latitude: number, longitude: number, expiredMessage: string): Promise<DepartmentOfPoint> {
  const { data, error } = await supabase.rpc("department_for_point", { p_latitude: latitude, p_longitude: longitude });
  if (isSessionExpired(error)) return { ok: false, error: expiredMessage, expired: true };
  if (error) {
    const result = failure(error);
    return { ok: false, error: result.ok ? "No pudimos ubicar tu punto de entrega." : result.error };
  }
  if (!data) return { ok: false, error: "El punto marcado está fuera de Nicaragua. Muévelo a tu dirección de entrega." };
  return { ok: true, department: data };
}
