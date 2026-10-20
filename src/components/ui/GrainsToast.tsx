"use client";

import { CoffeeBean } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface GrainsToastProps {
  /** Grains gained, e.g. 10 → "+10 Grains · merci !" */
  amount?: number;
  /** Override the full toast message. */
  message?: string;
  className?: string;
}

export default function GrainsToast({
  amount = 10,
  message,
  className,
}: GrainsToastProps) {
  const text = message ?? `+${amount} Grains · merci !`;

  return (
    <div
      role="status"
      className={cn(
        "flex items-center gap-2.5 rounded-2xl bg-ds-surface py-2.5 pr-4 pl-2.5 text-ds-text shadow-ds",
        className
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ds-accentsoft text-ds-accenttext">
        <CoffeeBean size={18} weight="regular" aria-hidden />
      </span>
      <span className="text-[15px] font-bold">{text}</span>
    </div>
  );
}
