'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Moon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/pro/ConfirmDialog';
import ThemeSwitcher from '@/components/profile/ThemeSwitcher';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { useAuth } from '@/lib/hooks/useAuth';
import { useVendorProfile } from '@/app/(pro)/dashboard-pro/hooks/useVendorProfile';
import {
  leavePlace,
  teamErrorMessage,
} from '@/app/(pro)/dashboard-pro/lib/api/team';
import {
  DEFAULT_QUIET_FROM,
  DEFAULT_QUIET_TO,
  listMyNotificationPreferences,
  NOTIFICATION_EVENT_DEFAULTS,
  upsertNotificationPreference,
  type NotificationPreferenceRow,
  type NotifiableEventId,
} from '@/lib/api/notificationPreferences';
import { CONTACT_EMAIL } from '@/lib/pro/contact';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[26px] w-11 justify-self-center rounded-[13px] border-none p-0 transition-colors',
        checked ? 'bg-ds-accent' : 'bg-ds-line'
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-5 w-5 rounded-[10px] bg-ds-surface transition-all',
          checked ? 'right-[3px]' : 'left-[3px]'
        )}
      />
    </button>
  );
}

export default function ReglagesClient() {
  const router = useRouter();
  const { user, email: authEmail, isAuthenticated, loading: authLoading } =
    useAuth();
  const {
    profile,
    loading: profileLoading,
    save: saveProfile,
  } = useVendorProfile(isAuthenticated, authLoading);
  const { activePlace, loading: placeLoading } = useActivePlace();

  const [prefs, setPrefs] = useState<NotificationPreferenceRow[]>([]);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [editingPassword, setEditingPassword] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [lastOwnerMsg, setLastOwnerMsg] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await listMyNotificationPreferences();
      if (!cancelled) {
        setPrefs(rows);
        setPrefsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byEvent = useMemo(() => {
    const map = new Map(prefs.map((p) => [p.event, p]));
    return map;
  }, [prefs]);

  const globalPref = byEvent.get('global');
  const quietEnabled = Boolean(globalPref?.quietFrom && globalPref?.quietTo);

  const patchPref = async (next: NotificationPreferenceRow) => {
    setPrefs((prev) =>
      prev.map((p) => (p.event === next.event ? next : p))
    );
    const ok = await upsertNotificationPreference(next);
    if (!ok) {
      setError('Impossible d’enregistrer cette préférence.');
      const rows = await listMyNotificationPreferences();
      setPrefs(rows);
    }
  };

  const toggleChannel = (
    event: NotifiableEventId,
    channel: 'push' | 'email',
    value: boolean
  ) => {
    const current = byEvent.get(event);
    if (!current) return;
    void patchPref({ ...current, [channel]: value });
  };

  const toggleQuiet = (on: boolean) => {
    const current = globalPref ?? {
      event: 'global' as const,
      push: true,
      email: false,
      quietFrom: DEFAULT_QUIET_FROM,
      quietTo: DEFAULT_QUIET_TO,
    };
    void patchPref({
      ...current,
      quietFrom: on ? current.quietFrom ?? DEFAULT_QUIET_FROM : null,
      quietTo: on ? current.quietTo ?? DEFAULT_QUIET_TO : null,
    });
  };

  const setQuietTime = (key: 'quietFrom' | 'quietTo', value: string) => {
    if (!globalPref) return;
    void patchPref({ ...globalPref, [key]: value });
  };

  const saveName = async () => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await saveProfile({ full_name: nameDraft.trim() || null });
      setEditingName(false);
      setInfo('Nom mis à jour.');
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier le nom.');
    } finally {
      setBusy(false);
    }
  };

  const saveEmail = async () => {
    if (!supabase) return;
    const next = emailDraft.trim();
    if (!next || !next.includes('@')) {
      setError('Indique une adresse e-mail valide.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        email: next,
      });
      if (updateError) throw updateError;
      setEditingEmail(false);
      setInfo(
        'Confirme le changement dans l’e-mail qu’on vient de t’envoyer.'
      );
    } catch (err) {
      console.error(err);
      setError('Impossible de modifier l’e-mail.');
    } finally {
      setBusy(false);
    }
  };

  // Signed-in user sets the new password here: the app has no
  // "new password" page for a reset link.
  const changePassword = async () => {
    if (!supabase) return;
    const next = passwordDraft;
    if (next.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.');
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: next,
      });
      if (updateError) throw updateError;
      setEditingPassword(false);
      setPasswordDraft('');
      setInfo('Ton mot de passe a été changé.');
    } catch (err) {
      console.error(err);
      setError(
        'Impossible de changer le mot de passe. Déconnecte-toi, reconnecte-toi puis réessaie.'
      );
    } finally {
      setBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!activePlace) return;
    setLeaveBusy(true);
    setLastOwnerMsg(null);
    setError(null);
    try {
      const result = await leavePlace(activePlace.id);
      if (!result.ok) {
        const msg = teamErrorMessage(result.error);
        if (result.error === 'last_owner') {
          setLastOwnerMsg(msg);
        } else {
          setError(msg);
        }
        setLeaveOpen(false);
        return;
      }
      setLeaveOpen(false);
      router.replace('/dashboard-pro');
      router.refresh();
    } catch (err) {
      console.error(err);
      setError('Impossible de quitter ce café.');
      setLeaveOpen(false);
    } finally {
      setLeaveBusy(false);
    }
  };

  const deleteMailto = useMemo(() => {
    const subject = encodeURIComponent('Demande de suppression de compte');
    const body = encodeURIComponent(
      [
        'Bonjour,',
        '',
        'Je demande la suppression de mon compte Dropspot Pro.',
        `Compte : ${profile?.full_name?.trim() || authEmail || user?.id || '—'}`,
        `E-mail : ${authEmail || '—'}`,
        '',
        'Merci,',
      ].join('\n')
    );
    return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }, [profile?.full_name, authEmail, user?.id]);

  const loading =
    authLoading || profileLoading || prefsLoading || placeLoading;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-text">
      <header className="flex h-[84px] shrink-0 items-center border-b border-ds-line px-4 sm:px-8">
        <div>
          <h1 className="font-display m-0 text-[26px] font-extrabold tracking-tight">
            Réglages
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            Ton compte · valable pour tous tes cafés
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 lg:flex-row lg:gap-5 lg:px-8 lg:py-6">
        {/* Notifications */}
        <section className="min-w-0 flex-1 self-start overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
          <div className="px-5 pb-1.5 pt-[18px]">
            <h2 className="font-display m-0 text-lg font-bold">Notifications</h2>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-3 px-5 py-2 text-[13px] font-bold text-ds-text2">
            <span>Me prévenir quand…</span>
            <span className="text-center">Téléphone</span>
            <span className="text-center">E-mail</span>
          </div>
          {NOTIFICATION_EVENT_DEFAULTS.map((meta) => {
            const row = byEvent.get(meta.event);
            return (
              <div
                key={meta.event}
                className="grid grid-cols-[minmax(0,1fr)_72px_72px] items-center gap-3 border-t border-ds-line px-5 py-3"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-semibold">{meta.label}</span>
                  <span className="text-[13px] text-ds-text2">{meta.note}</span>
                </div>
                <Switch
                  checked={Boolean(row?.push)}
                  label={`${meta.label} par notification`}
                  onChange={(v) => toggleChannel(meta.event, 'push', v)}
                />
                <Switch
                  checked={Boolean(row?.email)}
                  label={`${meta.label} par e-mail`}
                  onChange={(v) => toggleChannel(meta.event, 'email', v)}
                />
              </div>
            );
          })}

          <div className="m-5 mt-2 flex flex-col gap-3 rounded-[14px] bg-ds-surface2 px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Moon className="h-5 w-5 shrink-0 text-ds-text2" aria-hidden />
              <span className="flex-1 font-semibold">
                Silence entre{' '}
                {quietEnabled
                  ? `${globalPref?.quietFrom ?? DEFAULT_QUIET_FROM} et ${globalPref?.quietTo ?? DEFAULT_QUIET_TO}`
                  : `${DEFAULT_QUIET_FROM} et ${DEFAULT_QUIET_TO}`}
              </span>
              <Switch
                checked={quietEnabled}
                label="Heures de silence"
                onChange={toggleQuiet}
              />
            </div>
            {quietEnabled ? (
              <div className="flex flex-wrap items-center gap-2 pl-8">
                <label className="flex items-center gap-2 text-sm text-ds-text2">
                  De
                  <input
                    type="time"
                    value={globalPref?.quietFrom ?? DEFAULT_QUIET_FROM}
                    onChange={(e) => setQuietTime('quietFrom', e.target.value)}
                    className="h-9 rounded-lg border border-ds-line bg-ds-bg px-2 font-semibold text-ds-text"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-ds-text2">
                  à
                  <input
                    type="time"
                    value={globalPref?.quietTo ?? DEFAULT_QUIET_TO}
                    onChange={(e) => setQuietTime('quietTo', e.target.value)}
                    className="h-9 rounded-lg border border-ds-line bg-ds-bg px-2 font-semibold text-ds-text"
                  />
                </label>
              </div>
            ) : null}
          </div>

          <p className="m-0 px-5 pb-5 text-[13px] text-ds-text2">
            Les notifications arrivent bientôt : tes choix sont enregistrés.
          </p>
        </section>

        <div className="flex w-full shrink-0 flex-col gap-4 lg:w-[440px]">
          {(error || info || lastOwnerMsg) && (
            <div className="flex flex-col gap-2">
              {error ? (
                <p
                  role="alert"
                  className="m-0 rounded-xl bg-ds-dangersoft px-4 py-3 text-sm font-semibold text-ds-danger"
                >
                  {error}
                </p>
              ) : null}
              {lastOwnerMsg ? (
                <p
                  role="alert"
                  className="m-0 rounded-xl bg-ds-warnsoft px-4 py-3 text-sm font-semibold text-ds-warn"
                >
                  {lastOwnerMsg}
                </p>
              ) : null}
              {info ? (
                <p
                  role="status"
                  className="m-0 rounded-xl bg-ds-oksoft px-4 py-3 text-sm font-semibold text-ds-ok"
                >
                  {info}
                </p>
              ) : null}
            </div>
          )}

          {/* Compte */}
          <section className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
            <div className="px-5 pb-1.5 pt-[18px]">
              <h2 className="font-display m-0 text-lg font-bold">Compte</h2>
            </div>
            <AccountRow
              label="Nom"
              value={profile?.full_name?.trim() || '—'}
              editing={editingName}
              draft={nameDraft}
              onDraft={setNameDraft}
              onEdit={() => {
                setEditingName(true);
                setNameDraft(profile?.full_name ?? '');
              }}
              onCancel={() => setEditingName(false)}
              onSave={() => void saveName()}
              busy={busy}
            />
            <AccountRow
              label="E-mail"
              value={authEmail || '—'}
              editing={editingEmail}
              draft={emailDraft}
              onDraft={setEmailDraft}
              inputType="email"
              onEdit={() => {
                setEditingEmail(true);
                setEmailDraft(authEmail ?? '');
              }}
              onCancel={() => setEditingEmail(false)}
              onSave={() => void saveEmail()}
              busy={busy}
            />
            <AccountRow
              label="Mot de passe"
              value="••••••••"
              editing={editingPassword}
              draft={passwordDraft}
              onDraft={setPasswordDraft}
              inputType="password"
              onEdit={() => {
                setEditingPassword(true);
                setPasswordDraft('');
              }}
              onCancel={() => {
                setEditingPassword(false);
                setPasswordDraft('');
              }}
              onSave={() => void changePassword()}
              busy={busy}
            />
          </section>

          {/* Affichage */}
          <section className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
            <div className="px-5 pb-1.5 pt-[18px]">
              <h2 className="font-display m-0 text-lg font-bold">Affichage</h2>
            </div>
            <div className="flex items-center gap-3.5 border-t border-ds-line px-5 py-3">
              <span className="flex-1 font-semibold">Thème</span>
              <div className="w-[220px]">
                <ThemeSwitcher />
              </div>
            </div>
            <div className="flex items-center gap-3.5 border-t border-ds-line px-5 py-3">
              <span className="flex-1 font-semibold">Fuseau horaire</span>
              <span className="text-sm text-ds-text2">Europe/Paris · détecté</span>
            </div>
            <div className="flex items-center gap-3.5 border-t border-ds-line px-5 py-3">
              <span className="flex-1 font-semibold">Langue</span>
              <span className="text-sm text-ds-text2">Français</span>
            </div>
          </section>

          {/* Zone sensible */}
          <section className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
            <div className="flex items-center gap-3.5 px-5 py-3">
              <span className="flex-1 font-semibold">
                Ne plus gérer {activePlace?.name ?? 'ce café'}
              </span>
              <Button
                variant="outline"
                className="h-9 rounded-[10px] px-3 text-sm"
                disabled={!activePlace}
                onClick={() => {
                  setLastOwnerMsg(null);
                  setLeaveOpen(true);
                }}
              >
                Quitter
              </Button>
            </div>
            <div className="flex items-center gap-3.5 border-t border-ds-line px-5 py-3">
              <span className="flex-1 font-semibold text-ds-danger">
                Supprimer mon compte
              </span>
              <Button
                variant="outline"
                className="h-9 rounded-[10px] border-transparent bg-ds-dangersoft px-3 text-sm text-ds-danger"
                onClick={() => setDeleteOpen(true)}
              >
                Supprimer
              </Button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={leaveOpen}
        title={`Ne plus gérer ${activePlace?.name ?? 'ce café'} ?`}
        description="Tu perdras l’accès à ce café. Tu pourras être réinvité plus tard."
        confirmLabel={leaveBusy ? 'Sortie…' : 'Quitter'}
        cancelLabel="Annuler"
        danger
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => void handleLeave()}
      />

      {deleteOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setDeleteOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Supprimer mon compte"
            className="relative z-[71] flex w-full max-w-[480px] flex-col gap-3.5 rounded-t-[22px] bg-ds-surface p-6 shadow-ds sm:rounded-[22px] sm:p-7"
          >
            <h2 className="font-display m-0 text-[22px] font-extrabold">
              Supprimer mon compte
            </h2>
            <p className="m-0 text-[15px] leading-relaxed text-ds-text2">
              La suppression n&apos;est pas automatique. Envoie-nous une
              demande : on traite chaque compte manuellement.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <Button
                variant="outline"
                className="h-11 rounded-xl px-4 text-[15px]"
                onClick={() => setDeleteOpen(false)}
              >
                Annuler
              </Button>
              <a
                href={deleteMailto}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-ds-dangersoft px-[18px] text-[15px] font-bold text-ds-danger no-underline"
              >
                Écrire à {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AccountRow({
  label,
  value,
  editing,
  draft,
  onDraft,
  onEdit,
  onCancel,
  onSave,
  busy,
  inputType = 'text',
}: {
  label: string;
  value: string;
  editing: boolean;
  draft: string;
  onDraft: (v: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  busy: boolean;
  inputType?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-ds-line px-5 py-3">
      <span className="w-[110px] shrink-0 text-[13px] text-ds-text2">{label}</span>
      {editing ? (
        <>
          <input
            type={inputType}
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-ds-line bg-ds-bg px-3 text-sm font-semibold outline-none"
          />
          <Button
            variant="outline"
            className="h-9 rounded-[10px] px-3 text-sm"
            disabled={busy}
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            variant="main"
            className="h-9 rounded-[10px] px-3 text-sm"
            disabled={busy}
            onClick={onSave}
          >
            Enregistrer
          </Button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 truncate font-semibold">{value}</span>
          <Button
            variant="outline"
            className="h-9 rounded-[10px] px-3 text-sm"
            onClick={onEdit}
          >
            Modifier
          </Button>
        </>
      )}
    </div>
  );
}
