"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarBlank,
  Check,
  Coffee,
  Leaf,
  Moon,
  NavigationArrow,
  WifiHigh,
  X,
} from "@phosphor-icons/react";
import FavoriteButton from "@/components/places/FavoriteButton";
import TrophyModal from "@/components/places/TrophyModal";
import Button from "@/components/ui/Button";
import { getPlaceById, type Place } from "@/lib/api/places";
import { type CheckIn } from "@/lib/api/checkins";
import {
  addEndorsement,
  getPlaceRankings,
  getUserEndorsementsForPlace,
  isEndorsementsUnavailableError,
  type EndorsementCategory,
  type PlaceRanking,
} from "@/lib/api/endorsements";
import { cafeOpenStatus } from "@/lib/cafePresentation";
import { normalizeKey } from "@/lib/filters";
import {
  distanceMeters,
  formatDistance,
  getCurrentPosition,
  type LatLng,
} from "@/lib/geo";
import { noiseLabel, wifiLabel } from "@/lib/placeAmenities";
import { openDirections } from "@/lib/utils/directions";
import { cn } from "@/lib/cn";

interface PlaceDetailModalProps {
  place: Place;
  vibe?: CheckIn;
  isAuthenticated: boolean;
  isSaved: boolean;
  onToggleSave: (placeId: string) => void | Promise<void>;
  onCheckedIn?: () => void;
  onClose: () => void;
}

type SpecTile = {
  key: string;
  label: string;
  value: string;
  icon: ReactNode;
  /** Endorsement bucket used for confirmation counts / « Tout est juste ». */
  category: EndorsementCategory | null;
};

function confLabel(count: number): string {
  return count <= 1
    ? `${count} confirmation`
    : `${count} confirmations`;
}

function buildSpecTiles(place: Place): SpecTile[] {
  const tiles: SpecTile[] = [];

  if (place.wifi_speed) {
    const speed = wifiLabel(place.wifi_speed);
    tiles.push({
      key: "wifi",
      label: "Wi-Fi",
      value: speed || "Disponible",
      icon: <WifiHigh size={18} weight="regular" />,
      category: "wifi",
    });
  }

  const hay = normalizeKey(
    `${place.name} ${place.description ?? ""} ${place.category ?? ""}`
  );
  if (hay.includes("matcha") || hay.includes("chai")) {
    tiles.push({
      key: "matcha",
      label: "Matcha",
      value: "Proposé",
      icon: <Leaf size={18} weight="regular" />,
      category: "food",
    });
  }

  if (place.noise_level) {
    const ambiance = noiseLabel(place.noise_level);
    if (ambiance) {
      tiles.push({
        key: "ambiance",
        label: "Ambiance",
        value: ambiance,
        icon: <Moon size={18} weight="regular" />,
        category: "comfort",
      });
    }
  }

  if (
    place.categories?.includes("event") ||
    place.categories?.includes("sport")
  ) {
    const value = place.categories.includes("sport")
      ? "Sport & runs"
      : "Événements";
    tiles.push({
      key: "activites",
      label: "Activités",
      value,
      icon: <CalendarBlank size={18} weight="regular" />,
      category: null,
    });
  } else if (place.categories?.includes("specialty") && place.category) {
    tiles.push({
      key: "coffee",
      label: "Café",
      value: place.category,
      icon: <Coffee size={18} weight="regular" />,
      category: "coffee",
    });
  }

  return tiles.slice(0, 4);
}

