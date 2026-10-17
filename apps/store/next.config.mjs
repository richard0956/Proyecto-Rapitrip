const isProd = process.env.NODE_ENV === "production";

let supabaseOrigin = "";
try {
  supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
} catch {
  // Sin URL de Supabase la política queda sin ese origen; la app no arranca sin ella de todos modos.
}

/** Turnstile carga su script y su iframe desde Cloudflare; Supabase recibe las llamadas de auth y datos. */
const csp = [
  "default-src 'self'",
  // Next inyecta scripts en línea (hidratación y la introducción); en desarrollo además usa eval.
  `script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")} https://challenges.cloudflare.com`.trim(),
  "frame-src https://challenges.cloudflare.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ["upgrade-insecure-requests"] : []),
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rapitrip/ui", "@rapitrip/supabase", "@rapitrip/validation", "@rapitrip/db-types"],
  poweredByHeader: false,
  // Se abre en http://127.0.0.1 (cookies y redirecciones de Supabase); sin esto Next bloquea la hidratación en desarrollo y los botones no responden.
  allowedDevOrigins: ["127.0.0.1"],
  env: { NEXT_PUBLIC_AUTH_COOKIE_NAME: "rapitrip-store-auth" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
};

export default nextConfig;
