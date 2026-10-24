"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { isAuthError } from "./api-error";

/** Si una llamada falla porque la sesión terminó, lleva al ingreso. Devuelve `true` cuando redirigió. */
export function useAuthGuard() {
  const router = useRouter();
  return useCallback(
    (error: { code?: string | null; message?: string | null } | null | undefined) => {
      if (!isAuthError(error)) return false;
      router.replace("/ingresar?expirada=1");
      return true;
    },
    [router],
  );
}
