"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, Lightning, Minus, Plus, X } from "@phosphor-icons/react";
import type { Place } from "@/lib/api/places";
import {
  getRecentPlaceFlashDrops,
  insertFlashDrop,
  type FlashDrop,
  type FlashDropKind,
} from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import { getPlaceOpenStatus } from "@/lib/api/openingHours";
import {
  DEFAULT_DROP_CONDITIONS,
  formatParisDatetimeLocal,
  parseParisDatetimeLocalToUtcIso,
  translateDropWriteError,
} from "@/app/(pro)/dashboard-pro/lib/proDrops/dropForm";
import { formatParisTimeHHMM } from "@/app/(pro)/dashboard-pro/lib/proHome/parisTime";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";

export interface QuickDropSheetProps {
  open: boolean;
  place: Place;
  role?: string | null;
  hasPro?: boolean;
  onClose: () => void;
  onPublished?: (drop: FlashDrop) => void;
}

type QuickOfferChoice = "-10" | "-20" | "-30" | "offert";
type QuickDurationChoice = "30m" | "1h" | "2h" | "close";

const OFFER_CHOICES: { id: QuickOfferChoice; label: string }[] = [
  { id: "-10", label: "−10 %" },
  { id: "-20", label: "−20 %" },
  { id: "-30", label: "−30 %" },
  { id: "offert", label: "Offert" },
];

function computeCloseTodayIso(
  closesAt: string | null | undefined,
  now: Date
): string | null {
  if (!closesAt || !/^\d{2}:\d{2}$/.test(closesAt)) return null;
  const nowParisLocal = formatParisDatetimeLocal(now);
  const datePrefix = nowParisLocal.slice(0, 10);
  if (!datePrefix) return null;
  try {
    const closeIso = parseParisDatetimeLocalToUtcIso(
      `${datePrefix}T${closesAt}`
    );
    if (new Date(closeIso).getTime() > now.getTime()) {
      return closeIso;
    }
    return null;
  } catch {
    return null;
  }
}

function buildQuickDropTitle(
  offer: QuickOfferChoice,
  productText: string
): {
  title: string;
  kind: FlashDropKind;
  discountValue: number | null;
  discountUnit: "percent" | "eur" | null;
} {
  const cleanProduct = productText.trim();
  if (offer === "offert") {
    const base = cleanProduct ? `${cleanProduct} offert` : "Produit offert";
    return {
      title: base.slice(0, 60),
      kind: "offer",
      discountValue: null,
      discountUnit: null,
    };
  }
  const pct = offer === "-10" ? 10 : offer === "-20" ? 20 : 30;
  const prefix = `−${pct} %`;
  const full = cleanProduct ? `${prefix} ${cleanProduct}` : prefix;
  return {
    title: full.slice(0, 60),
    kind: "discount",
    discountValue: pct,
    discountUnit: "percent",
  };
}

