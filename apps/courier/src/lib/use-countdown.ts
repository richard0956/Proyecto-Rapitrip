"use client";

import { useEffect, useState } from "react";
import { secondsLeft } from "./offers";

/** Segundos que faltan para `expiresAt`, actualizados cada segundo. */
export function useCountdown(expiresAt: string | null | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return secondsLeft(expiresAt, now);
}
