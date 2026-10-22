"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowClockwise,
  ArrowRight,
  Bell,
  Clock,
  Lightning,
  QrCode,
  WifiSlash,
} from "@phosphor-icons/react";
import DropDetailModal from "@/components/drops/DropDetailModal";
import DropCodePanel from "@/components/drops/DropCodePanel";
import LoginModal from "@/components/auth/LoginModal";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import GrainsBadge from "@/components/ui/GrainsBadge";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/useProfile";
import {
  getExploreDrops,
  Drop,
  formatCountdown,
  getDropTiming,
} from "@/lib/api/drops";
import {
  claimDrop,
  listMyActiveDropCodes,
  readLastShownDropCode,
  type MyDropCode,
} from "@/lib/api/dropCodes";
import { claimDropErrorMessage } from "@/lib/dropCodes/errors";
import { formatDropCodeDisplay } from "@/lib/dropCodes/format";
import { setDropAlertsEnabled } from "@/lib/dropAlerts";
import { dropMatchesFilter, normalizeKey } from "@/lib/filters";
import { openDirections } from "@/lib/utils/directions";
import { cn } from "@/lib/cn";
import { formatParisTimeHHMM } from "@/app/(pro)/dashboard-pro/lib/proHome/parisTime";
import type { DropCodeStatus } from "@/lib/dropCodes/screen";

type ChipId = "all" | "promo" | "matcha" | "event";
type MainTab = "drops" | "codes";

const DROP_CHIPS: { id: ChipId; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "promo", label: "Boissons" },
  { id: "matcha", label: "Matcha" },
  { id: "event", label: "Activités" },
];

const URGENT_MS = 15 * 60 * 1000;

type ActiveCodeView = {
  dropCodeId: string;
  code: string;
  title: string;
  cafeName: string;
  endsAt: string;
  status: DropCodeStatus;
};

