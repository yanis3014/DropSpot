"use client";

import Link from "next/link";
import {
  DotsThreeOutline,
  House,
  Lightning,
  QrCode,
  Storefront,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import {
  isMoreNavPath,
  mobileTabHrefsForRole,
} from "@/lib/pro/navAccess";
import type { PlaceMemberRole } from "@/app/(pro)/dashboard-pro/lib/api/vendor";

const TABS: Record<
  string,
  { label: string; icon: typeof House; exact?: boolean }
> = {
  "/dashboard-pro": { label: "Aujourd'hui", icon: House, exact: true },
  "/dashboard-pro/drops": { label: "Drops", icon: Lightning },
  "/valider": { label: "Valider", icon: QrCode },
  "/etablissement": { label: "Fiche", icon: Storefront },
};

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

const tabClass =
  "flex min-w-0 flex-col items-center gap-1 pt-2 text-[11px] leading-none no-underline";

/**
 * Mobile bottom bar. « Valider » is the raised button in the middle; the
 * other tabs share the same icon slot so every label sits on one line.
 */
export default function ProBottomNav({
  role,
  pathname,
  withCafe,
  moreOpen,
  onMore,
}: {
  role: PlaceMemberRole | null;
  pathname: string;
  withCafe: (href: string) => string;
  moreOpen: boolean;
  onMore: () => void;
}) {
  const hrefs = mobileTabHrefsForRole(role);
  const moreActive = moreOpen || isMoreNavPath(pathname, role);

  return (
    <nav
      aria-label="Navigation comptoir"
      className="fixed inset-x-0 bottom-0 z-50 grid border-t border-ds-line bg-ds-surface/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      style={{ gridTemplateColumns: `repeat(${hrefs.length + 1}, minmax(0, 1fr))` }}
    >
      {hrefs.map((href) => {
        const tab = TABS[href];
        if (!tab) return null;
        const { label, icon: Icon, exact } = tab;

        if (href === "/valider") {
          return (
            <Link
              key={href}
              href={withCafe(href)}
              className={cn(tabClass, "font-bold text-ds-text")}
            >
              <span className="relative h-7 w-full" aria-hidden>
                <span className="absolute bottom-0 left-1/2 flex h-[60px] w-[60px] -translate-x-1/2 items-center justify-center rounded-full border-[5px] border-ds-surface bg-ds-accent text-ds-onaccent shadow-[0_8px_20px_rgba(58,34,18,0.22)] transition-transform active:scale-95">
                  <Icon size={26} weight="bold" />
                </span>
              </span>
              {label}
            </Link>
          );
        }

        const active = isActivePath(pathname, href, exact);
        return (
          <Link
            key={href}
            href={withCafe(href)}
            aria-current={active ? "page" : undefined}
            className={cn(
              tabClass,
              active ? "font-bold text-ds-accent" : "font-semibold text-ds-text2"
            )}
          >
            <span className="flex h-7 items-center justify-center" aria-hidden>
              <Icon size={24} weight={active ? "fill" : "regular"} />
            </span>
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={onMore}
        aria-expanded={moreOpen}
        aria-haspopup="dialog"
        className={cn(
          tabClass,
          moreActive ? "font-bold text-ds-accent" : "font-semibold text-ds-text2"
        )}
      >
        <span className="flex h-7 items-center justify-center" aria-hidden>
          <DotsThreeOutline size={24} weight={moreActive ? "fill" : "regular"} />
        </span>
        Plus
      </button>
    </nav>
  );
}
