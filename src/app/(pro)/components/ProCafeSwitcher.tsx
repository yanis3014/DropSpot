"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  CaretUpDown,
  Check,
  MagnifyingGlass,
  Plus,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { Place } from "@/lib/api/places";

function placeHint(place: Place): string {
  const city = place.city?.trim();
  const address = place.address?.trim();
  if (city && address) return `${city}`;
  return city || address || "Établissement";
}

function PlaceAvatar({
  initials,
  tone = "accent",
  size = "md",
}: {
  initials: string;
  tone?: "accent" | "ok" | "muted";
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center font-display font-extrabold",
        size === "sm" && "h-8 w-8 rounded-full text-[13px]",
        size === "md" && "h-10 w-10 rounded-[10px] text-[15px]",
        size === "lg" && "h-12 w-12 rounded-[14px] text-[17px]",
        tone === "accent" && "bg-ds-accent text-ds-onaccent",
        tone === "ok" && "bg-ds-ok text-ds-bg",
        tone === "muted" && "bg-ds-surface2 text-ds-text2"
      )}
    >
      {initials}
    </span>
  );
}

export function CafeSelectTrigger({
  activePlace,
  activeIndex,
  total,
  initials,
  onClick,
  expanded,
  className,
  compact = false,
}: {
  activePlace: Place | null;
  activeIndex: number;
  total: number;
  initials: string;
  onClick: () => void;
  expanded?: boolean;
  className?: string;
  compact?: boolean;
}) {
  const label = activePlace?.name ?? "Choisir un café";
  const location = activePlace ? placeHint(activePlace) : null;
  const meta =
    total > 0
      ? `${location ? `${location} · ` : ""}${activeIndex} café sur ${total}`
      : "Aucun café";

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        aria-haspopup="dialog"
        aria-label={`Établissement actif : ${label}. Changer`}
        className={cn(
          "inline-flex h-11 max-w-full items-center gap-2 rounded-full border-[1.5px] border-ds-accent bg-ds-accentsoft py-0 pl-1.5 pr-3 text-[15px] font-bold text-ds-text",
          className
        )}
      >
        <PlaceAvatar initials={initials || "?"} size="sm" />
        <span className="min-w-0 truncate">{label}</span>
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
      aria-label={`Établissement actif : ${label}. Changer d'établissement`}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-[14px] border-[1.5px] border-ds-accent bg-ds-accentsoft py-2.5 pl-2.5 pr-3 text-left text-ds-text",
        className
      )}
    >
      <PlaceAvatar initials={initials || "?"} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-bold">{label}</span>
        <span className="truncate text-[13px] text-ds-text2">{meta}</span>
      </span>
      <CaretUpDown size={20} weight="bold" className="shrink-0" aria-hidden />
    </button>
  );
}

export function ProCafeSwitcher({
  open,
  onClose,
  places,
  activePlaceId,
  onSelect,
  initialsFor,
  variant,
}: {
  open: boolean;
  onClose: () => void;
  places: Place[];
  activePlaceId: string | null;
  onSelect: (id: string) => void;
  initialsFor: (name: string) => string;
  variant: "desktop" | "mobile";
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || variant !== "desktop") return;
    const onPointer = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open, onClose, variant]);

  if (!open) return null;

  const filtered = places.filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  const list = (
    <>
      {filtered.map((place, i) => {
        const selected = place.id === activePlaceId;
        return (
          <button
            key={place.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => {
              onSelect(place.id);
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-3 px-3.5 text-left text-ds-text",
              variant === "mobile"
                ? "min-h-[72px] rounded-2xl border border-transparent"
                : "min-h-16",
              selected
                ? "bg-ds-accentsoft"
                : variant === "mobile"
                  ? "border-ds-line"
                  : "bg-transparent hover:bg-ds-surface2/60"
            )}
          >
            <PlaceAvatar
              initials={initialsFor(place.name)}
              tone={i % 2 === 0 ? "accent" : "ok"}
              size={variant === "mobile" ? "lg" : "md"}
            />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={cn(
                  "font-bold",
                  variant === "mobile" ? "text-[17px]" : "text-base"
                )}
              >
                {place.name}
              </span>
              <span className="text-[13px] text-ds-text2 sm:text-sm">
                {placeHint(place)}
              </span>
            </span>
            {selected && (
              <Check
                size={variant === "mobile" ? 24 : 20}
                weight="bold"
                className="shrink-0 text-ds-accent"
                aria-hidden
              />
            )}
          </button>
        );
      })}
      <Link
        href="/dashboard-pro/onboarding"
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 px-3.5 font-bold text-ds-accent no-underline",
          variant === "mobile" ? "min-h-[52px] text-base" : "min-h-12 rounded-xl"
        )}
      >
        <Plus size={20} weight="bold" aria-hidden />
        Ajouter un établissement
      </Link>
    </>
  );

  if (variant === "mobile") {
    return (
      <div className="fixed inset-0 z-[60] lg:hidden">
        <button
          type="button"
          className="absolute inset-0 bg-black/45"
          aria-label="Fermer"
          onClick={onClose}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 rounded-t-[28px] bg-ds-surface px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-2.5 shadow-lg"
        >
          <div
            className="mx-auto h-1.5 w-10 rounded-full bg-ds-line"
            aria-hidden
          />
          <div className="flex items-center justify-between px-1 py-1.5">
            <h2
              id={titleId}
              className="font-display text-[22px] font-extrabold text-ds-text"
            >
              Choisis ton café
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-1 text-base font-bold text-ds-accent"
            >
              Fermer
            </button>
          </div>
          <div role="listbox" aria-label="Mes établissements" className="flex flex-col gap-2">
            {list}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      role="listbox"
      aria-label="Mes établissements"
      className="absolute left-4 top-[8.75rem] z-40 flex w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface shadow-[0_10px_32px_rgba(58,34,18,0.18)] dark:shadow-[0_10px_32px_rgba(0,0,0,0.55)]"
    >
      <div className="flex flex-col gap-2.5 px-3.5 pb-2.5 pt-3.5">
        <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ds-text2">
          Mes établissements
        </span>
        <label className="flex h-[42px] items-center gap-2 rounded-xl border border-ds-line bg-ds-bg px-3 text-ds-text2">
          <MagnifyingGlass size={16} weight="bold" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Chercher un café…"
            aria-label="Chercher un établissement"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ds-text outline-none placeholder:text-ds-text2"
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} aria-label="Effacer">
              <X size={14} weight="bold" />
            </button>
          ) : null}
        </label>
      </div>
      <div className="flex flex-col">{list}</div>
    </div>
  );
}