export default function QuickDropSheet({
  open,
  place,
  role,
  hasPro,
  onClose,
  onPublished,
}: QuickDropSheetProps) {
  const [recentDrops, setRecentDrops] = useState<FlashDrop[]>([]);
  const [selectedRecentId, setSelectedRecentId] = useState<string | null>(null);
  const [offerChoice, setOfferChoice] = useState<QuickOfferChoice>("-30");
  const [productText, setProductText] = useState("sur le matcha latte");
  const [durationChoice, setDurationChoice] =
    useState<QuickDurationChoice>("1h");
  const [closesAtToday, setClosesAtToday] = useState<string | null>(null);
  const [unlimited, setUnlimited] = useState(false);
  const [placesCount, setPlacesCount] = useState(20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => new Date());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    void getRecentPlaceFlashDrops(place.id, 3).then((rows) => {
      if (!cancelled) setRecentDrops(rows);
    });

    void getPlaceOpenStatus(place.id).then((status) => {
      if (cancelled) return;
      const closeHHMM = status?.closes_at ?? null;
      const validClose = computeCloseTodayIso(closeHHMM, new Date());
      setClosesAtToday(validClose ? closeHHMM : null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, place.id]);

  const handleSelectRecent = (drop: FlashDrop) => {
    setSelectedRecentId(drop.id);
    if (drop.kind === "offer") {
      setOfferChoice("offert");
      setProductText(drop.title.replace(/\s*offert$/i, "").trim() || drop.title);
    } else if (drop.discount_value === 10) {
      setOfferChoice("-10");
      setProductText(
        drop.title.replace(/^[−-]\s*10\s*%\s*/i, "").trim() || drop.title
      );
    } else if (drop.discount_value === 20) {
      setOfferChoice("-20");
      setProductText(
        drop.title.replace(/^[−-]\s*20\s*%\s*/i, "").trim() || drop.title
      );
    } else {
      setOfferChoice("-30");
      setProductText(
        drop.title.replace(/^[−-]\s*\d+\s*%\s*/i, "").trim() || drop.title
      );
    }
    if (drop.max_uses == null) {
      setUnlimited(true);
    } else {
      setUnlimited(false);
      setPlacesCount(Math.max(1, drop.max_uses));
    }
  };

  const { startIso, endIso } = useMemo(() => {
    const s = new Date(now.getTime());
    if (durationChoice === "close" && closesAtToday) {
      const closeIso = computeCloseTodayIso(closesAtToday, s);
      if (closeIso) {
        return { startIso: s.toISOString(), endIso: closeIso };
      }
    }
    const mins =
      durationChoice === "30m" ? 30 : durationChoice === "2h" ? 120 : 60;
    const e = new Date(s.getTime() + mins * 60_000);
    return { startIso: s.toISOString(), endIso: e.toISOString() };
  }, [now, durationChoice, closesAtToday]);

  const summaryLine = useMemo(() => {
    const startHHMM = formatParisTimeHHMM(startIso);
    const endHHMM = formatParisTimeHHMM(endIso);
    const stockPart = unlimited ? "Sans limite" : `${placesCount} places`;
    return `Visible de ${startHHMM} à ${endHHMM} · ${stockPart}`;
  }, [startIso, endIso, unlimited, placesCount]);

  if (!open) return null;

  const handlePublish = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const selectedDrop = recentDrops.find((d) => d.id === selectedRecentId);
      const built = buildQuickDropTitle(offerChoice, productText);
      const title =
        selectedDrop && !productText.trim() ? selectedDrop.title : built.title;

      const saved = await insertFlashDrop({
        place_id: place.id,
        vendor_id: place.vendor_id ?? "",
        title: title.slice(0, 60),
        description: null,
        kind: built.kind,
        discount_value: built.discountValue,
        discount_unit: built.discountUnit,
        conditions: DEFAULT_DROP_CONDITIONS,
        starts_at: startIso,
        ends_at: endIso,
        max_uses: unlimited ? null : placesCount,
      });
      onPublished?.(saved);
      onClose();
    } catch (err) {
      setError(translateDropWriteError(err, { role, hasPro }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-ds-bg text-ds-text"
      role="dialog"
      aria-modal="true"
      aria-label="Drop rapide"
    >
      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-4 pb-36 pt-[max(1.25rem,env(safe-area-inset-top))]">
        {/* Barre supérieure */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-transparent text-ds-text"
          >
            <X size={24} weight="bold" aria-hidden />
          </button>
          <span className="text-sm font-bold text-ds-text2">{place.name}</span>
          <span className="w-11" aria-hidden />
        </div>

        <h2 className="font-display m-0 text-[30px] font-extrabold text-ds-text">
          Drop rapide
        </h2>

        {/* Reprendre un drop : chips des 3 derniers drops du café */}
        {recentDrops.length > 0 ? (
          <div className="flex flex-col gap-2 text-[15px] font-bold text-ds-text">
            <span>Reprendre un drop</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {recentDrops.map((d) => (
                <Chip
                  key={d.id}
                  active={selectedRecentId === d.id}
                  icon={<Copy size={16} weight="bold" aria-hidden />}
                  onClick={() => handleSelectRecent(d)}
                >
                  {d.title}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {/* L'offre */}
        <div className="flex flex-col gap-2 text-[15px] font-bold text-ds-text">
          <span>L&apos;offre</span>
          <div className="flex flex-wrap gap-2">
            {OFFER_CHOICES.map((c) => (
              <Chip
                key={c.id}
                active={offerChoice === c.id}
                onClick={() => {
                  setSelectedRecentId(null);
                  setOfferChoice(c.id);
                }}
              >
                {c.label}
              </Chip>
            ))}
          </div>
          <input
            type="text"
            aria-label="Sur quel produit ?"
            maxLength={48}
            value={productText}
            onChange={(e) => {
              setSelectedRecentId(null);
              setProductText(e.target.value);
            }}
            placeholder="sur le matcha latte"
            className="h-11 w-full rounded-xl border border-ds-line bg-ds-bg px-3 text-[15px] font-medium text-ds-text outline-none focus:border-ds-accent"
          />
        </div>

        {/* Pendant */}
        <div className="flex flex-col gap-2 text-[15px] font-bold text-ds-text">
          <span>Pendant</span>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={durationChoice === "30m"}
              onClick={() => setDurationChoice("30m")}
            >
              30 min
            </Chip>
            <Chip
              active={durationChoice === "1h"}
              onClick={() => setDurationChoice("1h")}
            >
              1 h
            </Chip>
            <Chip
              active={durationChoice === "2h"}
              onClick={() => setDurationChoice("2h")}
            >
              2 h
            </Chip>
            {closesAtToday ? (
              <Chip
                active={durationChoice === "close"}
                onClick={() => setDurationChoice("close")}
              >
                Jusqu&apos;à {closesAtToday}
              </Chip>
            ) : null}
          </div>
        </div>

        {/* Combien ? */}
        <div className="flex flex-col gap-2 text-[15px] font-bold text-ds-text">
          <span>Combien ?</span>
          <div className="flex items-center gap-3.5">
            <button
              type="button"
              aria-label="Moins"
              onClick={() => {
                setUnlimited(false);
                setPlacesCount((c) => Math.max(1, c - 5));
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ds-line bg-ds-surface text-ds-text"
            >
              <Minus size={20} weight="bold" aria-hidden />
            </button>
            <span className="font-display min-w-[40px] text-center text-[28px] font-extrabold tabular-nums text-ds-text">
              {unlimited ? "∞" : placesCount}
            </span>
            <button
              type="button"
              aria-label="Plus"
              onClick={() => {
                setUnlimited(false);
                setPlacesCount((c) => c + 5);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-ds-line bg-ds-surface text-ds-text"
            >
              <Plus size={20} weight="bold" aria-hidden />
            </button>
            <Chip
              active={unlimited}
              onClick={() => setUnlimited((u) => !u)}
              className="ml-auto"
            >
              Sans limite
            </Chip>
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="m-0 rounded-xl bg-ds-dangersoft px-3.5 py-2.5 text-sm font-semibold text-ds-danger"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* Pied fixe : Résumé + Publier maintenant */}
      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2.5 border-t border-ds-line bg-ds-surface px-4 pb-8 pt-3.5">
        <span className="text-center text-sm font-medium text-ds-text2">
          {summaryLine}
        </span>
        <Button
          type="button"
          variant="main"
          disabled={submitting}
          onClick={() => void handlePublish()}
          className="h-14 w-full rounded-2xl text-[17px]"
        >
          <Lightning size={20} weight="bold" aria-hidden />
          {submitting ? "Publication…" : "Publier maintenant"}
        </Button>
      </div>
    </div>
  );
}
