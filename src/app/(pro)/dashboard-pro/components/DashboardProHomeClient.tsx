"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Check,
  Lightning,
  Lock,
  Plus,
  WifiSlash,
} from "@phosphor-icons/react";
import DropCard from "@/components/pro/DropCard";
import StatTile from "@/components/pro/StatTile";
import ProLock from "@/components/pro/ProLock";
import ConfirmDialog from "@/components/pro/ConfirmDialog";
import StatusTag from "@/components/pro/StatusTag";
import QuickDropSheet from "@/app/(pro)/dashboard-pro/components/QuickDropSheet";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import { useVendorProfile } from "@/app/(pro)/dashboard-pro/hooks/useVendorProfile";
import { useVendorPlan } from "@/hooks/useVendorPlan";
import { useAuth } from "@/lib/hooks/useAuth";
import {
  duplicateFlashDrop,
  loadProHomeSnapshot,
  stopFlashDrop,
  type PlaceHomeMeta,
} from "@/app/(pro)/dashboard-pro/lib/api/proHome";
import type { FlashDrop } from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import type { VendorTodayStats } from "@/app/(pro)/dashboard-pro/lib/api/validate";
import {
  FREE_STATS_MAX_DAYS,
  getPlaceSummary,
  type PlaceSummary,
} from "@/app/(pro)/dashboard-pro/lib/api/stats";
import {
  buildChecklistTasks,
  countChecklistDone,
  showWelcomeChecklist,
  CHECKLIST_TOTAL,
} from "@/app/(pro)/dashboard-pro/lib/proHome/checklist";
import { formatParisDateLong, formatParisSnapshotLabel } from "@/app/(pro)/dashboard-pro/lib/proHome/parisTime";
import {
  flashDropEndLabel,
  flashDropProgress,
  flashDropStockLabel,
  validatorDisplayName,
} from "@/app/(pro)/dashboard-pro/lib/proHome/display";
import { supabase } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import type { Place } from "@/lib/api/places";

/** Internal /statistiques page — enable when that route ships. */
const STATS_PAGE_ENABLED = false;

function firstName(full: string | null | undefined): string {
  const t = full?.trim();
  if (!t) return "là";
  return t.split(/\s+/)[0] ?? t;
}

type LoadedProps = {
  place: Place;
  role: string | null;
  hasPro: boolean;
  greeting: string;
  actorName: string | null;
  withCafe: (path: string) => string;
};

