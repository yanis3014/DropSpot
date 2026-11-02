"use client";

import type { ReactNode } from "react";
import { Lock } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import PlanBadge from "@/components/pro/PlanBadge";
import { cn } from "@/lib/cn";
import { PLAN_LABELS, type PlanId } from "@/lib/pro/planFeatures";

export type ProLockVariant = "button" | "row";

export interface ProLockProps {
  /** Feature name shown next to the lock. */
  label: string;
  variant?: ProLockVariant;
  /** CTA for the row variant (default « Débloquer »). Row hides the button without onUnlock. */
  actionLabel?: string;
  onUnlock?: () => void;
  className?: string;
  /** Optional leading icon (row variant). */
  icon?: ReactNode;
  /** Offer that unlocks the feature (badge). Default Premium. */
  plan?: PlanId;
}

/**
 * Marks a feature not included in the current offer — outline button with Pro badge, or unlock row.
 */
export default function ProLock({
  label,
  variant = "button",
  actionLabel = "Débloquer",
  onUnlock,
  className,
  icon,
  plan = "premium",
}: ProLockProps) {
  if (variant === "row") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-3.5",
          className
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ds-surface2 text-ds-text2">
          {icon ?? <Lock size={16} weight="bold" aria-hidden />}
        </span>
        <span className="min-w-0 flex-1 font-bold text-ds-text">{label}</span>
        <PlanBadge plan={plan} />
        {onUnlock ? (
          <Button
            variant="tonal"
            onClick={onUnlock}
            className="h-9 shrink-0 rounded-[10px] px-3 text-sm"
          >
            {actionLabel}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onUnlock}
      aria-label={`${label}, inclus dans l’offre ${PLAN_LABELS[plan]}`}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-ds-line bg-ds-surface px-[18px] text-[15px] font-bold text-ds-text",
        className
      )}
    >
      <Lock size={16} weight="bold" aria-hidden />
      {label}
      <PlanBadge plan={plan} />
    </button>
  );
}
