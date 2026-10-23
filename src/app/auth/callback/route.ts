import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { resolvePostAuthDestination, safeRedirectPath } from '@/lib/auth/redirect';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const preferredNext = safeRedirectPath(searchParams.get('next'));

  // Failures go back to /login with the destination, so signing in again
  // still lands on the page the user was heading to.
  const loginWithError = (reason: string) => {
    const params = new URLSearchParams({ error: reason });
    if (preferredNext !== '/') params.set('redirect', preferredNext);
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  };

  if (!code) {
    return loginWithError('missing_code');
  }

  const cookiesToApply: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToApply.push(...cookiesToSet);
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error.message);
    return loginWithError(error.message);
  }

  const userId = data.session?.user?.id;
  let destination = preferredNext;

  if (userId) {
    destination = await resolvePostAuthDestination(
      supabase,
      userId,
      preferredNext
    );
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  cookiesToApply.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
