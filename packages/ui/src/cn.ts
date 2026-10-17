import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** `tailwind-merge` no conoce los tamaños y radios propios del sistema: sin esto confunde `text-micro` con un color y lo descarta. */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: ["micro", "cuerpo"] }],
      rounded: [{ rounded: ["campo", "boton", "panel", "tarjeta"] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
