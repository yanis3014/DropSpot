"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Selected (on) vs idle (off). */
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

export default function Chip({
  active = false,
  icon,
  children,
  className,
  type = "button",
  ...props
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 flex-none items-center gap-1.5 whitespace-nowrap rounded-[18px] border px-3.5 text-sm font-semibold box-border",
        active
          ? "border-transparent bg-ds-accentsoft text-ds-accenttext"
          : "border-ds-line bg-ds-surface text-ds-text",
        className
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
