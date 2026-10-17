import { defineConfig, devices } from "@playwright/test";

const ci = Boolean(process.env.CI);

/** Variables públicas de las apps. Sin backend (solo accesibilidad) bastan los valores de relleno. */
const env = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "http://127.0.0.1:54321",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "anon-placeholder",
  NEXT_PUBLIC_SITE_URL: "",
};

/** En CI las apps ya vienen compiladas (`pnpm build`); en local se usa `dev` para no compilar antes de cada prueba. */
const serve = (app: string) => `pnpm --filter @rapitrip/${app} ${ci ? "start" : "dev"}`;

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: ci ? 1 : 0,
  reporter: ci ? [["github"], ["html", { open: "never" }]] : [["list"]],
  // Con "reducir movimiento" no hay introducción ni animaciones: las pruebas funcionales no esperan a la cortina de marca.
  // Las pruebas de movimiento (tests/motion.spec.ts) piden `no-preference` explícitamente.
  use: { trace: "retain-on-failure", screenshot: "only-on-failure", locale: "es", timezoneId: "America/Managua", contextOptions: { reducedMotion: "reduce" } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: serve("console"), url: "http://localhost:3001/login", env, reuseExistingServer: !ci, timeout: 180_000 },
    { command: serve("store"), url: "http://localhost:3000/ingresar", env, reuseExistingServer: !ci, timeout: 180_000 },
  ],
});
