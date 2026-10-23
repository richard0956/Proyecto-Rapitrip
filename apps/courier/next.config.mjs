const isProd = process.env.NODE_ENV === "production";

let supabaseOrigin = "";
try {
  supabaseOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").origin;
} catch {
  // Sin URL de Supabase la política queda sin ese origen; la app no arranca sin ella de todos modos.
}

/** Supabase recibe las llamadas de auth, datos y fotos. Las fotos se comprimen en el teléfono (blob:) antes de subirse. */
const csp = [
  "default-src 'self'",
  // Next inyecta scripts en línea (hidratación); en desarrollo además usa eval.
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseOrigin}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace(/^http/, "ws")}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
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
  // Se abre en http://127.0.0.1 (cookies y redirecciones de Supabase); sin esto Next bloquea la hidratación en desarrollo.
  allowedDevOrigins: ["127.0.0.1"],
  env: { NEXT_PUBLIC_AUTH_COOKIE_NAME: "rapitrip-courier-auth" },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Cámara y ubicación solo para esta aplicación: se usan al registrar la evidencia de la entrega.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=(), usb=()" },
          ...(isProd ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
        ],
      },
      {
        // El service worker debe poder actualizarse siempre y no puede quedar en una caché intermedia.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
