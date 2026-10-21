"use client";

import { CaretUpDown, Check } from "@phosphor-icons/react";
import StatusTag from "@/components/pro/StatusTag";
import { cn } from "@/lib/cn";

export interface PlaceSwitcherPlace {
  id: string;
  name: string;
  initials: string;
  /** Subtitle under the name (city · index). */
  hint?: string;
  /** Accent avatar vs ok (alternating in lists). */
  tone?: "accent" | "ok";
  /** Optional status on a list option (e.g. En vérification). */
  statusLabel?: string;
}

export interface PlaceSwitcherTriggerProps {
  place: PlaceSwitcherPlace;
  /** e.g. "Biot · 1 café sur 2" */
  meta?: string;
  variant?: "desktop" | "mobile";
  expanded?: boolean;
  onClick?: () => void;
  className?: string;
}

function PlaceAvatar({
  initials,
  tone = "accent",
  size = "md",
}: {
  initials: string;
  tone?: "accent" | "ok";
  size?: "sm" | "md";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-display font-extrabold",
        size === "sm" && "h-8 w-8 rounded-full text-[13px]",
        size === "md" && "h-10 w-10 rounded-[10px] text-[15px]",
        tone === "accent" && "bg-ds-accent text-ds-onaccent",
        tone === "ok" && "bg-ds-ok text-ds-bg"
      )}
    >
      {initials}
    </span>
  );
}

/** Framed cafe selector (desktop) or pill (mobile) — presentational only. */
export function PlaceSwitcherTrigger({
  place,
  meta,
  variant = "desktop",
  expanded,
  onClick,
  className,
}: PlaceSwitcherTriggerProps) {
  if (variant === "mobile") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        aria-label={`Établissement actif : ${place.name}. Changer`}
        className={cn(
          "inline-flex h-11 max-w-full items-center gap-2 rounded-full border-[1.5px] border-ds-accent bg-ds-accentsoft py-0 pl-1.5 pr-3 text-[15px] font-bold text-ds-text",
          className
        )}
      >
        <PlaceAvatar initials={place.initials} tone={place.tone} size="sm" />
        <span className="min-w-0 truncate">{place.name}</span>
        <CaretUpDown size={16} weight="bold" className="shrink-0" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup="listbox"
      aria-label={`Établissement actif : ${place.name}. Changer d'établissement`}
      className={cn(
        "flex w-[232px] max-w-full items-center gap-2.5 rounded-[14px] border-[1.5px] border-ds-accent bg-ds-accentsoft py-2.5 pl-2.5 pr-3 text-left text-ds-text",
        className
      )}
    >
      <PlaceAvatar initials={place.initials} tone={place.tone} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{place.name}</span>
        {meta ? (
          <span className="truncate text-[13px] text-ds-text2">{meta}</span>
        ) : null}
      </span>
      <CaretUpDown size={20} weight="bold" className="shrink-0" aria-hidden />
    </button>
  );
}

export interface PlaceSwitcherOptionProps {
  place: PlaceSwitcherPlace;
  selected?: boolean;
  onSelect?: (id: string) => void;
  className?: string;
}

export function PlaceSwitcherOption({
  place,
  selected = false,
  onSelect,
  className,
}: PlaceSwitcherOptionProps) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={() => onSelect?.(place.id)}
      className={cn(
        "flex w-full items-center gap-3 px-3.5 text-left text-ds-text",
        "min-h-[60px]",
        selected ? "bg-ds-accentsoft" : "bg-transparent hover:bg-ds-surface2/60",
        className
      )}
    >
      <PlaceAvatar initials={place.initials} tone={place.tone ?? "accent"} />
      <span className="min-w-0 flex-1 font-bold">{place.name}</span>
      {place.statusLabel ? (
        <StatusTag variant="warn">{place.statusLabel}</StatusTag>
      ) : null}
      {selected ? (
        <Check size={20} weight="bold" className="shrink-0 text-ds-accent" aria-hidden />
      ) : null}
    </button>
  );
}

export interface PlaceSwitcherListProps {
  places: PlaceSwitcherPlace[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

/** Dropdown list of establishments (no data fetching). */
export function PlaceSwitcherList({
  places,
  selectedId,
  onSelect,
  className,
}: PlaceSwitcherListProps) {
  return (
    <div
      role="listbox"
      aria-label="Mes établissements"
      className={cn(
        "w-[340px] max-w-full overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface shadow-ds",
        className
      )}
    >
      {places.map((place) => (
        <PlaceSwitcherOption
          key={place.id}
          place={place}
          selected={place.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export interface PlaceSwitcherProps {
  active: PlaceSwitcherPlace;
  meta?: string;
  places: PlaceSwitcherPlace[];
  selectedId?: string | null;
  variant?: "desktop" | "mobile";
  expanded?: boolean;
  onToggle?: () => void;
  onSelect?: (id: string) => void;
  className?: string;
}

/**
 * Cafe switcher chrome from composants.html — trigger + optional open list.
 * Presentational only (no fetch).
 */
export default function PlaceSwitcher({
  active,
  meta,
  places,
  selectedId,
  variant = "desktop",
  expanded = false,
  onToggle,
  onSelect,
  className,
}: PlaceSwitcherProps) {
  return (
    <div className={cn("relative flex flex-col gap-3", className)}>
      <PlaceSwitcherTrigger
        place={active}
        meta={meta}
        variant={variant}
        expanded={expanded}
        onClick={onToggle}
      />
      {expanded ? (
        <PlaceSwitcherList
          places={places}
          selectedId={selectedId ?? active.id}
          onSelect={onSelect}
        />
      ) : null}
    </div>
  );
}
