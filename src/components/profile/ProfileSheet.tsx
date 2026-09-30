'use client';

import { useEffect, useState } from 'react';
import { X, UserCircle, SignOut, PencilSimple, Check } from '@phosphor-icons/react';
import { Profile, ProfilePatch } from '@/lib/api/profiles';
import { PreferenceId } from '@/lib/preferences';
import PreferencePills from '@/components/profile/PreferencePills';

interface ProfileSheetProps {
  profile: Profile | null;
  email: string | null;
  fallbackName: string | null;
  fallbackAvatar: string | null;
  onSave: (patch: ProfilePatch) => Promise<unknown>;
  onSignOut: () => void | Promise<void>;
  onClose: () => void;
}

export default function ProfileSheet({
  profile,
  email,
  fallbackName,
  fallbackAvatar,
  onSave,
  onSignOut,
  onClose,
}: ProfileSheetProps) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? fallbackName ?? '');
  const [prefs, setPrefs] = useState<PreferenceId[]>(profile?.preferences ?? []);
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatar = profile?.avatar_url ?? fallbackAvatar;
  const initialName = profile?.full_name ?? fallbackName ?? '';
  const initialPrefs = profile?.preferences ?? [];
  const dirty =
    name.trim() !== initialName.trim() ||
    prefs.length !== initialPrefs.length ||
    prefs.some((p) => !initialPrefs.includes(p));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await onSave({
        full_name: name.trim() || null,
        preferences: prefs,
        completeOnboarding: true,
      });
      setEditingName(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error('Profile save error:', err);
      setError("Impossible d'enregistrer. Réessaie.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-brand-espresso/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Mon profil"
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[90dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3">
          <span className="w-10 h-1 rounded-full bg-brand-espresso/15" />
        </div>
        <button
          onClick={handleClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full text-brand-mocha hover:bg-white transition-colors"
        >
          <X size={18} weight="bold" />
        </button>

        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
          {/* Identity */}
          <div className="flex items-center gap-4 mb-6">
            {avatar ? (
              <img
                src={avatar}
                alt=""
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-full object-cover ring-4 ring-white shadow-md flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-white ring-4 ring-white shadow-md flex items-center justify-center flex-shrink-0">
                <UserCircle size={40} weight="duotone" className="text-brand-matcha" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              {editingName ? (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
                  onBlur={() => setEditingName(false)}
                  maxLength={40}
                  autoFocus
                  className="w-full bg-white rounded-xl px-3 py-2 text-lg font-bold text-brand-espresso border-2 border-brand-matcha focus:outline-none"
                />
              ) : (
                <button
                  onClick={() => setEditingName(true)}
                  className="group flex items-center gap-2 text-left max-w-full"
                >
                  <span className="text-xl font-extrabold text-brand-espresso tracking-tight truncate">
                    {name.trim() || 'Ajouter un pseudo'}
                  </span>
                  <PencilSimple
                    size={16}
                    weight="bold"
                    className="text-brand-mocha/60 group-hover:text-brand-espresso flex-shrink-0 transition-colors"
                  />
                </button>
              )}
              {email && <p className="text-xs text-brand-mocha truncate mt-0.5">{email}</p>}
            </div>
          </div>

          {/* Preferences */}
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-mocha">
              Mes styles de café
            </h3>
            <span className="text-xs text-brand-mocha">
              {prefs.length} sélectionné{prefs.length > 1 ? 's' : ''}
            </span>
          </div>
          <PreferencePills value={prefs} onChange={setPrefs} variant="pills" />
          <p className="text-xs text-brand-mocha mt-3">
            Le feed met en avant les spots et drops qui correspondent.
          </p>

          {error && <p className="text-sm text-brand-terracotta mt-4">{error}</p>}
        </div>

        {/* Footer */}
        <div className="p-5 pt-3 border-t border-brand-mocha/10 bg-white flex-shrink-0 flex gap-2">
          <button
            onClick={onSignOut}
            aria-label="Se déconnecter"
            className="flex items-center justify-center gap-2 px-4 py-4 rounded-2xl text-brand-mocha font-semibold hover:text-brand-terracotta hover:bg-brand-terracotta/5 transition-colors"
          >
            <SignOut size={20} weight="bold" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!dirty && !saved) || prefs.length === 0}
            className={`flex-1 flex items-center justify-center gap-2 font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] disabled:active:scale-100 ${
              saved
                ? 'bg-brand-matcha text-white'
                : 'bg-brand-espresso text-white hover:bg-brand-espresso/90 disabled:opacity-40'
            }`}
          >
            {saved ? (
              <>
                <Check size={20} weight="bold" />
                Enregistré
              </>
            ) : saving ? (
              'Enregistrement…'
            ) : prefs.length === 0 ? (
              'Choisis au moins un style'
            ) : (
              'Enregistrer'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
