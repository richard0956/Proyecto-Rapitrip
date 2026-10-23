import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Los formularios se escriben tecla a tecla con user-event: con la máquina cargada superan los 5 s por defecto.
  test: { environment: "jsdom", setupFiles: ["./src/test-setup.ts"], testTimeout: 20_000 },
});
