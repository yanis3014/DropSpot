"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightning, Plus, WifiSlash } from "@phosphor-icons/react";
import DropCard from "@/components/pro/DropCard";
import ConfirmDialog from "@/components/pro/ConfirmDialog";
import ProLock from "@/components/pro/ProLock";
import ProButtonSm from "@/components/pro/ProButtonSm";
import PlaceMemberRoleLoader from "@/app/(pro)/dashboard-pro/components/PlaceMemberRoleLoader";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import type { FlashDrop } from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import {
  FINISHED_PAGE_SIZE,
  getActiveAndScheduledDrops,
  getFinishedDropsPage,
} from "@/app/(pro)/dashboard-pro/lib/api/proDropsList";
import { stopFlashDrop } from "@/app/(pro)/dashboard-pro/lib/api/proHome";
import {
  flashDropEndLabel,
  flashDropProgress,
  flashDropStockLabel,
} from "@/app/(pro)/dashboard-pro/lib/proHome/display";
import {
  finishedDropTagLabel,
  flashDropFinishedStats,
  flashDropTypeSubtitle,
  formatDropTimeRange,
  formatDropWhenRange,
  formatParisDateShort,
  formatStartsInDaysLabel,
} from "@/app/(pro)/dashboard-pro/lib/proDrops/display";
import { DROP_FORM_EXAMPLES } from "@/app/(pro)/dashboard-pro/lib/proDrops/examples";
import { getMyVendorPlan } from "@/lib/api/vendorPlan";
import { cn } from "@/lib/cn";

const STATUT_PARAM = "statut";
const PAGE_PARAM = "page";

export type DropsStatutFilter =
  | "tous"
  | "en-cours"
  | "programmes"
  | "termines";

const FILTER_TABS: { id: DropsStatutFilter; label: string }[] = [
  { id: "tous", label: "Tous" },
  { id: "en-cours", label: "En cours" },
  { id: "programmes", label: "Programmés" },
  { id: "termines", label: "Terminés" },
];

const RECURRING_DROPS_ENABLED =
  process.env.NEXT_PUBLIC_PRO_RECURRING_DROPS === "true";

function parseStatut(raw: string | null): DropsStatutFilter {
  if (
    raw === "en-cours" ||
    raw === "programmes" ||
    raw === "termines" ||
    raw === "tous"
  ) {
    return raw;
  }
  return "tous";
}

function canManageDrops(role: string | null): boolean {
  return role === "owner" || role === "manager";
}

type DropsSnapshot = {
  placeId: string;
  finishedPage: number;
  live: FlashDrop[];
  scheduled: FlashDrop[];
  finished: FlashDrop[];
  finishedTotal: number;
  hasPro: boolean;
};

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="m-0 px-1 text-[13px] font-bold uppercase tracking-[0.06em] text-ds-text2">
      {children}
    </h2>
  );
}

function DropsCardStack({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
      {children}
    </div>
  );
}

function DropRowWrap({
  children,
  bordered,
}: {
  children: React.ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className={cn(
        "p-4 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4 lg:p-5",
        bordered && "border-t border-ds-line"
      )}
    >
      {children}
    </div>
  );
}

type LoadedProps = {
  placeId: string;
  placeName: string;
  role: string | null;
  withCafe: (path: string) => string;
};

