"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Coffee, Star } from "@phosphor-icons/react";
import FeatureTag from "@/components/ui/FeatureTag";
import { cn } from "@/lib/cn";

export type CafeOpenStatus = "open" | "closing_soon" | "closed";

export interface CafeRowFeature {
  icon?: ReactNode;
  label: string;
}

export interface CafeRowProps {
  name: string;
  rating: number | string;
  status: CafeOpenStatus;
  distance: string;
  /** Extra line detail, e.g. "ferme à 19 h". */
  statusDetail?: string;
  features?: CafeRowFeature[];
  imageSrc?: string | null;
  href?: string;
  onClick?: () => void;
  className?: string;
}

const STATUS_LABEL: Record<CafeOpenStatus, string> = {
  open: "Ouvert",
  closing_soon: "Ferme bientôt",
  closed: "Fermé",
};

const STATUS_CLASS: Record<CafeOpenStatus, string> = {
  open: "text-ds-ok font-bold",
  closing_soon: "text-ds-accenttext font-bold",
  closed: "text-ds-text2 font-bold",
};

function formatRating(rating: number | string) {
  if (typeof rating === "number") {
    return rating.toLocaleString("fr-FR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
  }
  return rating;
}

export default function CafeRow({
  name,
  rating,
  status,
  distance,
  statusDetail,
  features = [],
  imageSrc,
  href,
  onClick,
  className,
}: CafeRowProps) {
  const metaParts = [
    <span key="status" className={STATUS_CLASS[status]}>
      {STATUS_LABEL[status]}
    </span>,
    distance,
    statusDetail,
  ].filter(Boolean);

  const content = (
    <>
      <div
        className={cn(
          "relative flex h-[84px] w-[84px] flex-none items-center justify-center overflow-hidden rounded-[14px] bg-ds-map text-ds-text2"
        )}
        aria-hidden={imageSrc ? undefined : true}
      >
        {imageSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary place CDN URLs
          <img
            src={imageSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Coffee size={26} weight="regular" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display truncate text-[17px] font-bold text-ds-text">
            {name}
          </span>
          <span className="inline-flex flex-none items-center gap-0.5 text-sm font-bold text-ds-text">
            <Star
              size={15}
              weight="regular"
              className="text-ds-accent"
              aria-hidden
            />
            {formatRating(rating)}
          </span>
        </div>

        <div className="text-sm text-ds-text2">
          {metaParts.map((part, i) => (
            <span key={i}>
              {i > 0 ? " · " : null}
              {part}
            </span>
          ))}
        </div>

        {features.length > 0 ? (
          <div className="flex gap-1.5 overflow-hidden">
            {features.slice(0, 3).map((feat) => (
              <FeatureTag key={feat.label} icon={feat.icon}>
                {feat.label}
              </FeatureTag>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );

  const rowClass = cn(
    "flex w-full max-w-[360px] gap-3 rounded-[20px] border border-ds-line bg-ds-surface p-3 text-ds-text no-underline box-border",
    (href || onClick) && "cursor-pointer active:scale-[0.99] transition-transform",
    className
  );

  if (href) {
    return (
      <Link href={href} className={rowClass} onClick={onClick}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cn(rowClass, "text-left")} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}
