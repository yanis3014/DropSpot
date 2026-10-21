import { cn } from "@/lib/cn";

export interface StatTileProps {
  label: string;
  value: string | number;
  /** Softer value (e.g. placeholder "—"). */
  muted?: boolean;
  className?: string;
}

/** Compact metric card (drops used / live / signals). */
export default function StatTile({
  label,
  value,
  muted = false,
  className,
}: StatTileProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-[18px] border border-ds-line bg-ds-surface px-5 py-[18px]",
        className
      )}
    >
      <span className="text-sm font-semibold text-ds-text2">{label}</span>
      <span
        className={cn(
          "font-display text-[34px] font-extrabold leading-none",
          muted ? "text-ds-text2" : "text-ds-text"
        )}
      >
        {value}
      </span>
    </div>
  );
}
