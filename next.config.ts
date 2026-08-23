import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compiler: {
    /**
     * Strip every console.* call from production builds (native Next.js
     * compiler transform, zero runtime overhead). Anything written to the
     * browser console is public information, so no error detail may ship —
     * even if a future console.error slips in somewhere. Dev builds keep
     * console output untouched.
     *
     * NOTE: the transform applies to server bundles too — server-side
     * console.error diagnostics (e.g. TMDB proxy routes) are also removed
     * from production.
     */
    removeConsole: process.env.NODE_ENV === "production",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