export default function PlaceDetailModal({
  place: initialPlace,
  isAuthenticated,
  isSaved,
  onToggleSave,
  onClose,
}: PlaceDetailModalProps) {
  const [visible, setVisible] = useState(false);
  const [place, setPlace] = useState<Place>(initialPlace);
  const [rankings, setRankings] = useState<PlaceRanking[]>([]);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getPlaceById(initialPlace.id)
      .then((fresh) => {
        if (!cancelled && fresh) setPlace(fresh);
      })
      .catch((error) => console.error("Error refreshing place:", error));
    return () => {
      cancelled = true;
    };
  }, [initialPlace.id]);

  useEffect(() => {
    let cancelled = false;
    getPlaceRankings(initialPlace.id)
      .then((rows) => {
        if (!cancelled) setRankings(rows);
      })
      .catch((err) => console.error("Error fetching rankings:", err));
    return () => {
      cancelled = true;
    };
  }, [initialPlace.id]);

  useEffect(() => {
    let cancelled = false;
    void getCurrentPosition().then((result) => {
      if (!cancelled && result.ok) setUserCoords(result.coords);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const tiles = useMemo(() => buildSpecTiles(place), [place]);

  const rankingByCategory = useMemo(() => {
    const map = new Map<EndorsementCategory, number>();
    for (const row of rankings) map.set(row.category, row.count);
    return map;
  }, [rankings]);

  const openMeta = cafeOpenStatus(place);

  const statusParts: ReactNode[] = [
    <span
      key="status"
      className={cn(
        "font-bold",
        openMeta.status === "open" ? "text-ds-ok" : "text-ds-text2"
      )}
    >
      {openMeta.status === "open"
        ? "Ouvert"
        : openMeta.status === "closing_soon"
          ? "Ferme bientôt"
          : "Fermé"}
    </span>,
  ];
  if (openMeta.statusDetail) {
    statusParts.push(openMeta.statusDetail);
  }
  if (userCoords) {
    statusParts.push(
      formatDistance(
        distanceMeters(userCoords, { lat: place.lat, lng: place.lng })
      )
    );
  }

  const refreshRankings = async () => {
    const rows = await getPlaceRankings(place.id);
    setRankings(rows);
  };

  const handleConfirmAll = async () => {
    if (confirmBusy) return;
    if (!isAuthenticated) {
      setToast("Connecte-toi pour confirmer ces infos.");
      window.setTimeout(() => setToast(null), 2800);
      return;
    }

    const categories = [
      ...new Set(
        tiles
          .map((t) => t.category)
          .filter((c): c is EndorsementCategory => c != null)
      ),
    ];
    if (categories.length === 0) {
      setToast("Rien à confirmer pour l’instant.");
      window.setTimeout(() => setToast(null), 2800);
      return;
    }

    setConfirmBusy(true);
    try {
      const already = await getUserEndorsementsForPlace(place.id);
      const pending = categories.filter((c) => !already.includes(c));
      for (const category of pending) {
        await addEndorsement(place.id, category);
      }
      await refreshRankings();
      setToast(
        pending.length === 0
          ? "Tu as déjà confirmé ces infos."
          : "Merci, c’est noté !"
      );
      window.setTimeout(() => setToast(null), 2800);
    } catch (err) {
      if (isEndorsementsUnavailableError(err)) {
        setToast("Les confirmations ne sont pas encore disponibles.");
      } else {
        setToast("Oups, la confirmation n’est pas partie. Réessaie.");
      }
      window.setTimeout(() => setToast(null), 2800);
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleCorrect = () => {
    if (!isAuthenticated) {
      setToast("Connecte-toi pour proposer une correction.");
      window.setTimeout(() => setToast(null), 2800);
      return;
    }
    setShowCorrect(true);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0"
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={place.name}
        className={cn(
          "relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-[26px] bg-ds-bg text-ds-text shadow-2xl transition-transform duration-300 ease-out",
          visible ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Hero */}
        <div className="relative h-[250px] flex-none bg-ds-map text-ds-text2">
          {place.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- place CDN URLs
            <img
              src={place.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <Coffee size={44} weight="regular" />
            </div>
          )}

          <div className="absolute inset-x-4 top-4 flex items-start justify-between">
            <button
              type="button"
              onClick={handleClose}
              aria-label="Retour"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-ds-surface text-ds-text shadow-ds"
            >
              <X size={22} weight="regular" />
            </button>
            <FavoriteButton
              placeId={place.id}
              isSaved={isSaved}
              onToggle={onToggleSave}
              size={20}
              className="h-11 w-11 rounded-full bg-ds-surface text-ds-text shadow-ds"
            />
          </div>
        </div>

        {/* Sheet body */}
        <div className="relative -mt-6 flex min-h-0 flex-1 flex-col rounded-t-[26px] bg-ds-bg">
          <div className="flex-1 space-y-3.5 overflow-y-auto px-4 pb-4 pt-5">
            <div className="flex flex-col gap-1 px-1">
              <h2 className="font-display m-0 text-[28px] font-extrabold leading-tight text-ds-text">
                {place.name}
              </h2>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] text-ds-text2">
                  {statusParts.map((part, i) => (
                    <span key={i}>
                      {i > 0 ? " · " : null}
                      {part}
                    </span>
                  ))}
                </span>
                <button
                  type="button"
                  onClick={() => openDirections(place)}
                  className="inline-flex h-11 flex-none items-center gap-1 text-[15px] font-bold text-ds-accent"
                >
                  <NavigationArrow size={18} weight="regular" aria-hidden />
                  Itinéraire
                </button>
              </div>
            </div>

            {/* Rating / avis: only if present in place data (not in schema today → hidden) */}

            {tiles.length > 0 ? (
              <div className="grid grid-cols-2 gap-2.5">
                {tiles.map((tile) => {
                  const conf =
                    tile.category != null
                      ? (rankingByCategory.get(tile.category) ?? 0)
                      : null;
                  return (
                    <div
                      key={tile.key}
                      className="flex flex-col gap-1.5 rounded-[18px] border border-ds-line bg-ds-surface p-3.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-ds-accentsoft text-ds-accenttext">
                          {tile.icon}
                        </span>
                        <span className="text-sm font-semibold text-ds-text2">
                          {tile.label}
                        </span>
                      </div>
                      <span className="text-base font-bold text-ds-text">
                        {tile.value}
                      </span>
                      {conf != null ? (
                        <span className="inline-flex items-center gap-1 text-[13px] text-ds-text2">
                          <Check
                            size={14}
                            weight="regular"
                            className="text-ds-ok"
                            aria-hidden
                          />
                          {confLabel(conf)}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex flex-none flex-col gap-2.5 border-t border-ds-line bg-ds-surface px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-3">
            <p className="m-0 text-center text-sm text-ds-text2">
              Ces infos sont-elles toujours justes ?
            </p>
            <div className="flex gap-2.5">
              <Button
                variant="main"
                className="min-w-0 flex-1 px-3.5"
                disabled={confirmBusy}
                onClick={() => void handleConfirmAll()}
              >
                {confirmBusy ? "Confirmation…" : "Tout est juste"}
              </Button>
              <Button
                variant="outline"
                className="px-[18px]"
                onClick={handleCorrect}
              >
                Corriger
              </Button>
            </div>
          </div>
        </div>
      </div>

      {showCorrect && (
        <TrophyModal
          place={{ id: place.id, name: place.name }}
          onClose={() => setShowCorrect(false)}
          onVoted={() => {
            void refreshRankings();
            setToast("Merci, c’est noté !");
            window.setTimeout(() => setToast(null), 2800);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-28 left-1/2 z-[80] -translate-x-1/2 rounded-2xl bg-ds-pin px-4 py-3 text-sm font-bold text-ds-onpin shadow-ds">
          {toast}
        </div>
      )}
    </div>
  );
}
