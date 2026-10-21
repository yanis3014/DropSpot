import { cn } from "@/lib/cn";

export type PlanBadgePlan = "free" | "pro";

export interface PlanBadgeProps {
  plan: PlanBadgePlan;
  className?: string;
}

/** Gratuit / Pro plan chip from design/pro/composants. */
export default function PlanBadge({ plan, className }: PlanBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 text-[12px] font-extrabold uppercase tracking-[0.04em]",
        plan === "pro"
          ? "bg-ds-text text-ds-bg"
          : "border-[1.5px] border-ds-line text-ds-text2",
        className
      )}
    >
      {plan === "pro" ? "Pro" : "Gratuit"}
    </span>
  );
}
