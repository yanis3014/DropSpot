'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  AppleLogo,
  ArrowLeft,
  EnvelopeSimple,
  GoogleLogo,
  Storefront,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import LogoMark from '@/components/brand/LogoMark';
import {
  resolvePostAuthDestination,
  safeRedirectPath,
} from '@/lib/auth/redirect';
import { hasProIntent, withProIntent } from '@/lib/auth/proIntent';

type AuthMode = 'login' | 'signup';
/** Social buttons first; e-mail + password on a second screen. */
type Step = 'choice' | 'email';

/**
 * Full page load after auth: the client router cache may still hold the
 * proxy's "go to /login" answer for this destination (prefetched while signed
 * out), which would send the user straight back here.
 */
function leaveLoginPage(dest: string) {
  window.location.replace(dest);
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ds-bg">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const [mode, setMode] = useState<AuthMode>(() =>
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  );
  const [step, setStep] = useState<Step>(() =>
    searchParams.get('mode') === 'signup' ? 'email' : 'choice'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // `/auth/callback` sends failures back here as `?error=` (expired link,
  // link opened in another browser…): show it instead of a silent form.
  const [error, setError] = useState<string | null>(() =>
    searchParams.get('error')
      ? 'La connexion n\'a pas abouti. Réessaie depuis cet appareil.'
      : null
  );

  const preferredNext = useMemo(
    () => safeRedirectPath(searchParams.get('redirect')),
    [searchParams]
  );

  // "Revendiquer mon café" started on this device: read at use time, the
  // `?redirect=` may have been lost on the way (e-mail link, Google…).
  // (Client-only: useSearchParams keeps this page out of the prerender.)
  const [proIntent] = useState(hasProIntent);
  const nextAfterAuth = () => withProIntent(preferredNext, hasProIntent());

  const espacePro = useMemo(() => {
    if (searchParams.get('espace') === 'pro' || proIntent) return true;
    return preferredNext.startsWith('/dashboard-pro') || preferredNext === '/pro';
  }, [preferredNext, proIntent, searchParams]);

  const buildAuthCallbackUrl = () => {
    const params = new URLSearchParams();
    params.set('next', nextAfterAuth());
    return `${window.location.origin}/auth/callback?${params.toString()}`;
  };

  const oauthOptions = () => ({
    redirectTo: buildAuthCallbackUrl(),
  });

  useEffect(() => {
    if (authLoading || !isAuthenticated || !user || !supabase) return;
    let cancelled = false;
    (async () => {
      const dest = await resolvePostAuthDestination(
        supabase,
        user.id,
        withProIntent(preferredNext, hasProIntent())
      );
      if (!cancelled) leaveLoginPage(dest);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user, preferredNext]);

  const clearFeedback = () => {
    setError(null);
    setMessage(null);
  };

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    try {
      setLoading(true);
      clearFeedback();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: oauthOptions(),
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      console.error('Google login error:', err);
      setError('Connexion Google impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (!supabase) {
      setError("Supabase n'est pas configuré.");
      return;
    }
    try {
      setLoading(true);
      clearFeedback();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: oauthOptions(),
      });
      if (oauthError) throw oauthError;
    } catch (err) {
      console.error('Apple login error:', err);
      setError('Connexion Apple impossible.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !email || !password) return;
    try {
      setLoading(true);
      clearFeedback();
      const { data, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const userId = data.user?.id;
      if (!userId) throw new Error('Session invalide');
      const dest = await resolvePostAuthDestination(
        supabase,
        userId,
        nextAfterAuth()
      );
      leaveLoginPage(dest);
    } catch (err) {
      console.error('Password login error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Email ou mot de passe incorrect.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || !email || !password) return;
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    try {
      setLoading(true);
      clearFeedback();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(),
        },
      });
      if (signUpError) throw signUpError;

      const userId = data.user?.id;
      if (data.session && userId) {
        const dest = await resolvePostAuthDestination(
          supabase,
          userId,
          nextAfterAuth()
        );
        leaveLoginPage(dest);
        return;
      }

      setMessage(
        'Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.'
      );
      setMode('login');
    } catch (err) {
      console.error('Signup error:', err);
      setError(
        err instanceof Error ? err.message : "Impossible de créer le compte."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !supabase) return;
    try {
      setLoading(true);
      clearFeedback();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: buildAuthCallbackUrl(),
        },
      });
      if (otpError) throw otpError;
      setMessage('Lien magique envoyé ! Vérifie ta boîte mail.');
    } catch (err) {
      console.error('Magic link error:', err);
      setError("Erreur lors de l'envoi du lien magique.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'h-[52px] w-full rounded-[14px] border border-[#3b3029] bg-[#211914] px-4 text-base text-[#f4ede6] placeholder:text-[#8f8173] focus:border-[#e3905a] focus:outline-none focus:ring-2 focus:ring-[#e3905a]/30 disabled:opacity-60';
  const socialClass =
    'inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] px-5 text-base font-bold transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';
  const backHref = espacePro ? '/pro' : '/bienvenue';
  const claiming =
    proIntent || preferredNext.startsWith('/dashboard-pro/onboarding');

  const title =
    step === 'email'
      ? mode === 'login'
        ? 'Ton e-mail'
        : 'Crée ton compte'
      : espacePro
        ? claiming
          ? 'Revendique ton café'
          : 'Ton espace pro'
        : 'Content de te revoir';
  const subtitle =
    step === 'email'
      ? mode === 'login'
        ? 'Avec le mot de passe de ton compte Dropspot.'
        : 'Un e-mail et un mot de passe de 6 caractères minimum.'
      : claiming
        ? 'Connecte-toi ou crée ton compte, on t’emmène ensuite à la revendication.'
        : 'Un seul compte pour la carte et l’espace pro.';

  const feedback = (
    <>
      {error ? (
        <p
          role="alert"
          className="rounded-[14px] bg-[#3d1d1a] px-3.5 py-2.5 text-center text-sm font-medium text-[#f2a097]"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          role="status"
          className="rounded-[14px] bg-[#1b3125] px-3.5 py-2.5 text-center text-sm font-medium text-[#7cc79c]"
        >
          {message}
        </p>
      ) : null}
    </>
  );

  return (
    <main className="fixed inset-0 z-[80] flex flex-col overflow-y-auto bg-[radial-gradient(120%_70%_at_50%_30%,#3d2719_0%,#14100d_70%)] text-[#f4ede6]">
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {step === 'email' ? (
          <button
            type="button"
            onClick={() => {
              setStep('choice');
              clearFeedback();
            }}
            aria-label="Retour"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[#f4ede6]"
          >
            <ArrowLeft size={22} weight="bold" aria-hidden />
          </button>
        ) : (
          <Link
            href={backHref}
            aria-label="Retour"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[#f4ede6]"
          >
            <ArrowLeft size={22} weight="bold" aria-hidden />
          </Link>
        )}

        <div className="flex flex-1 flex-col justify-center gap-6 py-6">
          <div className="animate-step flex flex-col gap-3">
            {espacePro ? (
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-[#3d2719] px-3 py-1 text-[12px] font-extrabold text-[#f3b086]">
                <Storefront size={14} weight="fill" aria-hidden />
                Espace pro
              </span>
            ) : (
              <span className="flex items-center gap-2.5">
                <LogoMark className="h-9 w-9 text-[#e3905a]" />
                <span className="font-display text-2xl font-extrabold tracking-[-0.04em]">
                  dropspot
                </span>
              </span>
            )}
            <h1 className="font-display text-[32px] font-extrabold leading-[1.08]">
              {title}
            </h1>
            <p className="text-[15px] leading-snug text-[#bbad9f]">{subtitle}</p>
          </div>

          {!supabase && (
            <p className="rounded-[14px] bg-[#3d2719] px-3.5 py-3 text-center text-sm font-medium text-[#f3b086]">
              Supabase n&apos;est pas configuré.
            </p>
          )}

          {step === 'choice' ? (
            <div className="animate-step flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => void handleGoogleLogin()}
                disabled={loading || !supabase}
                className={`${socialClass} bg-white text-[#1f1f1f]`}
              >
                <GoogleLogo size={20} weight="bold" aria-hidden />
                Continuer avec Google
              </button>
              <button
                type="button"
                onClick={() => void handleAppleLogin()}
                disabled={loading || !supabase}
                className={`${socialClass} border border-[#3b3029] bg-black text-white`}
              >
                <AppleLogo size={20} weight="fill" aria-hidden />
                Continuer avec Apple
              </button>
              <div className="my-1.5 flex items-center gap-3 text-sm text-[#bbad9f]">
                <span className="h-px flex-1 bg-[#3b3029]" />
                ou
                <span className="h-px flex-1 bg-[#3b3029]" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  clearFeedback();
                }}
                disabled={!supabase}
                className={`${socialClass} border border-[#3b3029] text-[#f4ede6]`}
              >
                <EnvelopeSimple size={20} weight="bold" aria-hidden />
                Continuer avec mon e-mail
              </button>
              {feedback}
            </div>
          ) : (
            <div className="animate-step flex flex-col gap-2.5">
              <form
                onSubmit={mode === 'login' ? handlePasswordLogin : handleSignup}
                className="flex flex-col gap-2.5"
              >
                <label htmlFor="login-email" className="sr-only">
                  E-mail
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="ton@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  disabled={loading || !supabase}
                  required
                />
                <label htmlFor="login-password" className="sr-only">
                  Mot de passe
                </label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  placeholder="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  disabled={loading || !supabase}
                  required
                  minLength={6}
                />
                <button
                  type="submit"
                  disabled={loading || !email || !password || !supabase}
                  className={`${socialClass} mt-1 bg-[#e3905a] font-extrabold text-[#1b0f08]`}
                >
                  {loading
                    ? 'Patiente…'
                    : mode === 'login'
                      ? 'Se connecter'
                      : 'Créer mon compte'}
                </button>
              </form>
              {mode === 'login' && (
                <form onSubmit={handleMagicLink}>
                  <button
                    type="submit"
                    disabled={loading || !email || !supabase}
                    className="h-11 w-full text-sm font-bold text-[#f3b086] disabled:opacity-50"
                  >
                    Recevoir un lien par e-mail à la place
                  </button>
                </form>
              )}
              {feedback}
            </div>
          )}
        </div>

        <p className="text-center text-sm text-[#bbad9f]">
          {step === 'email' && mode === 'signup'
            ? 'Déjà un compte ?'
            : 'Pas encore de compte ?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(step === 'email' && mode === 'signup' ? 'login' : 'signup');
              setStep('email');
              clearFeedback();
            }}
            className="font-bold text-[#f3b086] underline underline-offset-2"
          >
            {step === 'email' && mode === 'signup'
              ? 'Se connecter'
              : 'Créer un compte'}
          </button>
        </p>
      </div>
    </main>
  );
}
