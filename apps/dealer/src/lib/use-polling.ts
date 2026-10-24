"use client";

import { useEffect, useRef } from "react";

/**
 * Ejecuta `task` al montar, cada `intervalMs` mientras la pantalla está visible, y al volver a primer plano o recuperar la
 * conexión. Nunca solapa dos ejecuciones. Es el respaldo del push: la aplicación no depende de que el aviso llegue.
 */
export function usePolling(task: () => Promise<void> | void, intervalMs: number) {
  const taskRef = useRef(task);
  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    let running = false;
    let cancelled = false;
    const run = async () => {
      if (running || cancelled || document.visibilityState === "hidden") return;
      running = true;
      try {
        await taskRef.current();
      } finally {
        running = false;
      }
    };
    void run();
    const timer = setInterval(run, intervalMs);
    const onVisible = () => void run();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [intervalMs]);
}
