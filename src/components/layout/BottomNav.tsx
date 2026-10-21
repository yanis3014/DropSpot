"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Lightning, List, MapTrifold, User } from "@phosphor-icons/react";
import { FILTERS_PARAM } from "@/lib/mapFilters";
import { cn } from "@/lib/cn";

const items = [
  { href: "/map", label: "Carte", icon: MapTrifold },
  { href: "/list", label: "Liste", icon: List },
  { href: "/drops", label: "Drops", icon: Lightning },
  { href: "/profile", label: "Profil", icon: User },
] as const;

/** Routes without the B2C tab bar (Espace Pro + auth / onboarding). */
const HIDDEN_PREFIXES = [
  "/dashboard-pro",
  "/etablissement",
  "/specificites",
  "/equipe",
  "/abonnement",
  "/reglages",
  "/valider",
  "/login",
  "/onboarding",
  "/admin",
] as const;

/** Keep shared `?filters=` when switching Carte ↔ Liste. */
function hrefWithSharedFilters(
  href: string,
  pathname: string,
  filters: string | null
): string {
  if (!filters) return href;
  if (
    (href === "/map" || href === "/list") &&
    (pathname === "/map" ||
      pathname === "/list" ||
      pathname.startsWith("/map/") ||
      pathname.startsWith("/list/"))
  ) {
    return `${href}?${FILTERS_PARAM}=${encodeURIComponent(filters)}`;
  }
  return href;
}

function BottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = searchParams.get(FILTERS_PARAM);

  if (
    !pathname ||
    HIDDEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  ) {
    return null;
  }

  return (
    <nav
      aria-label="Navigation principale"
      className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex w-full max-w-md box-border border-t border-ds-line bg-ds-surface px-1.5 pt-1 safe-pb"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const isActive =
          pathname === href || pathname.startsWith(`${href}/`);
        const target = hrefWithSharedFilters(href, pathname, filters);

        return (
          <Link
            key={href}
            href={target}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-1 text-xs font-semibold no-underline transition-colors active:scale-95",
              isActive ? "text-ds-accent" : "text-ds-text2"
            )}
          >
            <span className="flex h-7 w-16 items-center justify-center rounded-2xl">
              <Icon size={22} weight="regular" aria-hidden />
            </span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavInner />
    </Suspense>
  );
}