function DashboardProHomeLoaded({
  place,
  role,
  hasPro,
  greeting,
  actorName,
  withCafe,
}: LoadedProps) {
  const router = useRouter();
  const placeId = place.id;
  const dateParis = useMemo(() => formatParisDateLong(new Date()), []);

  const [stats, setStats] = useState<VendorTodayStats | null>(null);
  const [liveDrops, setLiveDrops] = useState<FlashDrop[]>([]);
  const [meta, setMeta] = useState<PlaceHomeMeta | null>(null);
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [stopTarget, setStopTarget] = useState<FlashDrop | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [quickDropOpen, setQuickDropOpen] = useState(false);
  const [weekSummary, setWeekSummary] = useState<PlaceSummary | null>(null);
  const [weekLoading, setWeekLoading] = useState(false);
  const isPendingVerification =
    meta?.verificationStatus != null
      ? meta.verificationStatus !== "verified"
      : place.verification_status != null &&
        place.verification_status !== "verified";
  const canCreateDrop = role === "owner" || role === "manager";
  const canViewWeekStats = role === "owner" || role === "manager";
  const checklistDone = meta ? countChecklistDone(meta.checklist) : 0;

  const checklistTasks = useMemo(() => {
    if (!meta) return [];
    return buildChecklistTasks(meta.checklist, {
      photo: withCafe("/etablissement"),
      hours: withCafe("/etablissement"),
      description: withCafe("/etablissement"),
      drop: withCafe("/dashboard-pro/drops/nouveau"),
    });
  }, [meta, withCafe]);

  const applySnapshot = useCallback((snap: Awaited<ReturnType<typeof loadProHomeSnapshot>>) => {
    setStats(snap.stats);
    setLiveDrops(snap.liveDrops);
    setMeta(snap.meta);
    setFetchedAt(snap.fetchedAt);
    setNetworkError(false);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const snap = await loadProHomeSnapshot(placeId);
      applySnapshot(snap);
    } catch {
      setNetworkError(true);
    } finally {
      setLoading(false);
    }
  }, [applySnapshot, placeId]);

  useEffect(() => {
    let cancelled = false;
    void loadProHomeSnapshot(placeId)
      .then((snap) => {
        if (cancelled) return;
        applySnapshot(snap);
      })
      .catch(() => {
        if (!cancelled) setNetworkError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applySnapshot, placeId]);

  useEffect(() => {
    if (!canViewWeekStats) return;
    let cancelled = false;
    startTransition(() => {
      setWeekLoading(true);
    });
    void getPlaceSummary(placeId, FREE_STATS_MAX_DAYS)
      .then((summary) => {
        if (!cancelled) setWeekSummary(summary);
      })
      .catch(() => {
        if (!cancelled) setWeekSummary(null);
      })
      .finally(() => {
        if (!cancelled) setWeekLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canViewWeekStats, placeId]);

  const liveDropIdsKey = useMemo(
    () =>
      liveDrops
        .map((d) => d.id)
        .sort()
        .join(","),
    [liveDrops]
  );

  useEffect(() => {
    const client = supabase;
    if (!client || !liveDropIdsKey) return;

    const channel = client.channel(`pro-home-${placeId}`);
    const bump = () => {
      void refresh();
    };

    for (const id of liveDropIdsKey.split(",")) {
      if (!id) continue;
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drop_codes",
          filter: `flash_drop_id=eq.${id}`,
        },
        bump
      );
    }

    channel.subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [liveDropIdsKey, placeId, refresh]);

  useEffect(() => {
    if (!networkError) return;
    const id = window.setInterval(() => {
      if (navigator.onLine) void refresh();
    }, 15000);
    return () => window.clearInterval(id);
  }, [networkError, refresh]);

  const handleStopConfirm = async () => {
    if (!stopTarget) return;
    setActionLoading(true);
    setStopError(null);
    try {
      const result = await stopFlashDrop(stopTarget.id);
      if (!result.ok) {
        setStopError(
          result.error
            ? `Impossible d'arrêter ce drop (${result.error}).`
            : "Impossible d'arrêter ce drop. Réessaie."
        );
        return;
      }
      setStopTarget(null);
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (drop: FlashDrop) => {
    setActionLoading(true);
    try {
      await duplicateFlashDrop(drop);
      await refresh();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  const validations = stats?.validations ?? [];
  const usedToday = stats?.validations_today ?? 0;
  const liveCount = liveDrops.length;
  const statsMuted = isPendingVerification;
  // No figures while loading or when the summary failed: never show a fake 0.
  const weekMuted = statsMuted || weekLoading || weekSummary == null;

  return (
    <div className="flex flex-col gap-5 pb-6 lg:gap-5">
      {networkError && fetchedAt ? (
        <div className="mx-4 flex flex-col gap-2 rounded-[14px] bg-ds-warnsoft px-4 py-3.5 text-sm font-semibold text-ds-warn lg:mx-8">
          <span>
            Connexion perdue. Ce que tu vois date de{" "}
            {formatParisSnapshotLabel(fetchedAt)} ; on réessaie tout seul.
          </span>
          <button
            type="button"
            className="self-start font-bold underline"
            onClick={() => void refresh()}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {isPendingVerification ? (
        <div className="mx-4 rounded-[14px] bg-ds-warnsoft px-4 py-3.5 text-sm font-semibold text-ds-warn lg:mx-8">
          On vérifie que {place.name} est bien à toi… Tu peux déjà{" "}
          <Link
            href={withCafe("/etablissement")}
            className="font-bold text-ds-warn underline"
          >
            préparer ta fiche
          </Link>
          .
        </div>
      ) : null}

      {/* Mobile header */}
      <div className="flex flex-col gap-3 px-4 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display m-0 text-[26px] font-extrabold text-ds-text">
              Aujourd&apos;hui
            </h1>
            <p className="m-0 mt-0.5 text-sm text-ds-text2">{dateParis}</p>
          </div>
          {canCreateDrop ? (
            <button
              type="button"
              disabled={isPendingVerification}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold",
                isPendingVerification
                  ? "cursor-not-allowed bg-ds-surface2 text-ds-text2"
                  : "bg-ds-accent text-ds-onaccent"
              )}
              aria-disabled={isPendingVerification}
              onClick={() => {
                if (!isPendingVerification) setQuickDropOpen(true);
              }}
            >
              {isPendingVerification ? (
                <Lock size={18} weight="bold" aria-hidden />
              ) : (
                <Lightning size={18} weight="bold" aria-hidden />
              )}
              Drop rapide
            </button>
          ) : null}
        </div>
        <div className="flex gap-2">
          <span className="rounded-full bg-ds-surface2 px-3 py-1.5 text-xs font-bold text-ds-text">
            {statsMuted ? "—" : usedToday} utilisés
          </span>
          <span className="rounded-full bg-ds-surface2 px-3 py-1.5 text-xs font-bold text-ds-text">
            {statsMuted ? "—" : liveCount} en cours
          </span>
        </div>
      </div>

      {/* Desktop header */}
      <header className="hidden items-center justify-between gap-4 border-b border-ds-line px-8 py-5 lg:flex">
        <div>
          <h1 className="font-display m-0 text-[26px] font-extrabold text-ds-text">
            Bonjour {greeting}
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            {place.name} · {dateParis}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {STATS_PAGE_ENABLED && canViewWeekStats ? (
            <Link
              href={withCafe("/statistiques")}
              className="inline-flex h-11 items-center gap-2 rounded-xl px-4 text-[15px] font-bold text-ds-accent no-underline"
            >
              Voir les statistiques
            </Link>
          ) : null}
          {isPendingVerification ? (
            <span className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-xl border border-ds-line bg-ds-surface2 px-4 text-[15px] font-bold text-ds-text2">
              <Lock size={18} weight="bold" aria-hidden />
              Drops bientôt disponibles
            </span>
          ) : (
            <Link
              href={withCafe("/dashboard-pro/drops/nouveau")}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ds-accent px-[18px] text-[15px] font-bold text-ds-onaccent no-underline"
            >
              <Plus size={20} weight="bold" aria-hidden />
              Créer un drop
            </Link>
          )}
        </div>
      </header>

      <div className="flex flex-col gap-5 px-4 lg:px-8">
        {meta && showWelcomeChecklist(checklistDone) ? (
          <section className="rounded-[18px] border border-ds-line bg-ds-surface p-5">
            <h2 className="font-display m-0 text-lg font-extrabold text-ds-text">
              Bienvenue, ton café est en ligne
            </h2>
            <p className="mt-1 text-sm text-ds-text2">
              {checklistDone} sur {CHECKLIST_TOTAL}
            </p>
            <ul className="mt-4 flex flex-col gap-0">
              {checklistTasks.map((task) => (
                <li
                  key={task.id}
                  className="flex min-h-14 items-center justify-between gap-3 border-t border-ds-line first:border-t-0"
                >
                  <span className="inline-flex items-center gap-3 text-[15px] font-semibold">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border-2",
                        task.done
                          ? "border-ds-ok bg-ds-oksoft text-ds-ok"
                          : "border-ds-line bg-ds-surface2"
                      )}
                      aria-hidden
                    >
                      {task.done ? (
                        <Check size={18} weight="bold" />
                      ) : null}
                    </span>
                    {task.label}
                  </span>
                  {!task.done ? (
                    <Link
                      href={task.href}
                      className="shrink-0 text-sm font-bold text-ds-accent no-underline"
                    >
                      Faire
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-2 lg:gap-4">
          <StatTile
            label="Drops utilisés aujourd'hui"
            value={statsMuted ? "—" : usedToday}
            muted={statsMuted}
          />
          <StatTile
            label="Drops en cours"
            value={statsMuted ? "—" : liveCount}
            muted={statsMuted}
          />
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display m-0 text-lg font-bold text-ds-text">
              En cours
            </h2>
            <Link
              href={withCafe("/dashboard-pro/drops")}
              className="text-sm font-bold text-ds-accent no-underline"
            >
              Tous les drops
            </Link>
          </div>
          {liveDrops.length === 0 ? (
            <p className="text-sm text-ds-text2">Aucun drop en cours.</p>
          ) : (
            <div className="grid gap-3.5 lg:grid-cols-2">
              {liveDrops.map((drop) => (
                <DropCard
                  key={drop.id}
                  status="live"
                  title={drop.title}
                  endsAt={drop.ends_at}
                  endTimeLabel={flashDropEndLabel(drop)}
                  stockLabel={flashDropStockLabel(drop)}
                  progress={flashDropProgress(drop)}
                  onStop={() => setStopTarget(drop)}
                  onDuplicate={() => void handleDuplicate(drop)}
                  className={actionLoading ? "opacity-70" : undefined}
                />
              ))}
            </div>
          )}
        </section>

        {canViewWeekStats ? (
          <section className="flex flex-col gap-3">
            <div>
              <h2 className="font-display m-0 text-lg font-bold text-ds-text">
                Ta semaine
              </h2>
              <p className="m-0 mt-0.5 text-sm text-ds-text2">
                7 derniers jours
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <StatTile
                label="vues de ta fiche"
                value={weekMuted ? "—" : weekSummary.views}
                muted={weekMuted}
              />
              <StatTile
                label="passages confirmés"
                value={weekMuted ? "—" : weekSummary.check_ins}
                muted={weekMuted}
              />
              <StatTile
                label="favoris ajoutés"
                value={weekMuted ? "—" : weekSummary.saves}
                muted={weekMuted}
              />
              <StatTile
                label="codes utilisés"
                value={weekMuted ? "—" : weekSummary.codes_redeemed}
                muted={weekMuted}
              />
            </div>
            {!hasPro ? (
              <ProLock
                variant="row"
                label="Compare avec la semaine d'avant et vois tes heures de pointe"
                onUnlock={
                  role === "owner"
                    ? () => router.push(withCafe("/abonnement"))
                    : undefined
                }
              />
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="font-display m-0 text-lg font-bold text-ds-text">
            Utilisés aujourd&apos;hui · Heure de Paris
          </h2>
          {validations.length === 0 ? (
            <p className="text-sm text-ds-text2">
              Aucune validation pour l&apos;instant.
            </p>
          ) : (
            <div className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
              {validations.map((row, i) => (
                <div
                  key={`${row.time}-${row.code}-${i}`}
                  className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-1 border-t border-ds-line px-4 py-2 first:border-t-0"
                >
                  <span className="w-12 shrink-0 font-bold tabular-nums text-ds-text">
                    {row.time}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold text-ds-text">
                    {row.drop}
                  </span>
                  <span className="text-sm text-ds-text2">
                    Code {row.code}
                  </span>
                  <span className="text-sm text-ds-text2">
                    par {validatorDisplayName(row.validator, actorName)}
                  </span>
                  <StatusTag variant="ok">Validé</StatusTag>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={Boolean(stopTarget)}
        title="Arrêter ce drop ?"
        description={
          stopError ??
          "Les clients ne pourront plus utiliser leurs codes pour cette offre."
        }
        confirmLabel="Arrêter"
        cancelLabel="Annuler"
        danger
        onCancel={() => {
          setStopTarget(null);
          setStopError(null);
        }}
        onConfirm={() => void handleStopConfirm()}
      />

      {networkError && !fetchedAt ? (
        <div className="mx-4 flex flex-col items-center gap-3 py-10 text-center lg:mx-8">
          <WifiSlash size={32} className="text-ds-text2" aria-hidden />
          <p className="text-sm text-ds-text2">
            Impossible de charger l&apos;accueil.
          </p>
          <button
            type="button"
            className="font-bold text-ds-accent"
            onClick={() => void refresh()}
          >
            Réessayer
          </button>
        </div>
      ) : null}

      <QuickDropSheet
        open={quickDropOpen}
        place={place}
        role={role}
        hasPro={hasPro}
        onClose={() => setQuickDropOpen(false)}
        onPublished={() => void refresh()}
      />
    </div>
  );
}

export default function DashboardProHomeClient() {
  const {
    activePlace,
    activeMemberRole,
    loading: placeLoading,
    withCafe,
  } = useActivePlace();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { profile } = useVendorProfile(isAuthenticated, authLoading);
  const { hasPro } = useVendorPlan(isAuthenticated && !authLoading);

  const greeting = firstName(profile?.full_name);

  if (placeLoading || authLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (!activePlace) {
    return (
      <p className="px-8 py-10 text-center text-ds-text2">
        Aucun établissement accessible.
      </p>
    );
  }

  return (
    <DashboardProHomeLoaded
      key={activePlace.id}
      place={activePlace}
      role={activeMemberRole}
      hasPro={hasPro}
      greeting={greeting}
      actorName={profile?.full_name ?? null}
      withCafe={withCafe}
    />
  );
}
