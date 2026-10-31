import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";
import { securityHeaders } from "./src/lib/security/headers";

/**
 * Account-related shells: never cache HTML, RSC payloads, or Server Actions.
 * Exact path or any nested segment (e.g. `/profile/grains`, `/admin/cafes`).
 */
const PRIVATE_PATH_PREFIXES = [
  "/profile",
  "/dashboard-pro",
  "/etablissement",
  "/specificites",
  "/reglages",
  "/valider",
  "/equipe",
  "/abonnement",
  "/admin",
  "/onboarding",
] as const;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Workbox serializes `urlPattern` into `public/sw.js` (no closures).
 * A RegExp is self-contained. The SW only controls this origin, so host
 * matching is enough; query (`?_rsc=`) and POST Server Actions share the path.
 */
const PRIVATE_PATH_URL_PATTERN = new RegExp(
  `^https?://[^/]+(?:${PRIVATE_PATH_PREFIXES.map(escapeRegex).join("|")})(?:[/?#]|$)`
);

const nextConfig: NextConfig = {
  transpilePackages: ['react-map-gl', 'mapbox-gl'],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders(),
      },
    ];
  },
  async redirects() {
    return [
      { source: '/gamification', destination: '/profile', permanent: true },
      { source: '/saved', destination: '/list?filters=favorites', permanent: false },
      {
        source: '/dashboard-pro/settings',
        destination: '/etablissement',
        permanent: true,
      },
      {
        source: '/dashboard-pro/validate',
        destination: '/valider',
        permanent: true,
      },
      {
        source: '/dashboard-pro/validate/:path*',
        destination: '/valider',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // `$` = exact match, so subpaths like mapbox-gl/dist/mapbox-gl.css still resolve.
      'mapbox-gl$': 'mapbox-gl/dist/mapbox-gl.js',
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
      // Must stay first: Workbox uses the first matching route (GET + POST).
      {
        urlPattern: PRIVATE_PATH_URL_PATTERN,
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "private-pages" },
      },
      {
        urlPattern: PRIVATE_PATH_URL_PATTERN,
        handler: "NetworkOnly",
        method: "POST",
        options: { cacheName: "private-pages" },
      },
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
