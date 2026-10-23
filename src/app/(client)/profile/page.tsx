'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CaretRight,
  Check,
  CoffeeBean,
  Lock,
  MapPin,
  PencilSimple,
  SignOut,
  Star,
  CalendarCheck,
  CheckCircle,
  Gift,
  Storefront,
  Ticket,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import ThemeSwitcher from '@/components/profile/ThemeSwitcher';
import {
  getMyContributions,
  type ContributionItem,
} from '@/lib/api/contributions';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchIsPro } from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import { writeDropspotMode } from '@/lib/auth/dropspotMode';
import { useProfile } from '@/lib/hooks/useProfile';
import {
  badgeProgress,
  GRAIN_BADGES,
  GRAINS_EARNING,
  PRIORITY_LIFETIME,
} from '@/lib/grains';
import { getMyGrains, type MyGrains } from '@/lib/api/grains';
import { avatarColorHex, envieLabel } from '@/lib/onboarding';
import { ENVIE_ICONS } from '@/components/onboarding/icons';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { EVENT_CATEGORY_ICONS } from '@/components/drops/DropCard';
import {
  formatStartLabel,
  getMyUpcomingEvents,
  isDropLive,
  type Drop,
} from '@/lib/api/drops';

const PREVIEW_CONTRIBS = 3;

type LocStatus = 'unknown' | 'granted' | 'prompt' | 'denied';

function formatMemberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const month = d.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });
  return `Membre depuis ${month}`;
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(-diffH, 'hour');
  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 14) return rtf.format(-diffD, 'day');
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function initialLetter(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

function locLabel(status: LocStatus): string {
  if (status === 'granted') return "En utilisant l'app";
  if (status === 'denied') return 'Refusée';
  if (status === 'prompt') return 'À autoriser';
  return 'Inconnue';
}

function ContributionIcon({ item }: { item: ContributionItem }) {
  const Icon =
    item.kind === 'check_in'
      ? MapPin
      : item.kind === 'spec_vote'
        ? CheckCircle
        : item.kind === 'event_presence'
          ? CalendarCheck
          : item.kind === 'place_suggested'
            ? Storefront
            : item.kind === 'welcome'
              ? Gift
              : item.kind === 'flash_drop'
                ? Ticket
                : Star;
  return <Icon size={18} weight="regular" aria-hidden />;
}

export default function ProfilePage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    email,
    avatarUrl,
    displayName,
    signOut,
  } = useAuth();
  const { profile, loading: profileLoading, save } = useProfile(
    isAuthenticated,
    authLoading
  );
  const { preference } = useTheme();

  const [name, setName] = useState('');
  const [profileSyncKey, setProfileSyncKey] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [locStatus, setLocStatus] = useState<LocStatus>('unknown');
  const [contribs, setContribs] = useState<ContributionItem[]>([]);
  const [contribsLoading, setContribsLoading] = useState(true);
  const [showAllContribs, setShowAllContribs] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [myEvents, setMyEvents] = useState<Drop[]>([]);
  const [myGrains, setMyGrains] = useState<MyGrains | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void fetchIsPro().then((value) => {
      if (!cancelled) setIsPro(value);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const nextProfileKey = `${profile?.id ?? ''}|${profile?.updated_at ?? ''}|${profile?.full_name ?? ''}|${displayName ?? ''}`;
  if (nextProfileKey !== profileSyncKey && (profile || displayName)) {
    setProfileSyncKey(nextProfileKey);
    setName(profile?.full_name ?? displayName ?? '');
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getMyUpcomingEvents()
      .then((rows) => {
        if (!cancelled) setMyEvents(rows);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getMyContributions(20).then((rows) => {
      if (cancelled) return;
      setContribs(rows);
      setContribsLoading(false);
    });
    getMyGrains().then((next) => {
      if (!cancelled) setMyGrains(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

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
        if (result.state === 'granted') setLocStatus('granted');
        else if (result.state === 'denied') setLocStatus('denied');
        else setLocStatus('prompt');
        result.onchange = () => {
          if (result.state === 'granted') setLocStatus('granted');
          else if (result.state === 'denied') setLocStatus('denied');
          else setLocStatus('prompt');
        };
      } catch {
        // Permissions API may reject geolocation on some browsers
      }
    };
    void sync();
    return () => {
      cancelled = true;
    };
  }, []);

  const grains = myGrains?.balance ?? profile?.grains_balance ?? 0;
  // Levels follow the Grains earned over time, so spending never loses one.
  const lifetime = myGrains?.lifetime ?? grains;
  const progress = useMemo(() => badgeProgress(lifetime), [lifetime]);
  const avatar = profile?.avatar_url ?? avatarUrl;
  const shownName = name.trim() || displayName || 'Explorateur';
  const memberSince = formatMemberSince(
    user?.created_at ?? profile?.onboarding_completed_at
  );

  const avatarColor = avatarColorHex(profile?.onboarding_answers.avatarColor);
  const envies = profile?.onboarding_answers.envies ?? [];
  const initialName = profile?.full_name ?? displayName ?? '';
  const dirty = name.trim() !== initialName.trim();

  const shownContribs = isAuthenticated ? contribs : [];
  const showContribLoading = isAuthenticated && contribsLoading;
  const visibleContribs = showAllContribs
    ? shownContribs
    : shownContribs.slice(0, PREVIEW_CONTRIBS);

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
      setEditingName(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      console.error('Profile save error:', err);
      setSaveError("Impossible d'enregistrer. Réessaie.");
    } finally {
      setSaving(false);
    }
  }, [name, save]);

  if (authLoading || profileLoading) {
    return (
      <main className="flex flex-1 flex-col gap-[18px] bg-ds-bg px-4 pb-28 pt-8">
        <div className="flex items-center gap-3.5 px-1">
          <div className="h-14 w-14 animate-pulse rounded-full bg-ds-surface2" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-7 w-40 animate-pulse rounded-lg bg-ds-surface2" />
            <div className="h-4 w-48 animate-pulse rounded bg-ds-surface2" />
          </div>
        </div>
        <div className="flex flex-col gap-3.5 rounded-[22px] border border-ds-line bg-ds-surface p-[18px]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="h-11 w-11 animate-pulse rounded-full bg-ds-surface2" />
              <div className="h-10 w-28 animate-pulse rounded-lg bg-ds-surface2" />
            </div>
            <div className="h-8 w-24 animate-pulse rounded-[10px] bg-ds-surface2" />
          </div>
          <div className="h-2.5 w-full animate-pulse rounded-[5px] bg-ds-surface2" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-ds-surface2" />
          <div className="h-[52px] w-full animate-pulse rounded-[14px] bg-ds-surface2" />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-[18px] bg-ds-bg px-4 pb-28 pt-8">
      {/* Identity */}
      <div className="flex items-center gap-3.5 px-1">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="h-14 w-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            style={avatarColor ? { backgroundColor: avatarColor } : undefined}
            className={cn(
              'font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-2xl font-extrabold',
              avatarColor ? 'text-white' : 'bg-ds-accentsoft text-ds-accenttext'
            )}
          >
            {initialLetter(shownName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingName(false)}
              onBlur={() => setEditingName(false)}
              maxLength={40}
              autoFocus
              className="w-full rounded-xl border-2 border-ds-accent bg-ds-surface px-3 py-1.5 font-display text-[26px] font-extrabold text-ds-text focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="group flex max-w-full items-center gap-2 text-left"
            >
              <h1 className="font-display truncate text-[26px] font-extrabold leading-tight text-ds-text">
                {shownName}
              </h1>
              <PencilSimple
                size={16}
                weight="bold"
                className="shrink-0 text-ds-text2 group-hover:text-ds-text"
              />
            </button>
          )}
          {memberSince ? (
            <p className="mt-0.5 text-sm text-ds-text2">{memberSince}</p>
          ) : email ? (
            <p className="mt-0.5 truncate text-sm text-ds-text2">{email}</p>
          ) : null}
        </div>
      </div>

      {dirty || saved ? (
        <div className="flex flex-col gap-1.5 px-1">
          {saveError ? (
            <p className="text-sm text-ds-danger">{saveError}</p>
          ) : null}
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
        </div>
      ) : null}

      {/* Grains + level */}
      <section className="flex flex-col gap-3.5 rounded-[22px] border border-ds-line bg-ds-surface p-[18px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ds-accentsoft text-ds-accenttext">
              <CoffeeBean size={22} weight="regular" aria-hidden />
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-display text-[40px] font-extrabold leading-none tabular-nums text-ds-text">
                {grains}
              </span>
              <span className="text-base font-semibold text-ds-text2">
                Grains
              </span>
            </div>
          </div>
          <span className="shrink-0 rounded-[10px] bg-ds-accentsoft px-2.5 py-1.5 text-sm font-bold text-ds-accenttext">
            {progress.current.name}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            className="h-2.5 overflow-hidden rounded-[5px] bg-ds-surface2"
            role="img"
            aria-label={
              progress.next
                ? `${lifetime} sur ${progress.next.threshold} Grains gagnés`
                : `${lifetime} Grains gagnés — niveau max`
            }
          >
            <div
              className="h-full rounded-[5px] bg-ds-accent transition-[width] duration-500"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
          <span className="text-sm text-ds-text2">
            {progress.next
              ? `Encore ${progress.remaining} Grain${progress.remaining > 1 ? 's' : ''} à gagner pour devenir ${progress.next.name}`
              : 'Niveau max atteint — légende locale !'}
          </span>
        </div>

        <p
          className={cn(
            'm-0 rounded-xl px-3 py-2.5 text-[13px] font-semibold leading-snug',
            myGrains?.priority
              ? 'bg-ds-ok/10 text-ds-ok'
              : 'bg-ds-surface2 text-ds-text2'
          )}
        >
          {myGrains?.priority
            ? 'Accès prioritaire actif : des places te sont réservées sur les drops limités.'
            : `À ${PRIORITY_LIFETIME} Grains gagnés, des places te sont réservées sur les drops limités.`}
        </p>

        <details className="group">
          <summary className="cursor-pointer list-none text-sm font-bold text-ds-accent">
            Comment gagner des Grains
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {GRAINS_EARNING.map((row) => (
              <li key={row.label} className="flex gap-2.5 text-[13px] text-ds-text2">
                <span className="w-9 shrink-0 font-bold tabular-nums text-ds-accenttext">
                  +{row.amount}
                </span>
                {row.label}
              </li>
            ))}
          </ul>
        </details>

      </section>

      {myEvents.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="font-display px-1 text-[19px] font-bold text-ds-text">
            Mes prochains événements
          </h2>
          {myEvents.map((drop) => {
            const Icon = EVENT_CATEGORY_ICONS[drop.event_category ?? 'other'];
            return (
              <Link
                key={drop.id}
                href={`/drop/${drop.id}`}
                className="flex items-center gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-3.5 no-underline"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ds-accentsoft text-ds-accenttext">
                  <Icon size={20} weight="bold" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold text-ds-text">
                    {drop.title}
                  </span>
                  <span className="truncate text-[13px] font-medium text-ds-text2">
                    {drop.places?.name ?? 'Café'} ·{' '}
                    {isDropLive(drop) ? 'En ce moment' : formatStartLabel(drop.start_time)}
                  </span>
                </span>
                <CaretRight size={18} weight="bold" className="ml-auto shrink-0 text-ds-text2" />
              </Link>
            );
          })}
        </section>
      ) : null}

      {/* Badges (from gamification) */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display px-1 text-[19px] font-bold text-ds-text">
          Mes badges
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {GRAIN_BADGES.map((badge) => {
            const unlocked = lifetime >= badge.threshold;
            return (
              <div
                key={badge.name}
                className={cn(
                  'relative flex flex-col items-center rounded-[18px] border px-3 py-4 text-center',
                  unlocked
                    ? 'border-ds-line bg-ds-surface'
                    : 'border-ds-line/60 bg-ds-surface2/50 opacity-55'
                )}
              >
                {!unlocked && (
                  <Lock
                    size={12}
                    weight="fill"
                    className="absolute right-2.5 top-2.5 text-ds-text2"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'mb-1.5 text-3xl leading-none',
                    !unlocked && 'grayscale'
                  )}
                >
                  {badge.icon}
                </span>
                <p
                  className={cn(
                    'text-sm font-extrabold',
                    unlocked ? 'text-ds-text' : 'text-ds-text2'
                  )}
                >
                  {badge.name}
                </p>
                <p className="mt-0.5 text-[11px] text-ds-text2">
                  {badge.threshold === 0
                    ? 'Débloqué'
                    : `${badge.threshold} Grains gagnés`}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Contributions */}
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="font-display text-[19px] font-bold text-ds-text">
            Mes contributions
          </h2>
          {shownContribs.length > PREVIEW_CONTRIBS ? (
            <button
              type="button"
              onClick={() => setShowAllContribs((v) => !v)}
              className="inline-flex h-11 items-center text-[15px] font-bold text-ds-accent"
            >
              {showAllContribs ? 'Réduire' : 'Tout voir'}
            </button>
          ) : null}
        </div>

        {showContribLoading ? (
          <div className="rounded-[22px] border border-ds-line bg-ds-surface p-6">
            <div className="h-4 w-2/3 animate-pulse rounded bg-ds-surface2" />
          </div>
        ) : shownContribs.length === 0 ? (
          <div className="rounded-[22px] border border-ds-line bg-ds-surface py-8">
            <EmptyState
              icon={<MapPin weight="regular" />}
              title="Aucune contribution"
              description="Dis « Je suis ici » dans un café pour gagner tes premiers Grains."
              actionLabel="Voir la carte"
              onAction={() => router.push('/map')}
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-[22px] border border-ds-line bg-ds-surface">
            {visibleContribs.map((item, i) => (
              <div
                key={item.id}
                className={cn(
                  'flex min-h-14 items-center gap-3 px-3.5',
                  i > 0 && 'border-t border-ds-line'
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-accentsoft text-ds-accenttext">
                  <ContributionIcon item={item} />
                </span>
                <div className="min-w-0 flex-1 py-2">
                  <p className="truncate text-[15px] font-bold text-ds-text">
                    {item.title}
                  </p>
                  <p className="truncate text-[13px] text-ds-text2">
                    {item.placeName}
                    {item.createdAt ? ` · ${formatWhen(item.createdAt)}` : ''}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 text-[15px] font-bold tabular-nums',
                    item.gain < 0 ? 'text-ds-text2' : 'text-ds-accenttext'
                  )}
                >
                  {item.gain > 0 ? `+${item.gain}` : item.gain}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Settings */}
      <section className="flex flex-col gap-2">
        <h2 className="font-display px-1 text-[19px] font-bold text-ds-text">
          Réglages
        </h2>
        <div className="overflow-hidden rounded-[22px] border border-ds-line bg-ds-surface">
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
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="font-display text-[19px] font-bold text-ds-text">
            Mes envies
          </h2>
          <Link
            href="/onboarding?edit=1"
            className="text-sm font-bold text-ds-accenttext no-underline hover:underline"
          >
            Modifier
          </Link>
        </div>
        {envies.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {envies.map((id) => {
              const EnvieIcon = ENVIE_ICONS[id];
              return (
                <span
                  key={id}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[18px] bg-ds-accentsoft px-3.5 text-sm font-semibold text-ds-accenttext"
                >
                  <EnvieIcon size={16} aria-hidden />
                  {envieLabel(id)}
                </span>
              );
            })}
          </div>
        ) : (
          <Link href="/onboarding?edit=1" className="no-underline">
            <Button variant="tonal" className="w-full">
              Choisir mes envies
            </Button>
          </Link>
        )}
        <p className="px-1 text-xs text-ds-text2">
          On s’en sert pour te proposer les cafés et les drops qui te ressemblent.
        </p>
      </section>

      <div className="flex flex-col gap-2 pt-2">
        {isAuthenticated && isPro ? (
          <Link
            href="/dashboard-pro"
            className="no-underline"
            onClick={() => writeDropspotMode('pro')}
          >
            <Button variant="tonal" className="w-full">
              Espace pro
            </Button>
          </Link>
        ) : null}
        <Button
          variant="outline"
          onClick={() => void signOut()}
          className="w-full"
        >
          <SignOut size={20} weight="bold" />
          Se déconnecter
        </Button>
        <Link
          href="/pro"
          className="py-1 text-center text-sm font-semibold text-ds-text2 underline decoration-ds-line underline-offset-2"
        >
          Je suis un café
        </Link>
        <Link
          href="/map"
          className="py-2 text-center text-sm font-semibold text-ds-text2"
        >
          Retour à la carte
        </Link>
      </div>
    </main>
  );
}
