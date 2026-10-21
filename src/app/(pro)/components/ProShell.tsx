"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Crown,
  GearSix,
  House,
  Lightning,
  ListChecks,
  QrCode,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/hooks/useAuth";
import { useVendorProfile } from "@/app/(pro)/dashboard-pro/hooks/useVendorProfile";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import {
  CafeSelectTrigger,
  ProCafeSwitcher,
} from "@/app/(pro)/components/ProCafeSwitcher";

const SIDE_NAV: {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
}[] = [
  { href: "/dashboard-pro", label: "Accueil", icon: House, exact: true },
  { href: "/dashboard-pro/drops", label: "Drops", icon: Lightning },
  { href: "/etablissement", label: "Établissement", icon: Storefront },
  { href: "/specificites", label: "Spécificités", icon: ListChecks },
  { href: "/equipe", label: "Équipe", icon: UsersThree },
  { href: "/abonnement", label: "Abonnement", icon: Crown },
  { href: "/reglages", label: "Réglages", icon: GearSix },
];

const MOBILE_NAV: {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
  scan?: boolean;
}[] = [
  { href: "/dashboard-pro", label: "Aujourd'hui", icon: House, exact: true },
  { href: "/valider", label: "Valider", icon: QrCode, scan: true },
  { href: "/dashboard-pro/drops", label: "Drops", icon: Lightning },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ProShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isAuthenticated, loading: authLoading, displayName, avatarUrl } =
    useAuth();
  const { profile } = useVendorProfile(isAuthenticated, authLoading);
  const {
    places,
    activePlace,
    activeIndex,
    total,
    setActivePlaceId,
    withCafe,
    initialsFor,
  } = useActivePlace();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const hideChrome =
    pathname.startsWith("/dashboard-pro/onboarding") ||
    pathname === "/dashboard-pro/validate" ||
    pathname.startsWith("/dashboard-pro/validate/") ||
    pathname === "/valider" ||
    pathname.startsWith("/valider/");

  const userLabel =
    profile?.full_name?.trim() ||
    displayName?.trim() ||
    "Gérant";
  const userInitial = (userLabel[0] ?? "G").toUpperCase();
  const placeInitials = activePlace
    ? initialsFor(activePlace.name)
    : "?";

  // Plan badge: no subscription API yet — default free.
  const isPro = false;

  if (hideChrome) {
    return (
      <div className="flex min-h-full w-full flex-col bg-ds-bg">{children}</div>
    );
  }

  return (
    <div className="relative flex min-h-full w-full bg-ds-bg text-ds-text">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-[18px] border-r border-ds-line bg-ds-surface px-4 py-5 lg:flex">
        <div className="flex items-baseline justify-between px-1.5 pt-0.5">
          <span className="font-display text-[23px] font-extrabold tracking-tight">
            Dropspot
          </span>
          <span className="text-[13px] font-bold text-ds-text2">
            Espace gérant
          </span>
        </div>

        <CafeSelectTrigger
          activePlace={activePlace}
          activeIndex={activeIndex}
          total={total}
          initials={placeInitials}
          expanded={switcherOpen}
          onClick={() => setSwitcherOpen(true)}
        />

        <nav aria-label="Menu" className="flex flex-col gap-0.5">
          {SIDE_NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActivePath(pathname, href, exact);
            return (
              <Link
                key={href}
                href={withCafe(href)}
                className={cn(
                  "flex h-[42px] items-center gap-3 rounded-xl px-3 text-[15px] font-semibold no-underline transition-colors",
                  active
                    ? "bg-ds-surface2 text-ds-text"
                    : "text-ds-text2 hover:bg-ds-surface2/70 hover:text-ds-text"
                )}
              >
                <Icon size={20} weight={active ? "fill" : "regular"} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-3">
          <div className="flex flex-col gap-2 rounded-[14px] bg-ds-surface2 p-3.5">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex h-6 items-center rounded-xl px-2.5 text-[12px] font-extrabold uppercase tracking-[0.04em]",
                  isPro
                    ? "bg-ds-text text-ds-bg"
                    : "border-[1.5px] border-ds-line text-ds-text2"
                )}
              >
                {isPro ? "Pro" : "Gratuit"}
              </span>
              <span className="text-[13px] text-ds-text2">Ton offre</span>
            </div>
            {!isPro && (
              <Link
                href={withCafe("/abonnement")}
                className="text-sm font-bold text-ds-accent no-underline"
              >
                Découvrir Pro →
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2.5 px-1.5 py-1">
            <span
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-ds-surface2 font-display text-sm font-extrabold text-ds-text2 bg-cover bg-center"
              style={avatarUrl ? { backgroundImage: `url(${avatarUrl})` } : undefined}
              aria-hidden
            >
              {avatarUrl ? null : userInitial}
            </span>
            <span className="truncate text-sm font-semibold">{userLabel}</span>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile cafe pill */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] lg:hidden">
          <CafeSelectTrigger
            compact
            activePlace={activePlace}
            activeIndex={activeIndex}
            total={total}
            initials={placeInitials}
            expanded={switcherOpen}
            onClick={() => setSwitcherOpen(true)}
          />
        </div>

        <main className="flex min-h-0 flex-1 flex-col pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Navigation comptoir"
          className="fixed inset-x-0 bottom-0 z-50 flex h-[88px] items-start border-t border-ds-line bg-ds-surface px-4 pt-1.5 lg:hidden safe-pb"
        >
          {MOBILE_NAV.map(({ href, label, icon: Icon, exact, scan }) => {
            const active = isActivePath(pathname, href, exact);
            if (scan) {
              return (
                <Link
                  key={href}
                  href={withCafe(href)}
                  className="-mt-[30px] flex flex-1 flex-col items-center gap-1 text-xs font-bold text-ds-text no-underline"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-ds-bg bg-ds-accent text-ds-onaccent shadow-[0_6px_24px_rgba(58,34,18,0.14)]">
                    <Icon size={26} weight="bold" aria-hidden />
                  </span>
                  {label}
                </Link>
              );
            }
            return (
              <Link
                key={href}
                href={withCafe(href)}
                className={cn(
                  "flex h-[50px] flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold no-underline",
                  active ? "text-ds-accent" : "text-ds-text2"
                )}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="hidden lg:block">
        <ProCafeSwitcher
          variant="desktop"
          open={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          places={places}
          activePlaceId={activePlace?.id ?? null}
          onSelect={setActivePlaceId}
          initialsFor={initialsFor}
        />
      </div>
      <ProCafeSwitcher
        variant="mobile"
        open={switcherOpen}
        onClose={() => setSwitcherOpen(false)}
        places={places}
        activePlaceId={activePlace?.id ?? null}
        onSelect={setActivePlaceId}
        initialsFor={initialsFor}
      />
    </div>
  );
}

export default function ProShell({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-full w-full items-center justify-center bg-ds-bg">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
        </div>
      }
    >
      <ProShellInner>{children}</ProShellInner>
    </Suspense>
  );
}
