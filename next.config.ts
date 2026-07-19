import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const cspDirectives = isProduction
  ? [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com",
      "img-src 'self' blob: data: https://*.supabase.co https://image.tmdb.org",
       "frame-ancestors 'none'",
       "frame-src blob:",
     ].join("; ")
   : [
       // Development CSP is intentionally relaxed for Next.js dev runtime/HMR.
       "default-src 'self'",
       "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
       "style-src 'self' 'unsafe-inline'",
       "connect-src 'self' https://*.supabase.co https://*.r2.cloudflarestorage.com ws://localhost:3000",
       "img-src 'self' blob: data: https://*.supabase.co https://image.tmdb.org",
       "frame-ancestors 'none'",
       "frame-src blob:",
     ].join("; ");

const nextConfig: NextConfig = {
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
          { key: "Content-Security-Policy", value: cspDirectives },
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
