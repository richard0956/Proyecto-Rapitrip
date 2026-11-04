"use client";

import { useSyncExternalStore } from "react";
import { MOTION_CHANGE_EVENT, MOTION_KEY, motionReducedByChoice } from "./motion-preference";

function subscribe(onChange: () => void) {
  const fromStorage = (event: StorageEvent) => {
    if (event.key !== MOTION_KEY) return;
    if (event.newValue === "reducido") document.documentElement.dataset.motion = "reducido";
    else delete document.documentElement.dataset.motion;
    onChange();
  };
  window.addEventListener(MOTION_CHANGE_EVENT, onChange);
  window.addEventListener("storage", fromStorage);
  return () => {
    window.removeEventListener(MOTION_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", fromStorage);
  };
}

/** La elección actual de «Reducir animaciones» para el interruptor de Preferencias; también cambia si se toca en otra pestaña. En el servidor, `false`. */
export function useMotionReduced(): boolean {
  return useSyncExternalStore(subscribe, motionReducedByChoice, () => false);
}
