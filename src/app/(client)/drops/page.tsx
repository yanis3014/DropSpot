"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowClockwise,
  Lightning,
  QrCode,
  WifiSlash,
} from "@phosphor-icons/react";
import DropCard from "@/components/drops/DropCard";
import DropCodePanel from "@/components/drops/DropCodePanel";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import GrainsBadge from "@/components/ui/GrainsBadge";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import { useDropParticipation } from "@/lib/hooks/useDropParticipation";
import { useKnownPosition } from "@/lib/hooks/useKnownPosition";
import {
  DROP_MOMENT_LABELS,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  dropMoment,
  getExploreDrops,
  getDropTiming,
  type Drop,
  type DropMoment,
  type EventCategory,
} from "@/lib/api/drops";
import {
  claimDrop,
  listMyActiveDropCodes,
  readLastShownDropCode,
  type MyDropCode,
} from "@/lib/api/dropCodes";
import { claimDropErrorMessage } from "@/lib/dropCodes/errors";
import { formatDropCodeDisplay } from "@/lib/dropCodes/format";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { formatParisTimeHHMM } from "@/app/(pro)/dashboard-pro/lib/proHome/parisTime";
import type { DropCodeStatus } from "@/lib/dropCodes/screen";

/** Feed filter: all, one event category (without « other »), or offers. */
type FilterId = "all" | Exclude<EventCategory, "other"> | "offers";
type MainTab = "drops" | "codes";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "Tous" },
  ...EVENT_CATEGORIES.filter(
    (c): c is Exclude<EventCategory, "other"> => c !== "other"
  ).map((c) => ({ id: c, label: EVENT_CATEGORY_LABELS[c] })),
  { id: "offers", label: "Offres" },
];

const MOMENTS: DropMoment[] = ["now", "today", "weekend", "later"];

type ActiveCodeView = {
  dropCodeId: string;
  code: string;
  title: string;
  cafeName: string;
  endsAt: string;
  status: DropCodeStatus;
};

function matchesFilter(drop: Drop, filter: FilterId): boolean {
  if (filter === "all") return true;
  if (filter === "offers") return drop.family === "offer";
  return drop.family === "event" && drop.event_category === filter;
}

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

