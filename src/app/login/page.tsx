'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  GoogleLogo,
  AppleLogo,
  Envelope,
  Storefront,
  User,
} from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';
import ThemeSwitcher from '@/components/profile/ThemeSwitcher';
import {
  resolvePostAuthDestination,
  safeRedirectPath,
} from '@/lib/auth/redirect';

type AuthMode = 'login' | 'signup';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-oat flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-matcha" />
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
  const [isProfessional, setIsProfessional] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const preferredNext = useMemo(
    () => safeRedirectPath(searchParams.get('redirect')),
    [searchParams]
  );

  const selectedRole = (): 'vendor' | 'user' =>
    mode === 'signup' && isProfessional ? 'vendor' : 'user';

  const buildAuthCallbackUrl = (intentVendor: boolean) => {
    const params = new URLSearchParams();
    params.set('next', preferredNext);
    if (intentVendor) params.set('intent', 'vendor');
    return `${window.location.origin}/auth/callback?${params.toString()}`;
  };

  /** Options OAuth : role dans user_metadata + intent dans le callback URL. */
  const oauthOptions = () => {
    const role = selectedRole();
    return {
      redirectTo: buildAuthCallbackUrl(role === 'vendor'),
      data: { role },
    };
  };

  // Déjà connecté → redirection intelligente selon le rôle
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

  /** Connexion email / mot de passe + redirect selon rôle */
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

  /** Inscription + role vendor si professionnel */
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
      const role = isProfessional ? 'vendor' : 'user';
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { role },
          emailRedirectTo: buildAuthCallbackUrl(isProfessional),
        },
      });
      if (signUpError) throw signUpError;

      const userId = data.user?.id;
      // Si session immédiate (confirm email désactivé), peaufine le rôle + redirect
      if (data.session && userId) {
        await supabase.from('profiles').upsert(
          { id: userId, role },
          { onConflict: 'id' }
        );
        const dest = await resolvePostAuthDestination(
          supabase,
          userId,
          preferredNext
        );
        router.replace(dest);
        return;
      }

      setMessage(
        isProfessional
          ? 'Compte restaurateur créé ! Vérifie ton email pour confirmer, puis connecte-toi.'
          : 'Compte créé ! Vérifie ton email pour confirmer, puis connecte-toi.'
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
          emailRedirectTo: buildAuthCallbackUrl(false),
          data: { role: 'user' },
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

  return (
    <div className="min-h-screen bg-brand-oat flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-brand-espresso tracking-tight">
            DropSpot
          </h1>
        </div>

        <h2 className="text-xl font-bold text-brand-espresso text-center mb-6">
          {mode === 'login'
            ? 'Connecte-toi à ton compte'
            : 'Crée ton compte DropSpot'}
        </h2>

        {/* Onglets Connexion / Inscription */}
        <div className="flex gap-1 p-1 mb-6 rounded-2xl bg-brand-muted/70 border border-brand-mocha/10">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              clearFeedback();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
              mode === 'login'
                ? 'bg-brand-surface text-brand-espresso shadow-sm'
                : 'text-brand-mocha'
            }`}
          >
            <User size={16} weight={mode === 'login' ? 'fill' : 'regular'} />
            Connexion
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              clearFeedback();
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all ${
              mode === 'signup'
                ? 'bg-brand-surface text-brand-espresso shadow-sm'
                : 'text-brand-mocha'
            }`}
          >
            Inscription
          </button>
        </div>

        {!supabase && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-sm text-yellow-800 text-center">
            ⚠️ Supabase n&apos;est pas configuré.
          </div>
        )}

        {/* Toggle pro avant OAuth (inscription) pour que Google/Apple portent le bon rôle */}
        {mode === 'signup' && (
          <label className="flex items-start gap-3 rounded-2xl border border-brand-mocha/15 bg-brand-surface px-3.5 py-3 mb-5 cursor-pointer hover:border-brand-green/30 transition-colors">
            <input
              type="checkbox"
              checked={isProfessional}
              onChange={(e) => setIsProfessional(e.target.checked)}
              className="mt-0.5 rounded border-brand-mocha/30 text-brand-green focus:ring-brand-green/30"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-bold text-brand-espresso">
                <Storefront size={16} weight="duotone" className="text-brand-green" />
                Je suis un professionnel
              </span>
              <span className="block text-xs text-brand-mocha mt-0.5 leading-relaxed">
                Coche avant Google/Apple pour créer un compte Restaurateur
              </span>
            </span>
          </label>
        )}

        {/* OAuth */}
        <div className="space-y-3 mb-5">
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || !supabase}
            className="w-full flex items-center justify-center gap-3 bg-brand-surface border border-brand-mocha/15 rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <GoogleLogo size={20} weight="fill" className="text-brand-espresso" />
            <span className="text-brand-espresso font-medium">
              {mode === 'signup' && isProfessional
                ? "S'inscrire avec Google"
                : 'Continuer avec Google'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleAppleLogin}
            disabled={loading || !supabase}
            className="w-full flex items-center justify-center gap-3 bg-black rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <AppleLogo size={20} weight="fill" className="text-white" />
            <span className="text-white font-medium">
              {mode === 'signup' && isProfessional
                ? "S'inscrire avec Apple"
                : 'Continuer avec Apple'}
            </span>
          </button>
        </div>

        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-mocha/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-brand-oat text-brand-mocha">ou</span>
          </div>
        </div>

        {/* Formulaire email / mot de passe */}
        <form
          onSubmit={mode === 'login' ? handlePasswordLogin : handleSignup}
          className="space-y-3 mb-4"
        >
          <input
            type="email"
            autoComplete="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-brand-mocha/15 bg-brand-surface text-brand-espresso focus:border-brand-matcha focus:outline-none focus:ring-2 focus:ring-brand-matcha/20 transition-all"
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
            className="w-full px-4 py-3 rounded-xl border border-brand-mocha/15 bg-brand-surface text-brand-espresso focus:border-brand-matcha focus:outline-none focus:ring-2 focus:ring-brand-matcha/20 transition-all"
            disabled={loading || !supabase}
            required
            minLength={6}
          />

          <button
            type="submit"
            disabled={loading || !email || !password || !supabase}
            className="w-full bg-brand-matcha text-white font-bold rounded-xl py-3 px-4 shadow-sm hover:bg-brand-matcha/90 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading
              ? 'Patiente…'
              : mode === 'login'
                ? 'Se connecter'
                : isProfessional
                  ? 'Créer mon compte restaurateur'
                  : 'Créer mon compte'}
          </button>
        </form>

        {/* Lien magique (optionnel, connexion seulement) */}
        {mode === 'login' && (
          <form onSubmit={handleMagicLink} className="mb-5">
            <button
              type="submit"
              disabled={loading || !email || !supabase}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold text-brand-mocha hover:text-brand-espresso py-2 transition-colors disabled:opacity-50"
            >
              <Envelope size={16} weight="fill" />
              Recevoir un lien magique à la place
            </button>
          </form>
        )}

        {error && (
          <p className="mb-4 text-sm font-medium text-brand-terracotta bg-brand-terracotta/10 rounded-xl px-3 py-2 text-center">
            {error}
          </p>
        )}
        {message && (
          <p className="mb-4 text-sm font-medium text-brand-green bg-brand-green/10 rounded-xl px-3 py-2 text-center">
            {message}
          </p>
        )}

        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-mocha text-center mb-2">
            Apparence
          </p>
          <ThemeSwitcher />
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="text-sm text-brand-mocha underline hover:text-brand-espresso transition-colors"
          >
            Explorer l&apos;app sans compte pour l&apos;instant
          </button>
        </div>
      </div>
    </div>
  );
}
