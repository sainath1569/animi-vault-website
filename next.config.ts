import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Classic caching model: pages opt into ISR with `revalidate`, and all
  // upstream calls go through the in-memory cache in src/lib/cache.ts.
  cacheComponents: false,
  partialPrefetching: false,
  poweredByHeader: false,
  images: {
    // Posters come from several CDNs; resizing them on the app server would
    // cost more than it saves.
    unoptimized: true,
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    // Browsers request /favicon.ico regardless of <link rel="icon">.
    return [{ source: "/favicon.ico", destination: "/icon.svg" }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default nextConfig;
