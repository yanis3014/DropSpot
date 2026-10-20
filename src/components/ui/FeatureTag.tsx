import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FeatureTagProps {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export default function FeatureTag({
  icon,
  children,
  className,
}: FeatureTagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] items-center gap-1 whitespace-nowrap rounded-lg bg-ds-surface2 px-2 text-[13px] font-semibold text-ds-text",
        className
      )}
    >
      {icon}
      {children}
    </span>
  );
}
