import type { Config } from "tailwindcss";
import preset from "@rapitrip/ui/tailwind-preset";

export default {
  presets: [preset],
  // `dark:` sigue a `data-theme="dark"` en <html> (lo fija el script del <head>), igual que en la tienda.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;
