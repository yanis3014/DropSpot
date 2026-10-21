import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatusTagVariant =
  | "live"
  | "scheduled"
  | "done"
  | "ok"
  | "warn"
  | "danger";

const VARIANT: Record<StatusTagVariant, string> = {
  live: "bg-ds-accent text-ds-onaccent",
  scheduled: "bg-ds-accentsoft text-ds-accenttext",
  done: "bg-ds-surface2 text-ds-text2",
  ok: "bg-ds-oksoft text-ds-ok",
  warn: "bg-ds-warnsoft text-ds-warn",
  danger: "bg-ds-dangersoft text-ds-danger",
};

export interface StatusTagProps {
  variant: StatusTagVariant;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/** Compact status pill (En cours, Programmé, Confirmée…). */
export default function StatusTag({
  variant,
  children,
  icon,
  className,
}: StatusTagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-[13px] px-2.5 text-[13px] font-bold",
        VARIANT[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
