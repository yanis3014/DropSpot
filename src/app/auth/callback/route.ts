import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  destinationForProfile,
  safeRedirectPath,
} from '@/lib/auth/redirect';

type CookieToSet = { name: string; value: string; options?: Record<string, unknown> };

function wantsVendorRole(
  intent: string | null,
  userMetadata: Record<string, unknown> | undefined
): boolean {
  if (intent === 'vendor') return true;
  const metaRole = userMetadata?.role;
  return metaRole === 'vendor' || metaRole === 'owner';
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const preferredNext = safeRedirectPath(searchParams.get('next'));
  const intent = searchParams.get('intent'); // 'vendor' si inscription pro via OAuth

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
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
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  const user = data.session?.user;
  const userId = user?.id;
  let destination = preferredNext;

  if (userId) {
    // Filet de sécurité si le trigger n'a pas reçu raw_user_meta_data.role
    // (fréquent avec OAuth Google) : intent URL + user_metadata.role.
    if (
      wantsVendorRole(
        intent,
        user.user_metadata as Record<string, unknown> | undefined
      )
    ) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('role, onboarding_completed_at')
        .eq('id', userId)
        .maybeSingle();

      const canPromote =
        !existing ||
        (existing.role === 'user' && existing.onboarding_completed_at == null);

      if (canPromote) {
        if (!existing) {
          const { error: insertError } = await supabase.from('profiles').insert({
            id: userId,
            role: 'vendor',
            full_name:
              (user.user_metadata?.full_name as string | undefined) ??
              (user.user_metadata?.name as string | undefined) ??
              null,
            avatar_url:
              (user.user_metadata?.avatar_url as string | undefined) ??
              (user.user_metadata?.picture as string | undefined) ??
              null,
          });
          if (insertError) {
            console.error('Auth callback profile insert:', insertError.message);
          }
        } else {
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'vendor' })
            .eq('id', userId)
            .eq('role', 'user');
          if (updateError) {
            console.error('Auth callback role update:', updateError.message);
          }
        }
      }
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, onboarding_completed_at')
      .eq('id', userId)
      .maybeSingle();

    destination = destinationForProfile(profile, preferredNext);
  }

  const response = NextResponse.redirect(`${origin}${destination}`);
  cookiesToApply.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options)
  );
  return response;
}