function DashboardProDropsLoaded({
  placeId,
  placeName,
  role,
  withCafe,
}: LoadedProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statut = parseStatut(searchParams.get(STATUT_PARAM));
  const finishedPage = Math.max(
    1,
    Number.parseInt(searchParams.get(PAGE_PARAM) ?? "1", 10) || 1
  );

  const [snapshot, setSnapshot] = useState<DropsSnapshot | null>(null);
  const [networkError, setNetworkError] = useState(false);
  const [stopTarget, setStopTarget] = useState<FlashDrop | null>(null);
  const [stopLoading, setStopLoading] = useState(false);
  const [stopError, setStopError] = useState<string | null>(null);
  const [examplesOpen, setExamplesOpen] = useState(false);

  const manage = canManageDrops(role);

  const fetchDrops = useCallback(async () => {
    const [active, finishedPageResult, plan] = await Promise.all([
      getActiveAndScheduledDrops(placeId),
      getFinishedDropsPage(placeId, finishedPage),
      getMyVendorPlan(),
    ]);
    return {
      placeId,
      finishedPage,
      live: active.live,
      scheduled: active.scheduled,
      finished: finishedPageResult.drops,
      finishedTotal: finishedPageResult.total,
      hasPro: plan.hasPro,
    } satisfies DropsSnapshot;
  }, [placeId, finishedPage]);

  useEffect(() => {
    let cancelled = false;
    void fetchDrops()
      .then((next) => {
        if (!cancelled) {
          setSnapshot(next);
          setNetworkError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setNetworkError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchDrops]);

  const loading =
    !networkError &&
    (snapshot == null ||
      snapshot.placeId !== placeId ||
      snapshot.finishedPage !== finishedPage);

  const live = snapshot?.placeId === placeId ? snapshot.live : [];
  const scheduled = snapshot?.placeId === placeId ? snapshot.scheduled : [];
  const finished =
    snapshot?.placeId === placeId && snapshot.finishedPage === finishedPage
      ? snapshot.finished
      : [];
  const finishedTotal =
    snapshot?.placeId === placeId ? snapshot.finishedTotal : 0;
  const hasPro = snapshot?.hasPro ?? false;

  const counts = useMemo(
    () => ({
      live: live.length,
      scheduled: scheduled.length,
      finished: finishedTotal,
    }),
    [live.length, scheduled.length, finishedTotal]
  );

  const totalDrops = counts.live + counts.scheduled + counts.finished;
  const isEmpty = !loading && !networkError && totalDrops === 0;

  const reload = useCallback(async () => {
    try {
      const next = await fetchDrops();
      setSnapshot(next);
      setNetworkError(false);
    } catch {
      setNetworkError(true);
    }
  }, [fetchDrops]);

  const setStatut = (next: DropsStatutFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "tous") params.delete(STATUT_PARAM);
    else params.set(STATUT_PARAM, next);
    params.delete(PAGE_PARAM);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  };

  const setFinishedPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(STATUT_PARAM, "termines");
    if (page <= 1) params.delete(PAGE_PARAM);
    else params.set(PAGE_PARAM, String(page));
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const duplicateHref = (dropId: string) =>
    withCafe(`/dashboard-pro/drops/nouveau?depuis=${dropId}`);

  const editHref = (dropId: string) =>
    withCafe(`/dashboard-pro/drops/${dropId}/modifier`);

  const handleStopConfirm = async () => {
    if (!stopTarget) return;
    setStopLoading(true);
    setStopError(null);
    const result = await stopFlashDrop(stopTarget.id);
    setStopLoading(false);
    if (result.ok) {
      setStopTarget(null);
      await reload();
      return;
    }
    setStopError(
      result.error
        ? `Impossible d'arrêter ce drop (${result.error}).`
        : "Impossible d'arrêter ce drop. Réessaie."
    );
  };

  const recurringLocked = !hasPro || !RECURRING_DROPS_ENABLED;

  const showLive =
    statut === "tous" || statut === "en-cours" ? live.length > 0 : false;
  const showScheduled =
    statut === "tous" || statut === "programmes"
      ? scheduled.length > 0
      : false;
  const showFinished =
    statut === "tous" || statut === "termines" ? finished.length > 0 : false;

  const finishedPages = Math.max(
    1,
    Math.ceil(finishedTotal / FINISHED_PAGE_SIZE)
  );

  const stopValidatedCount = stopTarget?.current_uses ?? 0;

  return (
    <>
      <header className="hidden items-center justify-between gap-4 border-b border-ds-line px-8 py-5 lg:flex">
        <div>
          <h1 className="font-display m-0 text-[26px] font-extrabold text-ds-text">
            Drops flash
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            {placeName} · heures de Paris
          </p>
        </div>
        {manage ? (
          <div className="flex items-center gap-2.5">
            {recurringLocked ? (
              <ProLock
                label="Drop récurrent"
                onUnlock={() =>
                  router.push(withCafe("/abonnement"))
                }
              />
            ) : (
              <Link
                href={withCafe("/dashboard-pro/drops/nouveau?recurrent=1")}
                className="inline-flex h-11 items-center gap-2 rounded-xl border-[1.5px] border-ds-line bg-ds-surface px-[18px] text-[15px] font-bold text-ds-text no-underline"
              >
                Drop récurrent
              </Link>
            )}
            <Link
              href={withCafe("/dashboard-pro/drops/nouveau")}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ds-accent px-[18px] text-[15px] font-bold text-ds-onaccent no-underline"
            >
              <Plus size={20} weight="bold" aria-hidden />
              Créer un drop
            </Link>
          </div>
        ) : null}
      </header>

      <div className="flex flex-col gap-3.5 px-4 py-5 lg:px-8 lg:py-5">
        <div className="flex flex-col gap-3 lg:hidden">
          <div>
            <h1 className="font-display m-0 text-2xl font-extrabold text-ds-text">
              Drops flash
            </h1>
            <p className="m-0 mt-0.5 text-sm text-ds-text2">
              {placeName} · heures de Paris
            </p>
          </div>
          {manage ? (
            <div className="flex flex-wrap gap-2">
              {recurringLocked ? (
                <ProLock
                  label="Drop récurrent"
                  onUnlock={() => router.push(withCafe("/abonnement"))}
                />
              ) : null}
              <Link
                href={withCafe("/dashboard-pro/drops/nouveau")}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-ds-accent px-4 text-sm font-bold text-ds-onaccent no-underline"
              >
                <Plus size={18} weight="bold" aria-hidden />
                Créer un drop
              </Link>
            </div>
          ) : null}
        </div>

        <div
          className="inline-flex w-full max-w-full overflow-x-auto rounded-[14px] bg-ds-surface2 p-1"
          role="tablist"
          aria-label="Filtrer les drops"
        >
          {FILTER_TABS.map((tab) => {
            const count =
              tab.id === "en-cours"
                ? counts.live
                : tab.id === "programmes"
                  ? counts.scheduled
                  : tab.id === "termines"
                    ? counts.finished
                    : null;
            const label =
              count != null && tab.id !== "tous"
                ? `${tab.label} · ${count}`
                : tab.label;
            const active = statut === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={cn(
                  "h-9 shrink-0 rounded-[10px] px-3.5 text-sm font-bold whitespace-nowrap",
                  active
                    ? "bg-ds-surface text-ds-text shadow-sm"
                    : "bg-transparent text-ds-text2"
                )}
                onClick={() => setStatut(tab.id)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
          </div>
        ) : networkError ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <WifiSlash size={32} className="text-ds-text2" aria-hidden />
            <p className="text-sm text-ds-text2">
              Impossible de charger les drops.
            </p>
            <button
              type="button"
              className="font-bold text-ds-accent"
              onClick={() => void reload()}
            >
              Réessayer
            </button>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-[18px] border border-ds-line bg-ds-surface px-6 py-14 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ds-accentsoft text-ds-accent">
              <Lightning size={32} weight="fill" aria-hidden />
            </span>
            <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
              Aucun drop pour l&apos;instant
            </h2>
            <p className="m-0 max-w-md text-[15px] leading-relaxed text-ds-text2">
              Un drop fait venir les clients du coin pendant une heure ou deux.
              Le premier se crée en une minute.
            </p>
            {manage ? (
              <div className="flex flex-wrap justify-center gap-2.5 pt-1">
                <Link
                  href={withCafe("/dashboard-pro/drops/nouveau")}
                  className="inline-flex h-11 items-center rounded-xl bg-ds-accent px-[18px] text-[15px] font-bold text-ds-onaccent no-underline"
                >
                  Créer mon premier drop
                </Link>
                <button
                  type="button"
                  className="inline-flex h-11 items-center rounded-xl bg-transparent px-[18px] text-[15px] font-bold text-ds-text"
                  onClick={() => setExamplesOpen(true)}
                >
                  Voir des exemples
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            {showLive ? (
              <section className="flex flex-col gap-2">
                <SectionTitle>En cours</SectionTitle>
                <DropsCardStack>
                  {live.map((drop, i) => (
                    <DropRowWrap key={drop.id} bordered={i > 0}>
                      <DropCard
                        status="live"
                        title={drop.title}
                        subtitle={flashDropTypeSubtitle(drop)}
                        endsAt={drop.ends_at}
                        endTimeLabel={flashDropEndLabel(drop)}
                        stockLabel={flashDropStockLabel(drop)}
                        progress={flashDropProgress(drop)}
                        onStop={
                          manage ? () => setStopTarget(drop) : undefined
                        }
                        onDuplicate={
                          manage
                            ? () => router.push(duplicateHref(drop.id))
                            : undefined
                        }
                        className="border-0 bg-transparent p-0 shadow-none"
                      />
                    </DropRowWrap>
                  ))}
                </DropsCardStack>
              </section>
            ) : null}

            {showScheduled ? (
              <section className="flex flex-col gap-2">
                <SectionTitle>Programmés</SectionTitle>
                <DropsCardStack>
                  {scheduled.map((drop, i) => (
                    <DropRowWrap key={drop.id} bordered={i > 0}>
                      <DropCard
                        status="scheduled"
                        title={drop.title}
                        subtitle={flashDropTypeSubtitle(drop)}
                        scheduleDateLabel={formatParisDateShort(
                          drop.starts_at
                        )}
                        scheduleTimeLabel={formatDropTimeRange(drop)}
                        relativeLabel={formatStartsInDaysLabel(drop.starts_at)}
                        onEdit={
                          manage
                            ? () => router.push(editHref(drop.id))
                            : undefined
                        }
                        onDuplicate={
                          manage
                            ? () => router.push(duplicateHref(drop.id))
                            : undefined
                        }
                        className="border-0 bg-transparent p-0 shadow-none"
                      />
                    </DropRowWrap>
                  ))}
                </DropsCardStack>
              </section>
            ) : null}

            {showFinished ? (
              <section className="flex flex-col gap-2">
                <SectionTitle>Terminés</SectionTitle>
                <DropsCardStack>
                  {finished.map((drop, i) => (
                    <DropRowWrap key={drop.id} bordered={i > 0}>
                      <DropCard
                        status="done"
                        title={drop.title}
                        subtitle={flashDropTypeSubtitle(drop)}
                        doneTagLabel={finishedDropTagLabel(drop)}
                        doneLabel={formatDropWhenRange(drop)}
                        stockLabel={flashDropFinishedStats(drop)}
                        onDuplicate={
                          manage
                            ? () => router.push(duplicateHref(drop.id))
                            : undefined
                        }
                        className="border-0 bg-transparent p-0 shadow-none"
                      />
                    </DropRowWrap>
                  ))}
                </DropsCardStack>
                {statut === "termines" && finishedPages > 1 ? (
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <ProButtonSm
                      variant="outline"
                      disabled={finishedPage <= 1}
                      onClick={() => setFinishedPage(finishedPage - 1)}
                    >
                      Précédent
                    </ProButtonSm>
                    <span className="text-sm text-ds-text2">
                      Page {finishedPage} / {finishedPages}
                    </span>
                    <ProButtonSm
                      variant="outline"
                      disabled={finishedPage >= finishedPages}
                      onClick={() => setFinishedPage(finishedPage + 1)}
                    >
                      Suivant
                    </ProButtonSm>
                  </div>
                ) : null}
              </section>
            ) : null}

            {!showLive && !showScheduled && !showFinished && !isEmpty ? (
              <p className="py-10 text-center text-sm text-ds-text2">
                Aucun drop dans cette catégorie.
              </p>
            ) : null}
          </>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(stopTarget)}
        title={
          stopTarget
            ? `Arrêter « ${stopTarget.title} » ?`
            : "Arrêter ce drop ?"
        }
        description={
          stopError ??
          `Il disparaît de l'app tout de suite. Les ${stopValidatedCount} code${stopValidatedCount === 1 ? "" : "s"} déjà validé${stopValidatedCount === 1 ? "" : "s"} restent acquis ; les clients en route verront « Drop terminé ».`
        }
        confirmLabel="Arrêter maintenant"
        cancelLabel="Le garder"
        danger
        dangerFilled
        onCancel={() => {
          if (stopLoading) return;
          setStopTarget(null);
          setStopError(null);
        }}
        onConfirm={() => void handleStopConfirm()}
      />

      {examplesOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 lg:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setExamplesOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Exemples de drops"
            className="relative z-[71] flex w-full max-w-lg flex-col gap-3 rounded-t-[22px] bg-ds-surface p-6 shadow-ds lg:rounded-[22px]"
          >
            <h2 className="font-display m-0 text-xl font-extrabold text-ds-text">
              Exemples
            </h2>
            <p className="m-0 text-sm text-ds-text2">
              Choisis un modèle pour préremplir le formulaire.
            </p>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {DROP_FORM_EXAMPLES.map((ex) => (
                <li key={ex.id}>
                  <Link
                    href={withCafe(
                      `/dashboard-pro/drops/nouveau?exemple=${ex.id}`
                    )}
                    className="flex flex-col gap-0.5 rounded-xl border border-ds-line px-4 py-3 no-underline"
                    onClick={() => setExamplesOpen(false)}
                  >
                    <span className="font-bold text-ds-text">{ex.title}</span>
                    <span className="text-[13px] text-ds-text2">
                      {ex.conditions ?? ex.kind}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default function DashboardProDropsClient() {
  const { activePlace, loading, withCafe } = useActivePlace();

  if (loading) {
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
    <PlaceMemberRoleLoader placeId={activePlace.id}>
      {(role, roleLoading) =>
        roleLoading ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
          </div>
        ) : (
          <DashboardProDropsLoaded
            key={activePlace.id}
            placeId={activePlace.id}
            placeName={activePlace.name}
            role={role}
            withCafe={withCafe}
          />
        )
      }
    </PlaceMemberRoleLoader>
  );
}
