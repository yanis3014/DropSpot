import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

/**
 * Next.js 16 network boundary (ex-`middleware.ts`).
 * Refresh session Supabase + garde les routes privées.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - sw.js, workbox-*, manifest (PWA files)
     * - common image/font extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|sw.js|workbox-.*|manifest\\.json|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|ico)$).*)',
  ],
};
