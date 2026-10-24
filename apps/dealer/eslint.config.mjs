import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    // Los logos son WebP ya optimizados, con tamaño declarado y servidos desde /brand: el optimizador de next/image no aporta.
    rules: { "@next/next/no-img-element": "off" },
  },
  globalIgnores([".next/**", "next-env.d.ts", "node_modules/**"]),
]);
