import { cn } from "@/lib/cn";
import { normalizePlanId, PLAN_LABELS, type PlanId } from "@/lib/pro/planFeatures";

/** "free" / "pro" restent acceptés (Présence / Premium). */
export type PlanBadgePlan = PlanId | "free" | "pro";

export interface PlanBadgeProps {
  plan: PlanBadgePlan;
  className?: string;
}

/** Offer chip (Présence / Analytics / Premium) from design/pro/composants. */
export default function PlanBadge({ plan, className }: PlanBadgeProps) {
  const id = normalizePlanId(plan);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-xl px-2.5 text-[12px] font-extrabold uppercase tracking-[0.04em]",
        id === "premium"
          ? "bg-ds-text text-ds-bg"
          : id === "analytics"
            ? "bg-ds-accent text-ds-onaccent"
            : "border-[1.5px] border-ds-line text-ds-text2",
        className
      )}
    >
      {PLAN_LABELS[id]}
    </span>
  );
}
