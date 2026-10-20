"use client";

import type { ReactNode } from "react";
import Button, { type ButtonProps } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

export interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  /** Optional leading icon inside the primary button (refresh, bell…). */
  actionIcon?: ReactNode;
  actionProps?: Omit<ButtonProps, "children" | "onClick" | "variant">;
  /** Text-style secondary action under the primary button. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  className?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  actionProps,
  secondaryLabel,
  onSecondary,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2.5 px-8 text-center",
        className
      )}
    >
      <div
        className="mb-1.5 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-ds-surface2 text-ds-text2 [&_svg]:h-[30px] [&_svg]:w-[30px]"
        aria-hidden
      >
        {icon}
      </div>
      <h2 className="font-display m-0 text-[22px] font-bold text-ds-text">
        {title}
      </h2>
      <p className="m-0 mb-2 max-w-sm text-base leading-snug text-ds-text2">
        {description}
      </p>
      <Button
        variant="main"
        onClick={onAction}
        className="w-full max-w-sm"
        {...actionProps}
      >
        {actionIcon}
        {actionLabel}
      </Button>
      {secondaryLabel ? (
        <button
          type="button"
          onClick={onSecondary}
          className="inline-flex h-11 items-center justify-center px-4 text-base font-bold text-ds-accent"
        >
          {secondaryLabel}
        </button>
      ) : null}
    </div>
  );
}
