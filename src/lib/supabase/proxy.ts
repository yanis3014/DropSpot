import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  isProGatedPath,
  parseProAccessStatus,
  proGateRedirect,
} from '@/lib/pro/accessStatus';

/**
 * Routes accessibles uniquement avec une session Supabase valide.
 * Les pages publiques (`/map`, `/list`, `/drops`, `/login`, `/onboarding`)
 * restent ouvertes : les envies se choisissent avant le compte.
 */
const PROTECTED_PREFIXES = [
  '/profile',
  '/dashboard-pro',
  '/etablissement',
  '/specificites',
  '/equipe',
  '/abonnement',
  '/reglages',
  '/valider',
  '/statistiques',
  '/admin',
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * On private routes, refreshes the Supabase auth session and keeps the
 * auth cookies in sync between the browser, Server Components and
 * Route Handlers. This is the Supabase SSR pattern for Next.js 16 `proxy`.
 *
 * Also redirects unauthenticated users away from private routes.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Public pages read the session in the browser only (the browser client
  // refreshes its own token), so skip the Supabase Auth round trip there:
  // it ran on every navigation and every <Link> prefetch.
  if (!isProtectedPath(request.nextUrl.pathname)) {
    return supabaseResponse;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // IMPORTANT: do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    // Keep the query (`?cafe=`, invitation params…) so the user lands on the
    // exact page after signing in.
    loginUrl.search = '';
    loginUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
    const redirectResponse = NextResponse.redirect(loginUrl);
    // Forward refreshed auth cookies onto the redirect response
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  // Pro space: only once an admin approved the café. A café owner whose
  // request is still under review gets the waiting screen, even after signing
  // in again; just approved → welcome screen first. The database enforces the
  // same rule on every query (has_place_role: verified cafés only).
  if (user && isProGatedPath(pathname)) {
    const { data, error } = await supabase.rpc('pro_access_status');
    // On error (SQL not deployed yet, network…) let the page load: RLS stays
    // the real barrier and the page shows nothing it may not read.
    if (!error) {
      const target = proGateRedirect(
        pathname,
        parseProAccessStatus(data).state
      );
      if (target) {
        const url = request.nextUrl.clone();
        url.pathname = target;
        url.search = '';
        const redirectResponse = NextResponse.redirect(url);
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
      }
    }
  }

  // IMPORTANT: you *must* return the supabaseResponse object as is so the
  // refreshed cookies are forwarded to the browser.
  return supabaseResponse;
}
