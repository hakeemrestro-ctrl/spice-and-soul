import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  redirects() {
    // Vercel handles HTTPS for the isolated UAT host. Never forward UAT requests
    // (including callback POST bodies) to the production canonical domain.
    if (process.env.BILLDESK_ENV === "UAT") return Promise.resolve([]);
    return Promise.resolve([
      {
        source: "/:path*",
        has: [{ type: "header", key: "x-forwarded-proto", value: "http" }],
        destination: "https://hakeemrestro.shop/:path*",
        permanent: true,
      },
    ]);
  },
  headers() {
    return Promise.resolve([
      {
        source: "/:path*",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ]);
  },
};

export default nextConfig;
