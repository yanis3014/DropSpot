import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {
  transpilePackages: ['react-map-gl', 'mapbox-gl'],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      'mapbox-gl': 'mapbox-gl/dist/mapbox-gl.js',
    };
    return config;
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // Auth/session: start URL HTML varies (guest vs signed-in).
  cacheStartUrl: true,
  dynamicStartUrl: true,
  // Never serve stale Supabase auth or API responses from the SW cache.
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "supabase-api" },
      },
      {
        urlPattern: ({ url, sameOrigin }: { url: URL; sameOrigin: boolean }) =>
          sameOrigin && url.pathname.startsWith("/auth/"),
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "auth-routes" },
      },
    ],
  },
  publicExcludes: ["!icons/icon.svg"],
})(nextConfig);
