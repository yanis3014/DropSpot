"use client";

import type { ReactNode } from "react";
import { Check, Clock, Flag } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import StatusTag from "@/components/pro/StatusTag";
import ProButtonSm from "@/components/pro/ProButtonSm";

export type SpecRowStatus = "confirmed" | "pending" | "contested";

export interface SpecRowProps {
  icon: ReactNode;
  title: string;
  hint: string;
  /** Filled confirmation pips (e.g. 1 of 3). */
  filled: number;
  /** Total pips — default 3. */
  total?: number;
  /** Caption under pips ("12 confirmations", "1 sur 3"…). */
  votesLabel: string;
  status: SpecRowStatus;
  actionLabel?: string;
  onAction?: () => void;
  /** Disabled CTA (e.g. « Bientôt disponible »). */
  actionDisabled?: boolean;
  actionTitle?: string;
  className?: string;
}

const STATUS_UI: Record<
  SpecRowStatus,
  { variant: "ok" | "warn" | "danger"; label: string; icon: ReactNode }
> = {
  confirmed: {
    variant: "ok",
    label: "Confirmée",
    icon: <Check size={16} weight="bold" aria-hidden />,
  },
  pending: {
    variant: "warn",
    label: "En attente",
    icon: <Clock size={16} weight="bold" aria-hidden />,
  },
  contested: {
    variant: "danger",
    label: "Contestée",
    icon: <Flag size={16} weight="bold" aria-hidden />,
  },
};

/** Specificity row: confirmed / pending / contested + 1-sur-3 pips. */
export default function SpecRow({
  icon,
  title,
  hint,
  filled,
  total = 3,
  votesLabel,
  status,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionTitle,
  className,
}: SpecRowProps) {
  const ui = STATUS_UI[status];
  const pipCount = Math.max(1, total);
  const onCount = Math.max(0, Math.min(pipCount, filled));

  const defaultAction =
    status === "confirmed"
      ? "Contester"
      : status === "pending"
        ? "Retirer"
        : "Annuler";

  const label = actionLabel ?? defaultAction;
  const actionVariant =
    status === "confirmed" ? "outline" : ("ghost" as const);
  const showAction = Boolean(onAction) || actionDisabled;

  return (
    <div
      className={cn(
        "grid grid-cols-1 items-center gap-3 px-[18px] py-3 sm:grid-cols-[44px_minmax(0,1fr)] lg:grid-cols-[44px_minmax(0,1fr)_170px_170px_130px] lg:gap-3.5",
        "min-h-[68px] box-border",
        className
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ds-accentsoft text-ds-accenttext [&_svg]:h-5 [&_svg]:w-5">
        {icon}
      </span>

      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="font-bold text-ds-text">{title}</span>
        <span className="text-[13px] text-ds-text2">{hint}</span>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-start-2 lg:col-start-auto">
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: pipCount }, (_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-[22px] rounded-[3px]",
                i < onCount ? "bg-ds-ok" : "bg-ds-surface2"
              )}
            />
          ))}
        </div>
        <span className="text-sm font-semibold text-ds-text">{votesLabel}</span>
      </div>

      <div className="sm:col-start-2 lg:col-start-auto">
        <StatusTag variant={ui.variant} icon={ui.icon}>
          {ui.label}
        </StatusTag>
      </div>

      <div className="flex justify-start sm:col-start-2 sm:justify-end lg:col-start-auto">
        {showAction ? (
          <ProButtonSm
            variant={actionVariant}
            disabled={actionDisabled}
            title={actionTitle}
            onClick={actionDisabled ? undefined : onAction}
          >
            {label}
          </ProButtonSm>
        ) : null}
      </div>
    </div>
  );
}
