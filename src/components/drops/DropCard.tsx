"use client";

import Link from "next/link";
import {
  CheckCircle,
  Clock,
  Coffee,
  MusicNotes,
  PaintBrush,
  PersonSimpleRun,
  QrCode,
  Sparkle,
  Tag,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { reservedPlaces } from "@/lib/grains";
import {
  EVENT_CATEGORY_LABELS,
  formatStartLabel,
  getDropTiming,
  type Drop,
  type EventCategory,
} from "@/lib/api/drops";

export const EVENT_CATEGORY_ICONS: Record<EventCategory, Icon> = {
  sport: PersonSimpleRun,
  music: MusicNotes,
  workshop: PaintBrush,
  meetup: UsersThree,
  tasting: Coffee,
  other: Sparkle,
};

const URGENT_MS = 15 * 60 * 1000;

/** Display-only remaining time (does not drive claims or logic). */
export function formatRemainingLabel(endTime: string, now: number): string {
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

function hourLabel(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}

/** « 18 h 30 – 20 h ». */
export function formatHourRange(drop: Drop): string {
  return `${hourLabel(drop.start_time)} – ${hourLabel(drop.end_time)}`;
}

/** « 12 inscrits · 3 places restantes », « Complet », « Sois le premier ». */
export function participantsLabel(drop: Drop, participants: number): string {
  const going =
    participants === 0
      ? "Sois le premier à t’inscrire"
      : `${participants} inscrit${participants > 1 ? "s" : ""}`;
  if (typeof drop.capacity !== "number") return going;
  const left = Math.max(0, drop.capacity - participants);
  if (left === 0) return "Complet";
  return `${going} · ${left} place${left > 1 ? "s" : ""} restante${left > 1 ? "s" : ""}`;
}

/**
 * « Dont 2 places réservées aux Explorateurs » while reserved places are held
 * (until the day before an event, 30 min after an offer starts).
 */
export function reservedHint(drop: Drop, now: number): string | null {
  const reserved = reservedPlaces(drop.capacity);
  if (reserved === 0) return null;
  const start = new Date(drop.start_time).getTime();
  const releaseAt =
    drop.family === "event" ? start - 24 * 3_600_000 : start + 30 * 60_000;
  if (now >= releaseAt) return null;
  return `Dont ${reserved} place${reserved > 1 ? "s" : ""} réservée${reserved > 1 ? "s" : ""} aux Explorateurs`;
}

function offerStockLabel(drop: Drop): string | null {
  if (typeof drop.capacity !== "number") return null;
  const left = Math.max(0, drop.capacity - (drop.current_participants ?? 0));
  return `${left} restant${left === 1 ? "" : "s"}`;
}

function DateBox({ drop, live }: { drop: Drop; live: boolean }) {
  const start = new Date(drop.start_time);
  return (
    <div
      className={cn(
        "flex h-[58px] w-[54px] shrink-0 flex-col items-center justify-center rounded-2xl",
        live ? "bg-ds-accent text-ds-onaccent" : "bg-ds-accentsoft text-ds-accenttext"
      )}
    >
      {live ? (
        <span className="text-[13px] font-extrabold uppercase tracking-wide">
          Live
        </span>
      ) : (
        <>
          <span className="font-display text-[22px] font-extrabold leading-none tabular-nums">
            {start.getDate()}
          </span>
          <span className="mt-0.5 text-[12px] font-bold uppercase">
            {start
              .toLocaleDateString("fr-FR", { month: "short" })
              .replace(".", "")}
          </span>
        </>
      )}
    </div>
  );
}

export interface DropCardProps {
  drop: Drop;
  now: number;
  distanceLabel?: string | null;
  /** Events: number of participants and the user's own participation. */
  participants?: number;
  joined?: boolean;
  joinBusy?: boolean;
  joinError?: string | null;
  onToggleJoin?: (drop: Drop) => void;
  /** Offers: claim a code. */
  claimBusy?: boolean;
  onObtainCode?: (drop: Drop) => void;
  primary?: boolean;
}

export default function DropCard({
  drop,
  now,
  distanceLabel,
  participants = 0,
  joined = false,
  joinBusy = false,
  joinError,
  onToggleJoin,
  claimBusy = false,
  onObtainCode,
  primary = false,
}: DropCardProps) {
  const timing = getDropTiming(drop, now);
  const live = timing === "live";
  const cafe = drop.places?.name ?? "Café";
  const href = `/drop/${drop.id}`;

  if (drop.family === "event") {
    const category = drop.event_category ?? "other";
    const CategoryIcon = EVENT_CATEGORY_ICONS[category];
    const full =
      typeof drop.capacity === "number" && participants >= drop.capacity;
    const meta = [
      cafe,
      live ? `jusqu’à ${hourLabel(drop.end_time)}` : formatHourRange(drop),
      distanceLabel,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <article className="flex flex-col gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-4">
        <Link href={href} className="flex gap-3.5 no-underline">
          <DateBox drop={drop} live={live} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ds-accenttext">
              <CategoryIcon size={15} weight="bold" aria-hidden />
              {EVENT_CATEGORY_LABELS[category]}
              {!live ? (
                <span className="font-semibold text-ds-text2">
                  · {formatStartLabel(drop.start_time, now).split(" · ")[0]}
                </span>
              ) : null}
            </span>
            <h3 className="font-display m-0 text-xl font-bold leading-tight text-ds-text">
              {drop.title}
            </h3>
            <p className="m-0 truncate text-[15px] text-ds-text2">{meta}</p>
          </div>
        </Link>

        <p className="m-0 flex items-center gap-1.5 text-sm font-semibold text-ds-text2">
          <UsersThree size={16} weight="bold" aria-hidden />
          {participantsLabel(drop, participants)}
        </p>
        {reservedHint(drop, now) && !joined ? (
          <p className="-mt-2 m-0 text-[13px] font-medium text-ds-text2">
            {reservedHint(drop, now)}
          </p>
        ) : null}

        {onToggleJoin ? (
          <Button
            variant={joined ? "tonal" : primary ? "main" : "tonal"}
            className="h-12 w-full"
            disabled={joinBusy || (full && !joined)}
            onClick={() => onToggleJoin(drop)}
          >
            {joined ? (
              <>
                <CheckCircle size={18} weight="fill" aria-hidden />
                Inscrit · se désinscrire
              </>
            ) : full ? (
              "Complet"
            ) : (
              "Je participe"
            )}
          </Button>
        ) : null}
        {joinError ? (
          <p role="alert" className="m-0 text-center text-sm font-semibold text-ds-danger">
            {joinError}
          </p>
        ) : null}
      </article>
    );
  }

  const remaining = new Date(drop.end_time).getTime() - now;
  const urgent = live && remaining > 0 && remaining < URGENT_MS;
  const stock = offerStockLabel(drop);
  const meta = [cafe, stock, distanceLabel].filter(Boolean).join(" · ");

  return (
    <article className="flex flex-col gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-[30px] items-center gap-1.5 rounded-[15px] px-2.5 text-sm font-bold tabular-nums",
            urgent
              ? "bg-ds-accent text-ds-onaccent"
              : "bg-ds-accentsoft text-ds-accenttext"
          )}
        >
          <Clock size={16} weight="regular" aria-hidden />
          {live
            ? formatRemainingLabel(drop.end_time, now)
            : formatStartLabel(drop.start_time, now)}
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-ds-text2">
          <Tag size={14} weight="bold" aria-hidden />
          Offre
        </span>
      </div>

      <Link href={href} className="flex flex-col gap-0.5 no-underline">
        <h3 className="font-display m-0 text-xl font-bold text-ds-text">
          {drop.title}
        </h3>
        <p className="m-0 truncate text-[15px] text-ds-text2">{meta}</p>
      </Link>

      {onObtainCode ? (
        <Button
          variant={primary && live ? "main" : "tonal"}
          className="h-12 w-full"
          disabled={claimBusy || !live}
          onClick={() => onObtainCode(drop)}
        >
          <QrCode size={18} weight="regular" aria-hidden />
          {live
            ? "Obtenir mon code"
            : `Disponible ${formatStartLabel(drop.start_time, now).toLowerCase()}`}
        </Button>
      ) : null}
    </article>
  );
}
