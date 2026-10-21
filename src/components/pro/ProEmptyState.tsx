"use client";

import type { ReactNode } from "react";
import EmptyState from "@/components/ui/EmptyState";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface ProEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Outline / secondary CTA (maquette « Voir des exemples », « Revendiquer »…). */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Softer icon well (default) or danger well (accès refusé). */
  tone?: "default" | "danger";
  className?: string;
}

/**
 * Pro empty / blocked state. Reuses `EmptyState` when a single primary CTA is enough;
 * dual CTAs match design/pro/etats-vides-erreurs.
 */
export default function ProEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  tone = "default",
  className,
}: ProEmptyStateProps) {
  const iconWell = cn(
    tone === "danger"
      ? "bg-ds-dangersoft text-ds-danger"
      : "bg-ds-surface2 text-ds-text2"
  );

  if (actionLabel && secondaryLabel) {
    return (
      <div
        className={cn(
          "mx-auto flex max-w-md flex-col items-center gap-3 px-8 text-center",
          className
        )}
      >
        <div
          className={cn(
            "mb-1 flex h-20 w-20 items-center justify-center rounded-full [&_svg]:h-8 [&_svg]:w-8",
            iconWell
          )}
          aria-hidden
        >
          {icon}
        </div>
        <h2 className="font-display m-0 text-[26px] font-extrabold text-ds-text">
          {title}
        </h2>
        <p className="m-0 mb-1.5 text-base leading-relaxed text-ds-text2">
          {description}
        </p>
        <div className="flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button variant="main" onClick={onAction} className="flex-1">
            {actionLabel}
          </Button>
          <Button variant="outline" onClick={onSecondary} className="flex-1">
            {secondaryLabel}
          </Button>
        </div>
      </div>
    );
  }

  if (actionLabel) {
    return (
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
        secondaryLabel={secondaryLabel}
        onSecondary={onSecondary}
        className={cn(
          "mx-auto max-w-md [&>div:first-child]:h-20 [&>div:first-child]:w-20",
          tone === "danger" &&
            "[&>div:first-child]:bg-ds-dangersoft [&>div:first-child]:text-ds-danger",
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-3 px-8 text-center",
        className
      )}
    >
      <div
        className={cn(
          "mb-1 flex h-20 w-20 items-center justify-center rounded-full [&_svg]:h-8 [&_svg]:w-8",
          iconWell
        )}
        aria-hidden
      >
        {icon}
      </div>
      <h2 className="font-display m-0 text-[26px] font-extrabold text-ds-text">
        {title}
      </h2>
      <p className="m-0 text-base leading-relaxed text-ds-text2">{description}</p>
    </div>
  );
}
