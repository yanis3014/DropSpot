"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface MapPinProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  /** Selected pin shows the label beside the icon. */
  selected?: boolean;
  label?: string;
}

export default function MapPin({
  icon,
  selected = false,
  label,
  className,
  type = "button",
  "aria-label": ariaLabel,
  ...props
}: MapPinProps) {
  return (
    <button
      type={type}
      aria-label={ariaLabel ?? (selected ? label : undefined)}
      aria-pressed={selected}
      className={cn(
        "flex items-center justify-center border-2 border-ds-surface box-border",
        selected
          ? "h-11 gap-1.5 rounded-[22px] bg-ds-accent px-4 pl-3 text-sm font-bold text-ds-onaccent"
          : "h-11 w-11 rounded-full bg-ds-pin p-0 text-ds-onpin",
        className
      )}
      {...props}
    >
      <span
        className={cn(
          "flex items-center justify-center",
          selected ? "[&_svg]:h-[18px] [&_svg]:w-[18px]" : "[&_svg]:h-5 [&_svg]:w-5"
        )}
      >
        {icon}
      </span>
      {selected && label ? <span>{label}</span> : null}
    </button>
  );
}
