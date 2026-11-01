"use client";

import { useSyncExternalStore } from "react";

/** App de mapas que abren los botones «Cómo llegar». */
export type MapsApp = "google" | "waze" | "apple";

/** Preferencias del repartidor en este teléfono (no van a la base de datos: cada teléfono tiene las suyas). */
export type CourierPrefs = {
  /** App de mapas para «Cómo llegar». */
  maps: MapsApp;
  /** Sonar y vibrar cuando llega una propuesta con la app abierta. */
  alert: boolean;
  /** Mantener la pantalla encendida mientras está disponible o con un pedido abierto. */
  awake: boolean;
};

export const PREFS_KEY = "rapitrip:repartidor";
const CHANGE_EVENT = "rapitrip:repartidor-cambio";
export const defaultPrefs: CourierPrefs = { maps: "google", alert: true, awake: true };

/** Lee lo guardado sin confiar en su forma: un valor raro vuelve al predeterminado de ese campo. */
export function parsePrefs(raw: string | null): CourierPrefs {
  let value: Partial<Record<keyof CourierPrefs, unknown>> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") value = parsed as typeof value;
  } catch {
    // Texto dañado: se usan los predeterminados.
  }
  return {
    maps: value.maps === "waze" || value.maps === "apple" || value.maps === "google" ? value.maps : defaultPrefs.maps,
    alert: typeof value.alert === "boolean" ? value.alert : defaultPrefs.alert,
    awake: typeof value.awake === "boolean" ? value.awake : defaultPrefs.awake,
  };
}

// `useSyncExternalStore` necesita la misma referencia mientras no cambie lo guardado.
let cachedRaw: string | null | undefined;
let cached: CourierPrefs = defaultPrefs;

function read(): CourierPrefs {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFS_KEY);
  } catch {
    // Sin almacenamiento (modo privado estricto): predeterminados.
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parsePrefs(raw);
  }
  return cached;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Las preferencias actuales; se actualiza al cambiarlas aquí o en otra pestaña. En el servidor, los predeterminados. */
export function usePrefs(): CourierPrefs {
  return useSyncExternalStore(subscribe, read, () => defaultPrefs);
}

export function setPref<K extends keyof CourierPrefs>(key: K, value: CourierPrefs[K]) {
  const next = { ...read(), [key]: value };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    // Sin almacenamiento la preferencia no se puede recordar.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
