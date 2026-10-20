"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "main" | "tonal" | "outline" | "off";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Optional gain badge (e.g. "+10 Grains") shown after the label. */
  gain?: ReactNode;
  children: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  main: "bg-ds-accent text-ds-onaccent border-transparent",
  tonal: "bg-ds-accentsoft text-ds-accenttext border-transparent",
  outline: "bg-transparent text-ds-text border-[1.5px] border-ds-line",
  off: "bg-ds-surface2 text-ds-text2 border-transparent",
};

export default function Button({
  variant = "main",
  gain,
  children,
  className,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex h-[52px] items-center justify-center gap-2 whitespace-nowrap rounded-[14px] px-5 text-base font-bold transition-opacity",
        "disabled:pointer-events-none",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
      {gain != null && gain !== false ? (
        <span
          className={cn(
            "inline-flex h-6 items-center gap-0.5 rounded-xl px-2 text-[13px] font-bold",
            "bg-white/22 dark:bg-[rgba(27,15,8,0.16)]"
          )}
        >
          {gain}
        </span>
      ) : null}
    </button>
  );
}
