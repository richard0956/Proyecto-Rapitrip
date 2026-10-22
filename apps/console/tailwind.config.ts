import type { Config } from "tailwindcss";
import preset from "@rapitrip/ui/tailwind-preset";

export default {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}", "../../packages/maps/src/**/*.{ts,tsx}"],
} satisfies Config;
