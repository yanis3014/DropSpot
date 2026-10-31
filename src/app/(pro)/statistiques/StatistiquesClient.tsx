'use client';

import { useEffect, useMemo, useState, useTransition, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChartBar, Lock } from '@phosphor-icons/react';
import StatTile from '@/components/pro/StatTile';
import ProLock from '@/components/pro/ProLock';
import PlanBadge from '@/components/pro/PlanBadge';
import ProEmptyState from '@/components/pro/ProEmptyState';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { useVendorPlan } from '@/hooks/useVendorPlan';
import { useAuth } from '@/lib/hooks/useAuth';
import { ENVIE_OPTIONS } from '@/lib/onboarding';
import {
  crowdConfig,
  wifiConfig,
  type CrowdLevel,
  type WifiStatus,
} from '@/lib/api/checkins';
import {
  formatParisDateShort,
} from '@/app/(pro)/dashboard-pro/lib/proDrops/display';
import { formatParisTimeHHMM } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';
import {
  FREE_STATS_MAX_DAYS,
  getPlaceInsights,
  getPlaceSummary,
  PLACE_SUMMARY_PERIODS,
  PlaceSummaryError,
  type PlaceInsights,
  type PlaceSummary,
  type PlaceSummaryDays,
} from '@/app/(pro)/dashboard-pro/lib/api/stats';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'] as const;
const HOUR_FROM = 8;
const HOUR_TO = 22;

type Trend = { label: string; tone: 'up' | 'neutral' | 'new' };