export default function DropsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useProfile(
    isAuthenticated,
    authLoading
  );
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<FilterId>("all");
  const [mainTab, setMainTab] = useState<MainTab>("drops");
  const [reloadKey, setReloadKey] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<{ dropId: string; message: string } | null>(null);
  const [activeCode, setActiveCode] = useState<ActiveCodeView | null>(null);
  const [myCodes, setMyCodes] = useState<MyDropCode[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);

  const refreshMyCodes = useCallback(async () => {
    if (!isAuthenticated) {
      setMyCodes([]);
      setCodesLoading(false);
      return;
    }
    setCodesLoading(true);
    try {
      const rows = await listMyActiveDropCodes();
      setMyCodes(rows);
    } finally {
      setCodesLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let cancelled = false;
    getExploreDrops()
      .then((data) => {
        if (!cancelled) setDrops(data);
      })
      .catch((error) => {
        console.error("Error loading drops:", error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (drops.length === 0 || !online) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [drops.length, online]);

  const grainsBalance = profile?.grains_balance ?? 0;
  const showGrainsBadge =
    isAuthenticated && !authLoading && !profileLoading && profile != null;

  const position = useKnownPosition();

  const visible = useMemo(
    () =>
      drops
        .filter((d) => getDropTiming(d, now) !== "ended")
        .sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        ),
    [drops, now]
  );

  const eventIds = useMemo(
    () => visible.filter((d) => d.family === "event").map((d) => d.id),
    [visible]
  );
  const participation = useDropParticipation(eventIds, isAuthenticated);

  // Only show the filters that have something behind them.
  const filters = useMemo(
    () =>
      FILTERS.filter(
        (f) => f.id === "all" || visible.some((d) => matchesFilter(d, f.id))
      ),
    [visible]
  );
  const activeFilter = filters.some((f) => f.id === filter) ? filter : "all";

  const sections = useMemo(() => {
    const filtered = visible.filter((d) => matchesFilter(d, activeFilter));
    return MOMENTS.map((moment) => ({
      moment,
      drops: filtered.filter((d) => dropMoment(d, now) === moment),
    })).filter((section) => section.drops.length > 0);
  }, [visible, activeFilter, now]);

  const primaryId = sections[0]?.drops[0]?.id ?? null;

  const distanceLabel = useCallback(
    (drop: Drop): string | null => {
      const lat = drop.places?.lat;
      const lng = drop.places?.lng;
      if (!position || typeof lat !== "number" || typeof lng !== "number") {
        return null;
      }
      return formatDistance(distanceMeters(position, { lat, lng }));
    },
    [position]
  );

  const redirectToLogin = useCallback(() => {
    const redirect = pathname || "/drops";
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [pathname, router]);

  const openCodePanel = useCallback((view: ActiveCodeView) => {
    setActiveCode(view);
    setClaimError(null);
  }, []);

  const handleObtainCode = async (drop: Drop) => {
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    setClaimBusy(true);
    setClaimError(null);
    try {
      const result = await claimDrop(drop.id);
      if (!result.ok) {
        setClaimError({
          dropId: drop.id,
          message: claimDropErrorMessage(result.error, drop),
        });
        return;
      }
      openCodePanel({
        dropCodeId: result.dropCodeId,
        code: result.code,
        title: drop.title,
        cafeName: drop.places?.name ?? "Café",
        endsAt: drop.end_time,
        status: result.status,
      });
      void refreshMyCodes();
    } catch (err) {
      console.error(err);
      setClaimError({
        dropId: drop.id,
        message: "Impossible d’obtenir un code. Réessaie.",
      });
    } finally {
      setClaimBusy(false);
    }
  };

  const handleToggleJoin = async (drop: Drop) => {
    const allowed = await participation.toggle(drop.id);
    if (!allowed) redirectToLogin();
  };

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="flex flex-1 flex-col bg-ds-bg pb-28 text-ds-text">
      <div className="flex items-center justify-between px-5 pb-1 pt-8">
        <h1 className="font-display text-[34px] font-extrabold leading-tight text-ds-text">
          Drops
        </h1>
        {showGrainsBadge ? (
          <Link
            href="/profile"
            aria-label={`${grainsBalance} Grains, voir mon profil`}
            className="no-underline"
          >
            <GrainsBadge balance={grainsBalance} />
          </Link>
        ) : null}
      </div>
      <p className="m-0 px-5 pb-3.5 text-[15px] text-ds-text2">
        Événements et offres des cafés, en ce moment et à venir
      </p>

      {!online ? (
        <div
          role="status"
          className="mx-4 mb-3 flex items-center gap-2.5 rounded-[14px] bg-ds-surface2 px-3.5 py-3 text-sm font-semibold text-ds-text"
        >
          <WifiSlash size={18} weight="regular" aria-hidden />
          Hors ligne · les offres se mettront à jour au retour du réseau
        </div>
      ) : null}

      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3.5">
        <Chip
          active={mainTab === "drops"}
          onClick={() => setMainTab("drops")}
        >
          Drops
        </Chip>
        <Chip
          active={mainTab === "codes"}
          onClick={() => {
            setMainTab("codes");
            if (isAuthenticated) void refreshMyCodes();
            else {
              setMyCodes([]);
              setCodesLoading(false);
            }
          }}
        >
          Mes codes
          {myCodes.length > 0 ? ` (${myCodes.length})` : ""}
        </Chip>
        {mainTab === "drops" && online && filters.length > 2
          ? filters.map((f) => (
              <Chip
                key={f.id}
                active={activeFilter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </Chip>
            ))
          : null}
        <div className="w-2 shrink-0" aria-hidden />
      </div>

      <div className="flex flex-col gap-3 px-4">
        {mainTab === "codes" ? (
          !isAuthenticated && !authLoading ? (
            <EmptyState
              icon={<QrCode weight="regular" />}
              title="Connecte-toi pour voir tes codes"
              description="Tes codes de drop s’affichent ici une fois obtenus."
              actionLabel="Se connecter"
              onAction={redirectToLogin}
              className="px-4 pt-[8rem]"
            />
          ) : codesLoading ? (
            [1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-[22px] border border-ds-line bg-ds-surface"
              />
            ))
          ) : myCodes.length === 0 ? (
            (() => {
              const last = !online ? readLastShownDropCode() : null;
              if (last) {
                return (
                  <button
                    type="button"
                    onClick={() =>
                      openCodePanel({
                        dropCodeId: last.id,
                        code: last.code,
                        title: last.title,
                        cafeName: last.cafeName,
                        endsAt: last.endsAt,
                        status: last.status,
                      })
                    }
                    className="flex flex-col gap-2 rounded-[22px] border border-ds-line bg-ds-surface p-4 text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold text-ds-warn">
                      <WifiSlash size={16} aria-hidden />
                      Pas de connexion : le café vérifiera ton code au comptoir
                    </span>
                    <span className="font-display text-xl font-bold tracking-widest">
                      {formatDropCodeDisplay(last.code)}
                    </span>
                    <span className="font-semibold">{last.title}</span>
                    <span className="text-sm text-ds-text2">{last.cafeName}</span>
                  </button>
                );
              }
              return (
                <EmptyState
                  icon={<QrCode weight="regular" />}
                  title="Aucun code en cours"
                  description="Obtiens un code sur un drop flash, il apparaîtra ici."
                  actionLabel="Voir les drops"
                  onAction={() => setMainTab("drops")}
                  className="px-4 pt-[8rem]"
                />
              );
            })()
          ) : (
            myCodes.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() =>
                  openCodePanel({
                    dropCodeId: row.id,
                    code: row.code,
                    title: row.title,
                    cafeName: row.cafeName,
                    endsAt: row.endsAt,
                    status: row.status,
                  })
                }
                className="flex flex-col gap-2 rounded-[22px] border border-ds-line bg-ds-surface p-4 text-left transition-opacity active:opacity-90"
              >
                <span className="font-display text-xl font-bold tracking-widest text-ds-text">
                  {row.codeDisplay}
                </span>
                <span className="text-[15px] font-semibold text-ds-text">
                  {row.title}
                </span>
                <span className="text-sm text-ds-text2">
                  {row.cafeName}
                  {row.endsAt
                    ? ` · jusqu’à ${formatParisTimeHHMM(row.endsAt)}`
                    : null}
                </span>
              </button>
            ))
          )
        ) : !online ? (
          <EmptyState
            icon={<WifiSlash weight="regular" />}
            title="Pas de connexion"
            description="Les drops reviennent dès que le réseau est là."
            actionLabel="Réessayer"
            actionIcon={<ArrowClockwise size={20} weight="regular" />}
            onAction={handleRetry}
            className="px-4 pt-[8rem]"
          />
        ) : loading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-36 animate-pulse rounded-[22px] border border-ds-line bg-ds-surface"
            />
          ))
        ) : sections.length === 0 ? (
          <EmptyState
            icon={<Lightning weight="regular" />}
            title={"Aucun drop pour l'instant"}
            description={"Les cafés publient ici leurs événements et leurs offres. Repasse bientôt !"}
            actionLabel="Voir la carte"
            onAction={() => router.push("/map")}
            className="px-4 pt-[12rem]"
          />
        ) : (
          sections.map((section) => (
            <section key={section.moment} className="flex flex-col gap-3">
              <h2 className="font-display m-0 px-1 pt-2 text-lg font-extrabold text-ds-text">
                {DROP_MOMENT_LABELS[section.moment]}
              </h2>
              {section.drops.map((drop) => (
                <div key={drop.id} className="flex flex-col gap-1.5">
                  <DropCard
                    drop={drop}
                    now={now}
                    distanceLabel={distanceLabel(drop)}
                    primary={drop.id === primaryId}
                    participants={participation.participants(drop.id)}
                    joined={participation.isJoined(drop.id)}
                    joinBusy={participation.busyId === drop.id}
                    joinError={
                      participation.error?.dropId === drop.id
                        ? participation.error.message
                        : null
                    }
                    onToggleJoin={(d) => void handleToggleJoin(d)}
                    claimBusy={claimBusy}
                    onObtainCode={(d) => void handleObtainCode(d)}
                  />
                  {claimError?.dropId === drop.id ? (
                    <p
                      role="alert"
                      className="m-0 text-center text-sm font-semibold text-ds-danger"
                    >
                      {claimError.message}
                    </p>
                  ) : null}
                </div>
              ))}
            </section>
          ))
        )}
      </div>

      {activeCode ? (
        <DropCodePanel
          dropCodeId={activeCode.dropCodeId}
          code={activeCode.code}
          title={activeCode.title}
          cafeName={activeCode.cafeName}
          endsAt={activeCode.endsAt}
          initialStatus={activeCode.status}
          onClose={() => {
            setActiveCode(null);
            void refreshMyCodes();
          }}
        />
      ) : null}

    </div>
  );
}
