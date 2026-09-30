'use client';

import { useState } from 'react';
import { GoogleLogo, AppleLogo, Envelope, X } from '@phosphor-icons/react';
import { supabase } from '@/lib/supabase/client';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    if (!supabase) return;
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
    if (!supabase) return;
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
    if (!email || !supabase) return;
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

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="absolute inset-0 bg-brand-espresso/50 backdrop-blur-sm transition-opacity"
      />

      {/* Modal panel */}
      <div className="relative w-full max-w-sm bg-brand-oat rounded-3xl shadow-2xl p-6 max-h-[90dvh] overflow-y-auto">
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 p-2 rounded-full text-brand-mocha hover:bg-white/60 hover:text-brand-espresso transition-colors"
        >
          <X size={20} weight="bold" />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
            DropSpot
          </h2>
          <p className="text-sm text-brand-mocha mt-1">
            Connecte-toi pour enregistrer tes spots.
          </p>
        </div>

        {!supabase && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-5 text-xs text-yellow-800 text-center">
            ⚠️ Supabase n&apos;est pas configuré. Configurez NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </div>
        )}

        {/* OAuth buttons */}
        <div className="space-y-3 mb-5">
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
        <div className="relative mb-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-mocha/20" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-brand-oat text-brand-mocha">ou</span>
          </div>
        </div>

        {/* Magic link form */}
        <form onSubmit={handleMagicLink} className="space-y-3 mb-5">
          <input
            type="email"
            placeholder="ton@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white focus:border-brand-matcha focus:outline-none focus:ring-2 focus:ring-brand-matcha/20 transition-all"
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

        <button
          onClick={onClose}
          className="w-full text-sm text-brand-mocha underline hover:text-brand-espresso transition-colors"
        >
          Explorer l&apos;app sans compte pour l&apos;instant
        </button>
      </div>
    </div>
  );
}
