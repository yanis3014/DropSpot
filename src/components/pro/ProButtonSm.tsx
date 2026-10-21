"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ProButtonSmVariant =
  | "main"
  | "tonal"
  | "outline"
  | "ghost"
  | "danger"
  | "off";

const VARIANT: Record<ProButtonSmVariant, string> = {
  main: "bg-ds-accent text-ds-onaccent border-transparent",
  tonal: "bg-ds-accentsoft text-ds-accenttext border-transparent",
  outline: "bg-ds-surface text-ds-text border-[1.5px] border-ds-line",
  ghost: "bg-transparent text-ds-text border-transparent",
  danger: "bg-ds-dangersoft text-ds-danger border-transparent",
  off: "bg-ds-surface2 text-ds-text2 border-transparent",
};

export interface ProButtonSmProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ProButtonSmVariant;
  children: ReactNode;
}

/** Dense 36px action used on DropCard / SpecRow (maquette btn-sm). */
export default function ProButtonSm({
  variant = "outline",
  className,
  children,
  type = "button",
  disabled,
  ...props
}: ProButtonSmProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[10px] border px-3 text-sm font-bold transition-opacity",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANT[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
