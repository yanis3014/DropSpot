'use client';

import { useCallback, useEffect, useState } from 'react';
import { CaretRight, Check } from '@phosphor-icons/react';
import ProfileSubHeader from '@/components/profile/ProfileSubHeader';
import ThemeSwitcher from '@/components/profile/ThemeSwitcher';
import Button from '@/components/ui/Button';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/lib/hooks/useProfile';
import { useTheme } from '@/lib/theme';

type LocStatus = 'unknown' | 'granted' | 'prompt' | 'denied';

function locLabel(status: LocStatus): string {
  if (status === 'granted') return "En utilisant l'app";
  if (status === 'denied') return 'Refusée';
  if (status === 'prompt') return 'À autoriser';
  return 'Inconnue';
}

/** Pseudo, theme and location permission. */
export default function ProfileSettingsPage() {
  const {
    isAuthenticated,
    loading: authLoading,
    displayName,
  } = useAuth();
  const { profile, loading: profileLoading, save } = useProfile(
    isAuthenticated,
    authLoading
  );
  const { preference } = useTheme();

  const [name, setName] = useState('');
  const [profileSyncKey, setProfileSyncKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>('unknown');

  const nextProfileKey = `${profile?.id ?? ''}|${profile?.updated_at ?? ''}|${profile?.full_name ?? ''}|${displayName ?? ''}`;
  if (nextProfileKey !== profileSyncKey && (profile || displayName)) {
    setProfileSyncKey(nextProfileKey);
    setName(profile?.full_name ?? displayName ?? '');
  }

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (typeof navigator === 'undefined' || !navigator.permissions?.query) {
        return;
      }
      try {
        const result = await navigator.permissions.query({
          name: 'geolocation' as PermissionName,
        });
        if (cancelled) return;
        const apply = () => {
          if (result.state === 'granted') setLocStatus('granted');
          else if (result.state === 'denied') setLocStatus('denied');
          else setLocStatus('prompt');
        };
        apply();
        result.onchange = apply;
      } catch {
        // Permissions API may reject geolocation on some browsers
      }
    };
    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  const initialName = profile?.full_name ?? displayName ?? '';
  const dirty = name.trim() !== initialName.trim();

  const themePrefLabel =
    preference === 'light'
      ? 'Clair'
      : preference === 'dark'
        ? 'Sombre'
        : 'Système';

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setLocStatus('granted'),
      () => setLocStatus('denied'),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      await save({ full_name: name.trim() || null });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error('Profile save error:', err);
      setSaveError("Impossible d'enregistrer. Réessaie.");
    } finally {
      setSaving(false);
    }
  }, [name, save]);

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
      <ProfileSubHeader title="Réglages" />

      <section className="flex flex-col gap-2.5 rounded-[22px] border border-ds-line bg-ds-surface p-3.5">
        <label
          htmlFor="profile-pseudo"
          className="text-[15px] font-semibold text-ds-text"
        >
          Pseudo
        </label>
        <input
          id="profile-pseudo"
          type="text"
          value={name}
          disabled={profileLoading}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && dirty && name.trim()) void handleSave();
          }}
          maxLength={40}
          autoComplete="nickname"
          className="h-12 w-full rounded-xl border-[1.5px] border-ds-line bg-ds-bg px-3 text-[16px] text-ds-text focus:border-ds-accent focus:outline-none"
        />
        {saveError ? (
          <p className="m-0 text-sm text-ds-danger">{saveError}</p>
        ) : null}
        {dirty || saved ? (
          <Button
            variant={saved ? 'tonal' : 'main'}
            disabled={saving || name.trim().length === 0}
            onClick={() => void handleSave()}
            className="w-full"
          >
            {saved ? (
              <>
                <Check size={20} weight="bold" />
                Enregistré
              </>
            ) : saving ? (
              'Enregistrement…'
            ) : (
              'Enregistrer mon pseudo'
            )}
          </Button>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-[22px] border border-ds-line bg-ds-surface">
        <div className="px-3.5 py-3">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="flex-1 text-[15px] font-semibold text-ds-text">
              Thème
            </span>
            <span className="text-[15px] text-ds-text2">{themePrefLabel}</span>
          </div>
          <ThemeSwitcher />
        </div>

        <button
          type="button"
          onClick={requestLocation}
          className="flex min-h-14 w-full items-center gap-3 border-t border-ds-line px-3.5 text-left"
        >
          <span className="flex-1 text-[15px] font-semibold text-ds-text">
            Localisation
          </span>
          <span className="text-[15px] text-ds-text2">
            {locLabel(locStatus)}
          </span>
          <CaretRight
            size={18}
            weight="regular"
            className="shrink-0 text-ds-text2"
            aria-hidden
          />
        </button>
      </section>
    </main>
  );
}