function trendVsPrevious(current: number, previous: number): Trend {
  if (previous === 0) {
    return current > 0
      ? { label: 'nouveau', tone: 'new' }
      : { label: '—', tone: 'neutral' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct > 0) return { label: `+${pct} %`, tone: 'up' };
  if (pct < 0) return { label: `${pct} %`, tone: 'neutral' };
  return { label: '0 %', tone: 'neutral' };
}

function formatShare(share: number): string {
  return `${Math.round(share * 100)} %`;
}

function BarChart({
  values,
  labels,
  locked,
}: {
  values: number[];
  labels: string[];
  locked?: boolean;
}) {
  const max = Math.max(1, ...values);
  return (
    <div
      className={cn(
        'flex items-end gap-1.5 sm:gap-2',
        locked && 'pointer-events-none select-none blur-[2px] opacity-50'
      )}
      aria-hidden={locked || undefined}
    >
      {values.map((v, i) => (
        <div key={labels[i] ?? i} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex h-28 w-full items-end justify-center">
            <div
              className="w-full max-w-[28px] rounded-t-md bg-ds-accent"
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            />
          </div>
          <span className="truncate text-[11px] font-semibold text-ds-text2">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function HBarList({
  rows,
  locked,
}: {
  rows: { label: string; value: number; display: string }[];
  locked?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul
      className={cn(
        'm-0 flex list-none flex-col gap-3 p-0',
        locked && 'pointer-events-none select-none blur-[2px] opacity-50'
      )}
    >
      {rows.map((row) => (
        <li key={row.label} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-semibold text-ds-text">{row.label}</span>
            <span className="shrink-0 text-ds-text2">{row.display}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ds-surface2">
            <div
              className="h-full rounded-full bg-ds-accent"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function MetricTile({
  label,
  value,
  trend,
  muted,
}: {
  label: string;
  value: string | number;
  trend?: Trend;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[18px] border border-ds-line bg-ds-surface px-5 py-[18px]">
      <span className="text-sm font-semibold text-ds-text2">{label}</span>
      <span
        className={cn(
          'font-display text-[34px] font-extrabold leading-none',
          muted ? 'text-ds-text2' : 'text-ds-text'
        )}
      >
        {value}
      </span>
      {trend ? (
        <span
          className={cn(
            'text-sm font-bold',
            trend.tone === 'up' && 'text-ds-ok',
            trend.tone === 'new' && 'text-ds-accent',
            trend.tone === 'neutral' && 'text-ds-text2'
          )}
        >
          {trend.label}
        </span>
      ) : null}
    </div>
  );
}

function LockedSection({
  title,
  children,
  onUnlock,
}: {
  title: string;
  children: ReactNode;
  onUnlock: () => void;
}) {
  return (
    <section className="relative flex flex-col gap-4 rounded-[18px] border border-ds-line bg-ds-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
          {title}
        </h2>
        <PlanBadge plan="pro" />
      </div>
      <div className="relative">
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-ds-surface/60 backdrop-blur-[1px]">
          <ProLock
            variant="row"
            label="Réservé à Pro"
            actionLabel="Voir l’abonnement"
            onUnlock={onUnlock}
            className="max-w-md shadow-sm"
          />
        </div>
      </div>
    </section>
  );
}

export default function StatistiquesClient() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasPro, loading: planLoading } = useVendorPlan(
    isAuthenticated && !authLoading
  );
  const {
    activePlace,
    activeMemberRole,
    loading: placeLoading,
    withCafe,
  } = useActivePlace();

  const [days, setDays] = useState<PlaceSummaryDays>(30);
  const [summary, setSummary] = useState<PlaceSummary | null>(null);
  const [insights, setInsights] = useState<PlaceInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const isOwner = activeMemberRole === 'owner';
  const canView =
    activeMemberRole === 'owner' || activeMemberRole === 'manager';
  const isVerified = activePlace?.verification_status === 'verified';
  const effectiveDays: PlaceSummaryDays = hasPro ? days : FREE_STATS_MAX_DAYS;

  useEffect(() => {
    if (!activePlace || !canView || placeLoading || planLoading) return;
    if (!isVerified) {
      startTransition(() => {
        setSummary(null);
        setInsights(null);
        setLoading(false);
        setError(null);
      });
      return;
    }

    let cancelled = false;
    startTransition(() => {
      setLoading(true);
      setError(null);
    });

    const run = async () => {
      try {
        if (hasPro) {
          const data = await getPlaceInsights(activePlace.id, days);
          if (cancelled) return;
          startTransition(() => {
            setInsights(data);
            setSummary(data.current);
          });
        } else {
          const data = await getPlaceSummary(
            activePlace.id,
            FREE_STATS_MAX_DAYS
          );
          if (cancelled) return;
          startTransition(() => {
            setInsights(null);
            setSummary(data);
          });
        }
      } catch (err) {
        console.error(err);
        if (cancelled) return;
        const code =
          err instanceof PlaceSummaryError ? err.code : 'unknown';
        startTransition(() => {
          setInsights(null);
          setSummary(null);
          setError(
            code === 'forbidden'
              ? 'Tu n’as pas accès aux statistiques de ce café.'
              : code === 'pro_required'
                ? 'Passe en Pro pour débloquer les statistiques détaillées.'
                : 'Impossible de charger les statistiques.'
          );
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [
    activePlace,
    canView,
    days,
    hasPro,
    isVerified,
    placeLoading,
    planLoading,
  ]);

  const unlock = () => router.push(withCafe('/abonnement'));

  const hourValues = useMemo(() => {
    const src = insights?.by_hour ?? Array.from({ length: 24 }, () => 0);
    return src.slice(HOUR_FROM, HOUR_TO + 1);
  }, [insights]);

  const hourLabels = useMemo(
    () =>
      Array.from(
        { length: HOUR_TO - HOUR_FROM + 1 },
        (_, i) => `${HOUR_FROM + i} h`
      ),
    []
  );

  const weekdayValues = insights?.by_weekday ?? Array.from({ length: 7 }, () => 0);

  const audienceRows = useMemo(() => {
    if (!insights?.audience) return [];
    return ENVIE_OPTIONS.map((opt) => {
      const share = insights.audience?.[opt.id] ?? 0;
      return {
        label: opt.label,
        value: share,
        display: formatShare(share),
      };
    }).filter((r) => r.value > 0);
  }, [insights]);

  const crowdRows = useMemo(() => {
    const map = insights?.crowd ?? {};
    return (Object.keys(crowdConfig) as CrowdLevel[]).map((level) => ({
      label: crowdConfig[level].label,
      value: map[level] ?? 0,
      display: String(map[level] ?? 0),
    }));
  }, [insights]);

  const wifiRows = useMemo(() => {
    const map = insights?.wifi ?? {};
    return (Object.keys(wifiConfig) as WifiStatus[]).map((level) => ({
      label: wifiConfig[level].label,
      value: map[level] ?? 0,
      display: String(map[level] ?? 0),
    }));
  }, [insights]);

  if (placeLoading || authLoading) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (!activePlace) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <ProEmptyState
          icon={<ChartBar size={32} weight="bold" aria-hidden />}
          title="Aucun café"
          description="Choisis un café pour voir ses statistiques."
        />
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <ProEmptyState
          tone="danger"
          icon={<Lock size={32} weight="bold" aria-hidden />}
          title="Accès réservé"
          description="Seuls le gérant et les responsables peuvent voir les statistiques."
          actionLabel="Retour à l’accueil"
          onAction={() => router.push(withCafe('/dashboard-pro'))}
        />
      </div>
    );
  }

  if (!isVerified) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 lg:px-8">
        <header className="flex flex-col gap-1">
          <h1 className="font-display m-0 text-[28px] font-extrabold text-ds-text">
            Statistiques
          </h1>
        </header>
        <div className="rounded-[14px] bg-ds-warnsoft px-4 py-3.5 text-sm font-semibold text-ds-warn">
          On vérifie que {activePlace.name} est bien à toi… Tu peux déjà{' '}
          <Link
            href={withCafe('/etablissement')}
            className="font-bold text-ds-warn underline"
          >
            préparer ta fiche
          </Link>
          .
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="vues de ta fiche" value="—" muted />
          <StatTile label="passages confirmés" value="—" muted />
          <StatTile label="favoris ajoutés" value="—" muted />
          <StatTile label="codes utilisés" value="—" muted />
        </div>
      </div>
    );
  }

  const current = summary;
  const previous = insights?.previous;
  const empty =
    !loading &&
    current != null &&
    current.views === 0 &&
    current.check_ins === 0 &&
    current.saves === 0 &&
    current.codes_redeemed === 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display m-0 text-[28px] font-extrabold text-ds-text">
            Statistiques
          </h1>
          <p className="m-0 mt-1 text-sm text-ds-text2">{activePlace.name}</p>
        </div>
        <div
          className="inline-flex rounded-xl border border-ds-line bg-ds-surface p-1"
          role="group"
          aria-label="Période"
        >
          {PLACE_SUMMARY_PERIODS.map((period) => {
            const selected = days === period;
            const needsPro = !hasPro && period > FREE_STATS_MAX_DAYS;
            return (
              <button
                key={period}
                type="button"
                onClick={() => setDays(period)}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-sm font-bold transition-colors',
                  selected
                    ? 'bg-ds-text text-ds-bg'
                    : 'text-ds-text2 hover:text-ds-text'
                )}
              >
                {period} j
                {needsPro ? <PlanBadge plan="pro" className="scale-90" /> : null}
              </button>
            );
          })}
        </div>
      </header>

      {error ? (
        <p className="m-0 rounded-[14px] bg-ds-dangersoft px-4 py-3 text-sm font-semibold text-ds-danger">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex min-h-[20vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
        </div>
      ) : empty ? (
        <ProEmptyState
          icon={<ChartBar size={32} weight="bold" aria-hidden />}
          title="Pas encore de données"
          description="Tes chiffres apparaîtront ici dès les premières visites."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            <MetricTile
              label="vues"
              value={current?.views ?? '—'}
              muted={!current}
              trend={
                hasPro && previous
                  ? trendVsPrevious(current?.views ?? 0, previous.views)
                  : undefined
              }
            />
            <MetricTile
              label="passages"
              value={current?.check_ins ?? '—'}
              muted={!current}
              trend={
                hasPro && previous
                  ? trendVsPrevious(
                      current?.check_ins ?? 0,
                      previous.check_ins
                    )
                  : undefined
              }
            />
            <MetricTile
              label="favoris"
              value={current?.saves ?? '—'}
              muted={!current}
              trend={
                hasPro && previous
                  ? trendVsPrevious(current?.saves ?? 0, previous.saves)
                  : undefined
              }
            />
            <MetricTile
              label="codes utilisés"
              value={current?.codes_redeemed ?? '—'}
              muted={!current}
              trend={
                hasPro && previous
                  ? trendVsPrevious(
                      current?.codes_redeemed ?? 0,
                      previous.codes_redeemed
                    )
                  : undefined
              }
            />
          </div>

          {!hasPro ? (
            <p className="m-0 text-sm text-ds-text2">
              Aperçu sur {effectiveDays} jours. Passe en Pro pour comparer les
              périodes et débloquer le détail.
            </p>
          ) : null}

          {hasPro && insights ? (
            <>
              <section className="flex flex-col gap-5 rounded-[18px] border border-ds-line bg-ds-surface p-5">
                <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
                  Quand les gens viennent
                </h2>
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm font-semibold text-ds-text2">
                    Par heure
                  </p>
                  <BarChart values={hourValues} labels={[...hourLabels]} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm font-semibold text-ds-text2">
                    Par jour
                  </p>
                  <BarChart
                    values={weekdayValues}
                    labels={[...WEEKDAY_LABELS]}
                  />
                </div>
              </section>

              <section className="flex flex-col gap-4 rounded-[18px] border border-ds-line bg-ds-surface p-5">
                <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
                  Tes drops
                </h2>
                {insights.drops.length === 0 ? (
                  <p className="m-0 text-sm text-ds-text2">
                    Aucun drop sur cette période.
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {insights.drops.map((drop) => {
                      const rate =
                        drop.codes_issued > 0
                          ? Math.round(
                              (drop.codes_redeemed / drop.codes_issued) * 100
                            )
                          : null;
                      return (
                        <li key={drop.id}>
                          <Link
                            href={withCafe(
                              `/dashboard-pro/drops/${drop.id}/modifier`
                            )}
                            className="flex flex-col gap-1 rounded-[14px] border border-ds-line px-4 py-3 no-underline transition-colors hover:bg-ds-surface2"
                          >
                            <span className="font-bold text-ds-text">
                              {drop.title}
                            </span>
                            <span className="text-sm text-ds-text2">
                              {formatParisDateShort(drop.starts_at)} · {formatParisTimeHHMM(drop.starts_at)} → {formatParisTimeHHMM(drop.ends_at)}
                            </span>
                            <span className="text-sm font-semibold text-ds-text">
                              {drop.codes_redeemed} / {drop.codes_issued} codes
                              utilisés
                              {rate != null ? ` · ${rate} %` : ''}
                            </span>
                            {drop.kind === 'activity' ? (
                              <span className="text-sm text-ds-text2">
                                {drop.present} / {drop.participants} présents
                              </span>
                            ) : null}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className="flex flex-col gap-4 rounded-[18px] border border-ds-line bg-ds-surface p-5">
                <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
                  Tes visiteurs
                </h2>
                <p className="m-0 text-sm text-ds-text2">
                  Habitués (au moins 2 jours de passage) :{' '}
                  <span className="font-bold text-ds-text">
                    {insights.returning_share == null
                      ? '—'
                      : formatShare(insights.returning_share)}
                  </span>
                </p>
                {insights.audience == null ? (
                  <p className="m-0 rounded-[14px] bg-ds-surface2 px-4 py-3 text-sm text-ds-text2">
                    Il faut au moins 5 visiteurs pour afficher ce profil, pour
                    qu’on ne puisse reconnaître personne.
                  </p>
                ) : audienceRows.length === 0 ? (
                  <p className="m-0 text-sm text-ds-text2">
                    Pas encore d’envies renseignées chez tes visiteurs.
                  </p>
                ) : (
                  <HBarList rows={audienceRows} />
                )}
              </section>

              <section className="flex flex-col gap-5 rounded-[18px] border border-ds-line bg-ds-surface p-5">
                <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
                  Ce que disent les clients
                </h2>
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm font-semibold text-ds-text2">
                    Affluence
                  </p>
                  <HBarList rows={crowdRows} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="m-0 text-sm font-semibold text-ds-text2">
                    Wi-Fi
                  </p>
                  <HBarList rows={wifiRows} />
                </div>
              </section>

              {isOwner && insights.team != null ? (
                <section className="flex flex-col gap-4 rounded-[18px] border border-ds-line bg-ds-surface p-5">
                  <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
                    Ton équipe
                  </h2>
                  {insights.team.length === 0 ? (
                    <p className="m-0 text-sm text-ds-text2">
                      Aucun code validé par l’équipe sur cette période.
                    </p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-2 p-0">
                      {insights.team.map((member, idx) => (
                        <li
                          key={`${member.first_name}-${idx}`}
                          className="flex items-center justify-between gap-3 rounded-[12px] bg-ds-surface2 px-4 py-3"
                        >
                          <span className="font-bold text-ds-text">
                            {member.first_name}
                          </span>
                          <span className="text-sm font-semibold text-ds-text2">
                            {member.codes_redeemed} code
                            {member.codes_redeemed === 1 ? '' : 's'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : null}
            </>
          ) : (
            <>
              <LockedSection title="Quand les gens viennent" onUnlock={unlock}>
                <BarChart
                  locked
                  values={[2, 4, 6, 8, 7, 5, 3, 4, 6, 5, 3, 2, 1, 1, 0]}
                  labels={[...hourLabels]}
                />
              </LockedSection>
              <LockedSection title="Tes drops" onUnlock={unlock}>
                <div className="h-16 rounded-[14px] bg-ds-surface2" />
              </LockedSection>
              <LockedSection title="Tes visiteurs" onUnlock={unlock}>
                <div className="h-20 rounded-[14px] bg-ds-surface2" />
              </LockedSection>
              <LockedSection
                title="Ce que disent les clients"
                onUnlock={unlock}
              >
                <div className="h-24 rounded-[14px] bg-ds-surface2" />
              </LockedSection>
              {isOwner ? (
                <LockedSection title="Ton équipe" onUnlock={unlock}>
                  <div className="h-14 rounded-[14px] bg-ds-surface2" />
                </LockedSection>
              ) : null}
              <Button variant="main" onClick={unlock} className="self-start">
                Passer en Pro
              </Button>
            </>
          )}
        </>
      )}
    </div>
  );
}
