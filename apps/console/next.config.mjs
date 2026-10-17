/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rapitrip/ui", "@rapitrip/supabase", "@rapitrip/validation", "@rapitrip/db-types"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
