'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleLogo, AppleLogo, Envelope } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/lib/hooks/useAuth';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in? No need to show the login screen.
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.replace('/');
    }
  }, [authLoading, isAuthenticated, router]);

  const handleGoogleLogin = async () => {
    if (!supabase) {
      alert('Supabase n\'est pas configuré. Veuillez configurer les variables d\'environnement.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Google login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (!supabase) {
      alert('Supabase n\'est pas configuré. Veuillez configurer les variables d\'environnement.');
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error('Apple login error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    if (!supabase) {
      alert('Supabase n\'est pas configuré. Veuillez configurer les variables d\'environnement.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      alert('Lien magique envoyé ! Vérifie ta boîte mail.');
    } catch (error) {
      console.error('Magic link error:', error);
      alert('Erreur lors de l\'envoi du lien magique.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestMode = () => {
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-brand-oat flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-brand-espresso tracking-tight">
            DropSpot
          </h1>
        </div>

        {/* Headline */}
        <h2 className="text-2xl font-bold text-brand-espresso text-center mb-8">
          Connecte-toi pour réclamer tes Drops.
        </h2>

        {!supabase && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6 text-sm text-yellow-800 text-center">
            ⚠️ Supabase n'est pas configuré. Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </div>
        )}

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading || !supabase}
            className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <GoogleLogo size={20} weight="fill" className="text-brand-espresso" />
            <span className="text-brand-espresso font-medium">Continuer avec Google</span>
          </button>

          <button
            onClick={handleAppleLogin}
            disabled={loading || !supabase}
            className="w-full flex items-center justify-center gap-3 bg-black rounded-xl py-3 px-4 shadow-sm hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <AppleLogo size={20} weight="fill" className="text-white" />
            <span className="text-white font-medium">Continuer avec Apple</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-mocha/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-brand-oat text-brand-mocha">ou</span>
          </div>
        </div>

        {/* Magic Link Form */}
        <form onSubmit={handleMagicLink} className="space-y-3 mb-6">
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-matcha focus:outline-none focus:ring-2 focus:ring-brand-matcha/20 transition-all"
            disabled={loading || !supabase}
          />
          <button
            type="submit"
            disabled={loading || !email || !supabase}
            className="w-full flex items-center justify-center gap-2 bg-brand-matcha text-white rounded-xl py-3 px-4 shadow-sm hover:bg-brand-matcha/90 transition-all active:scale-95 disabled:opacity-50"
          >
            <Envelope size={20} weight="fill" />
            <span className="font-medium">Recevoir un lien magique</span>
          </button>
        </form>

        {/* Guest Mode */}
        <div className="text-center">
          <button
            onClick={handleGuestMode}
            className="text-sm text-brand-mocha underline hover:text-brand-espresso transition-colors"
          >
            Explorer l'app sans compte pour l'instant
          </button>
        </div>
      </div>
    </div>
  );
}
