"use client";

import { CoffeeBean } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface GrainsBadgeProps {
  /** Current grain balance (display value). */
  balance: number | string;
  className?: string;
}

export default function GrainsBadge({ balance, className }: GrainsBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-[18px] bg-ds-accentsoft py-0 pl-2.5 pr-3 text-[15px] font-bold text-ds-accenttext",
        className
      )}
    >
      <CoffeeBean size={18} weight="regular" aria-hidden />
      <span className="tabular-nums">{balance}</span>
    </span>
  );
}
