"use client";

import { useEffect, useState } from "react";

/** Hora actual, actualizada cada segundo (para las cuentas regresivas). */
export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}
