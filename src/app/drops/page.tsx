"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ArrowClockwise,
  ArrowRight,
  Bell,
  Clock,
  Lightning,
  WifiSlash,
} from "@phosphor-icons/react";
import DropDetailModal from "@/components/drops/DropDetailModal";
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
import { setDropAlertsEnabled } from "@/lib/dropAlerts";
import { dropMatchesFilter, normalizeKey } from "@/lib/filters";
import { openDirections } from "@/lib/utils/directions";
import { cn } from "@/lib/cn";

type ChipId = "all" | "promo" | "matcha" | "event";

const DROP_CHIPS: { id: ChipId; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "promo", label: "Boissons" },
  { id: "matcha", label: "Matcha" },
  { id: "event", label: "Activités" },
];

const URGENT_MS = 15 * 60 * 1000;

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
  // Activités → event + sport (existing types)
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

function readStoredClaims(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(
      localStorage.getItem("dropspot_claims") ?? "[]"
    );
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export default function DropsPage() {
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
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [claimedDrops, setClaimedDrops] = useState<string[]>(readStoredClaims);
  const [showLogin, setShowLogin] = useState(false);
  const [alertsJustEnabled, setAlertsJustEnabled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

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

  const handleClaim = (drop: Drop) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    setClaimedDrops((prev) => {
      const next = [...prev, drop.id];
      localStorage.setItem("dropspot_claims", JSON.stringify(next));
      return next;
    });
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

      {online ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-3.5">
          {DROP_CHIPS.map((c) => (
            <Chip
              key={c.id}
              active={chip === c.id}
              onClick={() => setChip(c.id)}
            >
              {c.label}
            </Chip>
          ))}
          <div className="w-2 shrink-0" aria-hidden />
        </div>
      ) : null}

      <div className="flex flex-col gap-3 px-4">
        {!online ? (
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
                  {/* Distance hidden: Drop.places has no lat/lng in the current payload */}
                </div>

                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => setSelectedDrop(drop)}
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

                <Button
                  variant={isPrimary ? "main" : "tonal"}
                  className="h-12 w-full"
                  onClick={() => goToDrop(drop)}
                >
                  Je m&apos;y rends
                  <ArrowRight size={18} weight="regular" aria-hidden />
                </Button>
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
          isClaimed={claimedDrops.includes(selectedDrop.id)}
          onClaim={() => handleClaim(selectedDrop)}
          onClose={() => setSelectedDrop(null)}
        />
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
