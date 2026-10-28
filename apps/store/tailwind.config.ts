import type { Config } from "tailwindcss";
import preset from "@rapitrip/ui/tailwind-preset";

export default {
  presets: [preset],
  // `dark:` responde al tema elegido (data-theme en <html>), no solo a la preferencia del sistema.
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}", "../../packages/maps/src/**/*.{ts,tsx}"],
} satisfies Config;
