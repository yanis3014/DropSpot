'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GoogleLogo,
  AppleLogo,
  Envelope,
  User,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import ThemeSwitcher from '@/components/profile/ThemeSwitcher';
import Button from '@/components/ui/Button';
import Logo from '@/components/brand/Logo';
import {
  resolvePostAuthDestination,
  safeRedirectPath,
} from '@/lib/auth/redirect';
import { cn } from '@/lib/cn';

type AuthMode = 'login' | 'signup';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, user } = useAuth();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preferredNext = useMemo(
    () => safeRedirectPath(searchParams.get('redirect')),
    [searchParams]
  );

  const espacePro = useMemo(() => {
    if (searchParams.get('espace') === 'pro') return true;
    return preferredNext.startsWith('/dashboard-pro') || preferredNext === '/pro';
  }, [preferredNext, searchParams]);

  const buildAuthCallbackUrl = () => {
    const params = new URLSearchParams();
    params.set('next', preferredNext);
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
        preferredNext
      );
      if (!cancelled) router.replace(dest);
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAuthenticated, user, preferredNext, router]);

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
        preferredNext
      );
      router.replace(dest);
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
          preferredNext
        );
        router.replace(dest);
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
    'w-full rounded-[14px] border border-ds-line bg-ds-surface px-4 py-3.5 text-base text-ds-text placeholder:text-ds-text2 focus:border-ds-accent focus:outline-none focus:ring-2 focus:ring-ds-accent/20';

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ds-bg px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-[34px] text-ds-text">
            <Logo />
          </h1>
          <p className="mt-2 text-[15px] text-ds-text2">
            {espacePro
              ? mode === 'login'
                ? 'Connecte-toi pour gérer ton café'
                : 'Crée ton compte Dropspot'
              : mode === 'login'
                ? 'Connecte-toi à ton compte'
                : 'Crée ton compte'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Mode d'authentification"
          className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl bg-ds-surface2 p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            onClick={() => {
              setMode('login');
              clearFeedback();
            }}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all',
              mode === 'login'
                ? 'bg-ds-surface text-ds-text shadow-sm ring-1 ring-ds-line'
                : 'text-ds-text2'
            )}
          >
            <User size={16} weight={mode === 'login' ? 'fill' : 'regular'} />
            Connexion
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            onClick={() => {
              setMode('signup');
              clearFeedback();
            }}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all',
              mode === 'signup'
                ? 'bg-ds-surface text-ds-text shadow-sm ring-1 ring-ds-line'
                : 'text-ds-text2'
            )}
          >
            Inscription
          </button>
        </div>

        {!supabase && (
          <div className="mb-5 rounded-[14px] border border-ds-line bg-ds-accentsoft px-3.5 py-3 text-center text-sm font-medium text-ds-accenttext">
            Supabase n&apos;est pas configuré.
          </div>
        )}

        <div className="mb-5 flex flex-col gap-2.5">
          <Button
            variant="outline"
            onClick={() => void handleGoogleLogin()}
            disabled={loading || !supabase}
            className="w-full"
          >
            <GoogleLogo size={20} weight="fill" aria-hidden />
            {mode === 'signup' ? "S'inscrire avec Google" : 'Continuer avec Google'}
          </Button>
          <button
            type="button"
            onClick={() => void handleAppleLogin()}
            disabled={loading || !supabase}
            className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-ds-pin px-5 text-base font-bold text-ds-onpin transition-opacity disabled:pointer-events-none disabled:opacity-50"
          >
            <AppleLogo size={20} weight="fill" aria-hidden />
            {mode === 'signup' ? "S'inscrire avec Apple" : 'Continuer avec Apple'}
          </button>
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-ds-line" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-ds-bg px-4 text-ds-text2">ou</span>
          </div>
        </div>

        <form
          onSubmit={mode === 'login' ? handlePasswordLogin : handleSignup}
          className="mb-4 flex flex-col gap-2.5"
        >
          <input
            type="email"
            autoComplete="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
            disabled={loading || !supabase}
            required
          />
          <input
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

          <Button
            type="submit"
            variant="main"
            disabled={loading || !email || !password || !supabase}
            className="w-full"
          >
            {loading
              ? 'Patiente…'
              : mode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </Button>
        </form>

        {mode === 'login' && (
          <form onSubmit={handleMagicLink} className="mb-5">
            <button
              type="submit"
              disabled={loading || !email || !supabase}
              className="inline-flex h-11 w-full items-center justify-center gap-2 text-sm font-bold text-ds-text2 transition-colors hover:text-ds-text disabled:opacity-50"
            >
              <Envelope size={16} weight="regular" aria-hidden />
              Recevoir un lien magique à la place
            </button>
          </form>
        )}

        {error ? (
          <p className="mb-4 rounded-[14px] bg-ds-accentsoft px-3.5 py-2.5 text-center text-sm font-medium text-ds-accenttext">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mb-4 rounded-[14px] bg-ds-ok/10 px-3.5 py-2.5 text-center text-sm font-medium text-ds-ok">
            {message}
          </p>
        ) : null}

        <div className="mb-6">
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-ds-text2">
            Apparence
          </p>
          <ThemeSwitcher />
        </div>

        <div className="flex flex-col gap-3 text-center">
          <Link
            href="/pro"
            className="text-sm font-semibold text-ds-text2 underline decoration-ds-line underline-offset-2 hover:text-ds-text"
          >
            Je suis un café
          </Link>
          <button
            type="button"
            onClick={() => router.push('/map')}
            className="text-sm font-semibold text-ds-text2 underline decoration-ds-line underline-offset-2 hover:text-ds-text"
          >
            Explorer l&apos;app sans compte pour l&apos;instant
          </button>
        </div>
      </div>
    </main>
  );
}
