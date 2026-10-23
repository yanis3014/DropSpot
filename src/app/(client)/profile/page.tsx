'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  CalendarCheck,
  CheckCircle,
  CoffeeBean,
  GearSix,
  Heart,
  PencilSimple,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import ProfileRow from '@/components/profile/ProfileRow';
import {
  getMyContributions,
  type ContributionItem,
} from '@/lib/api/contributions';
import { useAuth } from '@/lib/hooks/useAuth';
import { fetchIsPro } from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import { writeDropspotMode } from '@/lib/auth/dropspotMode';
import { useProfile } from '@/lib/hooks/useProfile';
import { badgeProgress } from '@/lib/grains';
import { getMyGrains, type MyGrains } from '@/lib/api/grains';
import { avatarColorHex, envieLabel } from '@/lib/onboarding';
import { cn } from '@/lib/cn';
import {
  formatStartLabel,
  getMyUpcomingEvents,
  isDropLive,
  type Drop,
} from '@/lib/api/drops';

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

function initialLetter(name: string): string {
  const t = name.trim();
  return t ? t.charAt(0).toUpperCase() : '?';
}

function eventsSubtitle(events: Drop[] | null): string {
  if (events === null) return '…';
  if (events.length === 0) return 'Aucun pour l’instant';
  const first = events[0];
  const when = isDropLive(first) ? 'en ce moment' : formatStartLabel(first.start_time);
  return `${events.length} à venir · ${first.title}, ${when}`;
}

function contributionsSubtitle(last: ContributionItem | null | undefined): string {
  if (last === undefined) return '…';
  if (last === null) return 'Dis « Je suis ici » dans un café';
  return `Dernière : ${last.title}${last.placeName ? ` · ${last.placeName}` : ''}`;
}

