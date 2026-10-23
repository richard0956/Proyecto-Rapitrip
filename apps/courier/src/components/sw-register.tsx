"use client";

import { useEffect } from "react";

/** Registra el service worker: recibe los avisos push y muestra una pantalla propia si se abre sin conexión. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Sin service worker la aplicación funciona igual; solo se pierden los avisos con la app cerrada.
    });
  }, []);
  return null;
}
