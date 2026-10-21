"use client";

import { useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import StatusTag from "@/components/pro/StatusTag";
import ProButtonSm from "@/components/pro/ProButtonSm";

export type DropCardStatus = "live" | "scheduled" | "done";

export interface DropCardProps {
  status: DropCardStatus;
  title: string;
  /** Type line under title (kind · conditions). */
  subtitle?: string;
  /** ISO end time — drives the live countdown when `remainingLabel` is omitted. */
  endsAt?: string;
  /** Explicit remaining label (e.g. "Encore 42:15"). Wins over `endsAt`. */
  remainingLabel?: string;
  /** Scheduled date headline (e.g. "Jeudi 22 oct."). */
  scheduleDateLabel?: string;
  /** Scheduled hours (e.g. "18:00 → 19:30"). */
  scheduleTimeLabel?: string;
  /** Legacy single-line schedule label. */
  scheduleLabel?: string;
  /** « Commence dans N jours » */
  relativeLabel?: string;
  /** Done date line (e.g. "ven. 16 oct."). */
  doneLabel?: string;
  /** Tag for finished drops — Terminé ou Arrêté. */
  doneTagLabel?: string;
  /** Progress 0–1 for the stock bar. */
  progress?: number;
  /** Hint under the bar (stock / schedule copy). */
  stockLabel?: string;
  /** Right-aligned end time (e.g. « fin à 19:00 »). */
  endTimeLabel?: string;
  onStop?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  className?: string;
}

function formatRemaining(endsAt: string, now: number): string {
  const end = new Date(endsAt).getTime();
  if (!Number.isFinite(end)) return "—";
  const ms = Math.max(0, end - now);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `Encore ${h} h ${String(m).padStart(2, "0")}`;
  }
  return `Encore ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Drop card: live (countdown + bar), scheduled, or done — with Arrêter / Dupliquer / Modifier. */
export default function DropCard({
  status,
  title,
  subtitle,
  endsAt,
  remainingLabel,
  scheduleDateLabel,
  scheduleTimeLabel,
  scheduleLabel,
  relativeLabel,
  doneLabel,
  doneTagLabel,
  progress,
  stockLabel,
  endTimeLabel,
  onStop,
  onDuplicate,
  onEdit,
  className,
}: DropCardProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status !== "live" || remainingLabel || !endsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [status, remainingLabel, endsAt]);

  const liveLabel =
    remainingLabel ??
    (endsAt ? formatRemaining(endsAt, now) : undefined);

  const pct =
    progress == null
      ? undefined
      : Math.max(0, Math.min(100, Math.round(progress * 100)));

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {status === "live" && <StatusTag variant="live">En cours</StatusTag>}
        {status === "scheduled" && (
          <StatusTag variant="scheduled">Programmé</StatusTag>
        )}
        {status === "done" && (
          <StatusTag variant="done">{doneTagLabel ?? "Terminé"}</StatusTag>
        )}

        {status === "live" && liveLabel ? (
          <span className="inline-flex items-center gap-1.5 font-extrabold tabular-nums text-ds-text">
            <Clock size={16} weight="bold" aria-hidden />
            {liveLabel}
          </span>
        ) : null}

        {status === "scheduled" && scheduleLabel && !scheduleDateLabel ? (
          <span className="text-[13px] font-semibold text-ds-text2">
            {scheduleLabel}
          </span>
        ) : null}

        {status === "done" && doneLabel ? (
          <span className="text-[13px] font-semibold text-ds-text2">
            {doneLabel}
          </span>
        ) : null}

        {status === "live" && endTimeLabel ? (
          <span className="ml-auto text-[13px] text-ds-text2">
            {endTimeLabel}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <h3
          className={cn(
            "font-display m-0 text-lg font-bold",
            status === "done" ? "text-ds-text2" : "text-ds-text"
          )}
        >
          {title}
        </h3>
        {subtitle ? (
          <p className="m-0 mt-0.5 text-[13px] text-ds-text2">{subtitle}</p>
        ) : null}
      </div>

      {status === "scheduled" &&
      (scheduleDateLabel || scheduleTimeLabel || relativeLabel) ? (
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px] text-ds-text2">
          <div className="flex flex-col gap-0.5">
            {scheduleDateLabel ? (
              <span className="text-[15px] font-bold text-ds-text">
                {scheduleDateLabel}
              </span>
            ) : null}
            {scheduleTimeLabel ? <span>{scheduleTimeLabel}</span> : null}
          </div>
          {relativeLabel ? (
            <span className="font-medium">{relativeLabel}</span>
          ) : null}
        </div>
      ) : null}

      {status === "live" || (status === "done" && stockLabel) ? (
        <div className="flex flex-col gap-1.5">
          {status === "live" ? (
            <div className="h-1.5 overflow-hidden rounded bg-ds-surface2">
              {pct != null && pct > 0 ? (
                <div
                  className="h-full rounded bg-ds-accent"
                  style={{ width: `${pct}%` }}
                />
              ) : null}
            </div>
          ) : null}
          {stockLabel ? (
            <span className="text-[13px] text-ds-text2">{stockLabel}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {status === "live" && onStop ? (
          <ProButtonSm variant="danger" onClick={onStop}>
            Arrêter
          </ProButtonSm>
        ) : null}
        {status === "scheduled" && onEdit ? (
          <ProButtonSm variant="outline" onClick={onEdit}>
            Modifier
          </ProButtonSm>
        ) : null}
        {status === "done" && onDuplicate ? (
          <ProButtonSm variant="outline" onClick={onDuplicate}>
            Dupliquer
          </ProButtonSm>
        ) : null}
        {status !== "done" && onDuplicate ? (
          <ProButtonSm variant="ghost" onClick={onDuplicate}>
            Dupliquer
          </ProButtonSm>
        ) : null}
      </div>
    </article>
  );
}