/** Profile summary: who you are, your Grains, then one line per topic. */
export default function ProfilePage() {
  const {
    user,
    isAuthenticated,
    loading: authLoading,
    email,
    avatarUrl,
    displayName,
    signOut,
  } = useAuth();
  const { profile, loading: profileLoading } = useProfile(
    isAuthenticated,
    authLoading
  );

  // null = not loaded yet, so neither pro nor client links flash.
  const [isPro, setIsPro] = useState<boolean | null>(null);
  const [myEvents, setMyEvents] = useState<Drop[] | null>(null);
  const [lastContrib, setLastContrib] = useState<
    ContributionItem | null | undefined
  >(undefined);
  const [myGrains, setMyGrains] = useState<MyGrains | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void fetchIsPro().then((value) => {
      if (!cancelled) setIsPro(value);
    });
    getMyUpcomingEvents()
      .then((rows) => {
        if (!cancelled) setMyEvents(rows);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setMyEvents([]);
      });
    void getMyContributions(1).then((rows) => {
      if (!cancelled) setLastContrib(rows[0] ?? null);
    });
    void getMyGrains().then((next) => {
      if (!cancelled) setMyGrains(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const grains = myGrains?.balance ?? profile?.grains_balance ?? 0;
  // Levels follow the Grains earned over time, so spending never loses one.
  const lifetime = myGrains?.lifetime ?? grains;
  const progress = useMemo(() => badgeProgress(lifetime), [lifetime]);
  const avatar = profile?.avatar_url ?? avatarUrl;
  const shownName = profile?.full_name?.trim() || displayName || 'Explorateur';
  const memberSince = formatMemberSince(
    user?.created_at ?? profile?.onboarding_completed_at
  );
  const avatarColor = avatarColorHex(profile?.onboarding_answers.avatarColor);
  const envies = profile?.onboarding_answers.envies ?? [];

  if (authLoading || profileLoading) {
    return (
      <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
        <div className="flex items-center gap-3.5 px-1">
          <div className="h-14 w-14 animate-pulse rounded-full bg-ds-surface2" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="h-7 w-40 animate-pulse rounded-lg bg-ds-surface2" />
            <div className="h-4 w-48 animate-pulse rounded bg-ds-surface2" />
          </div>
        </div>
        <div className="h-[132px] animate-pulse rounded-[22px] bg-ds-surface2" />
        <div className="h-[180px] animate-pulse rounded-[22px] bg-ds-surface2" />
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
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
          <h1 className="font-display truncate text-[26px] font-extrabold leading-tight text-ds-text">
            {shownName}
          </h1>
          {memberSince ? (
            <p className="mt-0.5 text-sm text-ds-text2">{memberSince}</p>
          ) : email ? (
            <p className="mt-0.5 truncate text-sm text-ds-text2">{email}</p>
          ) : null}
        </div>
        <Link
          href="/profile/reglages"
          aria-label="Modifier mon pseudo"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ds-text2 no-underline hover:text-ds-text"
        >
          <PencilSimple size={20} weight="bold" aria-hidden />
        </Link>
      </div>

      {/* Grains + level */}
      <Link
        href="/profile/grains"
        className="flex flex-col gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-4 text-ds-text no-underline"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ds-accentsoft text-ds-accenttext">
              <CoffeeBean size={20} weight="regular" aria-hidden />
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-[36px] font-extrabold leading-none tabular-nums">
                {grains}
              </span>
              <span className="text-base font-semibold text-ds-text2">
                Grains
              </span>
            </span>
          </div>
          <span className="shrink-0 rounded-[10px] bg-ds-accentsoft px-2.5 py-1.5 text-sm font-bold text-ds-accenttext">
            {progress.current.icon} {progress.current.name}
          </span>
        </div>
        <div
          className="h-2.5 overflow-hidden rounded-[5px] bg-ds-surface2"
          role="img"
          aria-label={
            progress.next
              ? `${lifetime} sur ${progress.next.threshold} Grains gagnés`
              : `${lifetime} Grains gagnés, niveau max`
          }
        >
          <div
            className="h-full rounded-[5px] bg-ds-accent transition-[width] duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <span className="flex items-center justify-between gap-3 text-[13px] text-ds-text2">
          <span className="min-w-0 truncate">
            {progress.next
              ? `Encore ${progress.remaining} pour devenir ${progress.next.name}`
              : 'Niveau max atteint'}
          </span>
          <span className="shrink-0 font-bold text-ds-accent">Détails ›</span>
        </span>
      </Link>

      <nav
        aria-label="Mon activité"
        className="flex flex-col overflow-hidden rounded-[22px] border border-ds-line bg-ds-surface"
      >
        <ProfileRow
          href="/profile/evenements"
          icon={<CalendarCheck size={18} aria-hidden />}
          title="Mes événements"
          subtitle={eventsSubtitle(myEvents)}
        />
        <ProfileRow
          href="/profile/contributions"
          icon={<CheckCircle size={18} aria-hidden />}
          title="Mes contributions"
          subtitle={contributionsSubtitle(lastContrib)}
        />
        <ProfileRow
          href="/profile/envies"
          icon={<Heart size={18} aria-hidden />}
          title="Mes envies"
          subtitle={
            envies.length > 0
              ? envies.map(envieLabel).join(', ')
              : 'À choisir'
          }
        />
      </nav>

      <nav
        aria-label="Compte"
        className="flex flex-col overflow-hidden rounded-[22px] border border-ds-line bg-ds-surface"
      >
        <ProfileRow
          href="/profile/reglages"
          icon={<GearSix size={18} aria-hidden />}
          title="Réglages"
          subtitle="Pseudo, thème, localisation"
          muted
        />
      </nav>

      {isPro ? (
        <Link
          href="/dashboard-pro"
          className="no-underline"
          onClick={() => writeDropspotMode('pro')}
        >
          <Button variant="tonal" className="w-full">
            <Briefcase size={20} weight="bold" />
            Espace pro
          </Button>
        </Link>
      ) : null}

      <div className="flex flex-col items-center gap-1 pt-1">
        <button
          type="button"
          onClick={() => void signOut()}
          className="min-h-11 px-3 text-[15px] font-semibold text-ds-danger"
        >
          Se déconnecter
        </button>
        {isPro === false ? (
          <Link
            href="/pro"
            className="py-2 text-center text-sm font-semibold text-ds-text2 underline decoration-ds-line underline-offset-2"
          >
            Tu tiens un café ? Rejoins Dropspot
          </Link>
        ) : null}
      </div>
    </main>
  );
}
