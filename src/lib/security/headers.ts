/**
 * Security response headers and Content-Security-Policy (Report-Only).
 *
 * Domains below were taken from actual usage in `src/` (fetch, next/image
 * remotePatterns, Mapbox, Supabase storage, Google avatars) plus Vercel
 * preview tooling. next/font self-hosts Google fonts at build time, so
 * fonts.googleapis.com / fonts.gstatic.com are not needed at runtime.
 * No nonces yet — that would force dynamic rendering for every page.
 */

/** CSP directive → allowed sources (joined with spaces when serialized). */
export const CSP_DIRECTIVES: Record<string, readonly string[]> = {
  "default-src": ["'self'"],
  // Next.js / React need unsafe-inline + unsafe-eval in classic SWC builds;
  // vercel.live is the Vercel preview feedback toolbar (injected on deploy).
  "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://vercel.live"],
  // Inline styles from Next + Mapbox GL CSS sometimes references api.mapbox.com.
  "style-src": ["'self'", "'unsafe-inline'", "https://api.mapbox.com"],
  // Place photos (Supabase Storage), Google OAuth avatars, Unsplash covers,
  // Mapbox sprites/icons; data/blob for QR canvases and local previews.
  "img-src": [
    "'self'",
    "data:",
    "blob:",
    "https://*.supabase.co",
    "https://lh3.googleusercontent.com",
    "https://images.unsplash.com",
    "https://api.mapbox.com",
    "https://*.tiles.mapbox.com",
  ],
  // next/font embeds as self; data: for any inline font URIs.
  "font-src": ["'self'", "data:"],
  // Supabase Auth/DB/Realtime, Mapbox geocoding + tiles + telemetry,
  // Vercel live preview websocket/API.
  "connect-src": [
    "'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://api.mapbox.com",
    "https://*.tiles.mapbox.com",
    "https://events.mapbox.com",
    "https://vercel.live",
  ],
  // Mapbox GL and qr-scanner spin blob: workers; same-origin SW workers.
  "worker-src": ["'self'", "blob:"],
  // MediaSource / blob frames used by camera / Mapbox internals.
  "child-src": ["blob:"],
  "frame-src": ["https://vercel.live"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
};

/** Serialize CSP_DIRECTIVES into a single header value. */
export function buildContentSecurityPolicy(
  directives: Record<string, readonly string[]> = CSP_DIRECTIVES
): string {
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(" ")}`)
    .join("; ");
}

/** Headers applied to every route via next.config `headers()`. */
export function securityHeaders(): { key: string; value: string }[] {
  return [
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "X-Frame-Options",
      value: "DENY",
    },
    {
      key: "Permissions-Policy",
      value:
        "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()",
    },
    {
      // Report-Only: observe violations without blocking. Flip to
      // Content-Security-Policy in a follow-up after preview/prod observation.
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(),
    },
  ];
}