/** Display-only remaining time (does not drive claims or logic). */
function formatRemainingLabel(endTime: string, now: number): string {
  const end = new Date(endTime).getTime();
  const diff = end - now;
  if (!Number.isFinite(end) || diff <= 0) return "Terminé";

  const totalSec = Math.floor(diff / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours >= 1) {
    return `Encore ${hours} h ${String(minutes).padStart(2, "0")}`;
  }
  if (diff >= URGENT_MS) {
    return `Encore ${minutes} min`;
  }
  return `Encore ${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function msRemaining(endTime: string, now: number): number {
  const end = new Date(endTime).getTime();
  if (!Number.isFinite(end)) return Number.POSITIVE_INFINITY;
  return end - now;
}

function dropMentionsMatcha(drop: Drop): boolean {
  const hay = normalizeKey(
    [drop.title, drop.description, drop.places?.name, drop.places?.category]
      .filter(Boolean)
      .join(" ")
  );
  return hay.includes("matcha") || hay.includes("chai");
}

function matchesChip(drop: Drop, chip: ChipId): boolean {
  if (chip === "all") return true;
  if (chip === "promo") return dropMatchesFilter(drop, "promo");
  if (chip === "matcha") return dropMentionsMatcha(drop);
  return (
    dropMatchesFilter(drop, "event") || dropMatchesFilter(drop, "sport")
  );
}

function stockLabel(drop: Drop): string | null {
  if (typeof drop.capacity !== "number" || !Number.isFinite(drop.capacity)) {
    return null;
  }
  const used =
    typeof drop.current_participants === "number"
      ? drop.current_participants
      : 0;
  const left = Math.max(0, Math.floor(drop.capacity) - Math.floor(used));
  if (drop.drop_type === "event" || drop.drop_type === "sport") {
    return `${left} place${left === 1 ? "" : "s"}`;
  }
  return `${left} restant${left === 1 ? "" : "s"}`;
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

function isFlashDrop(drop: Drop): boolean {
  return drop.source === "flash_drops";
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
  const [chip, setChip] = useState<ChipId>("all");
  const [mainTab, setMainTab] = useState<MainTab>("drops");
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [legacyClaimed, setLegacyClaimed] = useState<string[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [alertsJustEnabled, setAlertsJustEnabled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
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

  const filtered = useMemo(() => {
    return drops
      .filter((d) => matchesChip(d, chip))
      .filter((d) => getDropTiming(d, now) !== "ended")
      .sort((a, b) => {
        const timingRank = (d: Drop) => {
          const t = getDropTiming(d, now);
          return t === "live" ? 0 : t === "upcoming" ? 1 : 2;
        };
        const r = timingRank(a) - timingRank(b);
        if (r !== 0) return r;
        return msRemaining(a.end_time, now) - msRemaining(b.end_time, now);
      });
  }, [drops, chip, now]);

  const mostUrgentId = filtered[0]?.id ?? null;

  const redirectToLogin = useCallback(() => {
    const redirect = pathname || "/drops";
    router.push(`/login?redirect=${encodeURIComponent(redirect)}`);
  }, [pathname, router]);

  const openCodePanel = useCallback((view: ActiveCodeView) => {
    setActiveCode(view);
    setSelectedDrop(null);
    setClaimError(null);
  }, []);

  const handleObtainCode = async (drop: Drop) => {
    if (!isFlashDrop(drop)) return;

    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }

    setClaimBusy(true);
    setClaimError(null);
    try {
      const result = await claimDrop(drop.id);
      if (!result.ok) {
        setClaimError(claimDropErrorMessage(result.error, drop));
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
      setClaimError("Impossible d’obtenir un code. Réessaie.");
    } finally {
      setClaimBusy(false);
    }
  };

  const handleLegacyClaim = (drop: Drop) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    setLegacyClaimed((prev) =>
      prev.includes(drop.id) ? prev : [...prev, drop.id]
    );
  };

  const handleModalClaim = () => {
    if (!selectedDrop) return;
    if (isFlashDrop(selectedDrop)) {
      void handleObtainCode(selectedDrop);
      return;
    }
    handleLegacyClaim(selectedDrop);
  };

  const goToDrop = (drop: Drop) => {
    openDirections({
      name: drop.places?.name ?? drop.title,
      address: drop.places?.address,
      city: drop.places?.city,
      lat: Number.NaN,
      lng: Number.NaN,
    });
  };

  const handleRetry = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const handleEnableAlerts = () => {
    setDropAlertsEnabled(true);
    setAlertsJustEnabled(true);
  };

  return (
    <div className="flex flex-1 flex-col bg-ds-bg pb-28 text-ds-text">
      <div className="flex items-center justify-between px-5 pb-1 pt-8">
        <h1 className="font-display text-[34px] font-extrabold leading-tight text-ds-text">
          Drops flash
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
        Offres éphémères à moins de 1 km
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
        {mainTab === "drops" && online
          ? DROP_CHIPS.map((c) => (
              <Chip
                key={c.id}
                active={chip === c.id}
                onClick={() => setChip(c.id)}
              >
                {c.label}
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
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Lightning weight="regular" />}
            title={"Aucun drop pour l'instant"}
            description={"On te prévient dès qu'une offre tombe près de toi."}
            actionLabel={
              alertsJustEnabled ? "Alertes activées" : "Activer les alertes"
            }
            actionIcon={<Bell size={20} weight="regular" />}
            onAction={handleEnableAlerts}
            actionProps={alertsJustEnabled ? { disabled: true } : undefined}
            className="px-4 pt-[12rem]"
          />
        ) : (
          filtered.map((drop) => {
            const remaining = msRemaining(drop.end_time, now);
            const urgent = remaining > 0 && remaining < URGENT_MS;
            const isPrimary = drop.id === mostUrgentId;
            const cafe = drop.places?.name ?? "Café";
            const stock = stockLabel(drop);
            const flash = isFlashDrop(drop);

            return (
              <article
                key={drop.id}
                className="flex flex-col gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  {online ? (
                    <span
                      className={cn(
                        "inline-flex h-[30px] items-center gap-1.5 rounded-[15px] px-2.5 text-sm font-bold tabular-nums",
                        urgent
                          ? "bg-ds-accent text-ds-onaccent"
                          : "bg-ds-accentsoft text-ds-accenttext"
                      )}
                    >
                      <Clock size={16} weight="regular" aria-hidden />
                      {formatRemainingLabel(drop.end_time, now)}
                    </span>
                  ) : (
                    <span />
                  )}
                </div>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setClaimError(null);
                      setSelectedDrop(drop);
                    }}
                    className="text-left"
                  >
                    <h3 className="font-display m-0 text-xl font-bold text-ds-text">
                      {drop.title}
                    </h3>
                  </button>
                  <p className="m-0 text-[15px] text-ds-text2">
                    {cafe}
                    {online && stock ? ` · ${stock}` : null}
                  </p>
                </div>

                {flash ? (
                  <Button
                    variant={isPrimary ? "main" : "tonal"}
                    className="h-12 w-full"
                    disabled={claimBusy}
                    onClick={() => void handleObtainCode(drop)}
                  >
                    <QrCode size={18} weight="regular" aria-hidden />
                    Obtenir mon code
                  </Button>
                ) : (
                  <Button
                    variant={isPrimary ? "main" : "tonal"}
                    className="h-12 w-full"
                    onClick={() => goToDrop(drop)}
                  >
                    Je m&apos;y rends
                    <ArrowRight size={18} weight="regular" aria-hidden />
                  </Button>
                )}
              </article>
            );
          })
        )}
      </div>

      {selectedDrop && (
        <DropDetailModal
          drop={selectedDrop}
          countdown={formatCountdown(selectedDrop.end_time, now)}
          isAuthenticated={isAuthenticated}
          isClaimed={legacyClaimed.includes(selectedDrop.id)}
          claimBusy={claimBusy}
          claimError={claimError}
          onClaim={handleModalClaim}
          onClose={() => {
            setSelectedDrop(null);
            setClaimError(null);
          }}
        />
      )}

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

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
