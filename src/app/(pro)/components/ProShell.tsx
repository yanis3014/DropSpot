"use client";

import { Suspense, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Crown,
  DotsThreeOutline,
  GearSix,
  House,
  Lightning,
  ListChecks,
  MapTrifold,
  QrCode,
  SignOut,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/hooks/useAuth";
import { useVendorProfile } from "@/app/(pro)/dashboard-pro/hooks/useVendorProfile";
import { useVendorPlan } from "@/hooks/useVendorPlan";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import {
  filterProNavHref,
  isMoreNavPath,
  moreNavHrefsForRole,
} from "@/lib/pro/navAccess";
import { writeDropspotMode } from "@/lib/auth/dropspotMode";
import PlanBadge from "@/components/pro/PlanBadge";
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

const MORE_NAV: {
  href: string;
  label: string;
  icon: typeof House;
}[] = [
  { href: "/etablissement", label: "Établissement", icon: Storefront },
  { href: "/specificites", label: "Spécificités", icon: ListChecks },
  { href: "/equipe", label: "Équipe", icon: UsersThree },
  { href: "/abonnement", label: "Abonnement", icon: Crown },
  { href: "/reglages", label: "Réglages", icon: GearSix },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ProShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isAuthenticated,
    loading: authLoading,
    displayName,
    avatarUrl,
    signOut,
  } = useAuth();
  const { profile } = useVendorProfile(isAuthenticated, authLoading);
  const { plan, hasPro: hasProSubscription } = useVendorPlan(
    isAuthenticated && !authLoading
  );
  const {
    places,
    activePlace,
    activeMemberRole,
    activeIndex,
    total,
    setActivePlaceId,
    withCafe,
    initialsFor,
  } = useActivePlace();

  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const hideChrome =
    pathname.startsWith("/dashboard-pro/onboarding") ||
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

  const navRole = activeMemberRole;
  const moreActive = isMoreNavPath(pathname);
  const moreItems = MORE_NAV.filter(({ href }) =>
    moreNavHrefsForRole(navRole).includes(href)
  );

  const goToClientApp = () => {
    writeDropspotMode("client");
    setMoreOpen(false);
    router.push("/map");
  };

  const handleSignOut = () => {
    setMoreOpen(false);
    void signOut();
  };

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
          {SIDE_NAV.filter(({ href }) => filterProNavHref(href, navRole)).map(({ href, label, icon: Icon, exact }) => {
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
              <PlanBadge plan={plan} />
              <span className="text-[13px] text-ds-text2">Ton offre</span>
            </div>
            {!hasProSubscription && (
              <Link
                href={withCafe("/abonnement")}
                className="text-sm font-bold text-ds-accent no-underline"
              >
                Découvrir Pro →
              </Link>
            )}
          </div>

          <nav aria-label="Compte" className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={goToClientApp}
              className="flex h-[42px] items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-ds-text2 transition-colors hover:bg-ds-surface2/70 hover:text-ds-text"
            >
              <MapTrifold size={20} weight="regular" aria-hidden />
              Voir l&apos;app client
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex h-[42px] items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold text-ds-text2 transition-colors hover:bg-ds-surface2/70 hover:text-ds-text"
            >
              <SignOut size={20} weight="regular" aria-hidden />
              Se déconnecter
            </button>
          </nav>

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
          className="fixed inset-x-0 bottom-0 z-50 flex items-stretch border-t border-ds-line bg-ds-surface px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          {MOBILE_NAV.filter(({ href }) => filterProNavHref(href, navRole)).map(({ href, label, icon: Icon, exact, scan }) => {
            const active = isActivePath(pathname, href, exact);
            return (
              <Link
                key={href}
                href={withCafe(href)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-1 text-xs no-underline",
                  scan
                    ? "font-bold text-ds-text"
                    : active
                      ? "font-semibold text-ds-accent"
                      : "font-semibold text-ds-text2"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 items-center justify-center rounded-full",
                    scan
                      ? "w-14 bg-ds-accent text-ds-onaccent shadow-[0_4px_14px_rgba(58,34,18,0.18)]"
                      : "w-8"
                  )}
                >
                  <Icon
                    size={scan ? 20 : 22}
                    weight={scan ? "bold" : active ? "fill" : "regular"}
                    aria-hidden
                  />
                </span>
                {label}
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 text-xs font-semibold",
              moreActive || moreOpen ? "text-ds-accent" : "text-ds-text2"
            )}
          >
            <span className="flex h-8 w-8 items-center justify-center">
              <DotsThreeOutline
                size={22}
                weight={moreActive || moreOpen ? "fill" : "regular"}
                aria-hidden
              />
            </span>
            Plus
          </button>
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

      <ProMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={moreItems}
        pathname={pathname}
        withCafe={withCafe}
        onClientApp={goToClientApp}
        onSignOut={handleSignOut}
      />
    </div>
  );
}

function ProMoreSheet({
  open,
  onClose,
  items,
  pathname,
  withCafe,
  onClientApp,
  onSignOut,
}: {
  open: boolean;
  onClose: () => void;
  items: { href: string; label: string; icon: typeof House }[];
  pathname: string;
  withCafe: (href: string) => string;
  onClientApp: () => void;
  onSignOut: () => void;
}) {
  const titleId = useId();
  if (!open) return null;

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
            Plus
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-1 text-base font-bold text-ds-accent"
          >
            Fermer
          </button>
        </div>
        <nav aria-label="Plus" className="flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActivePath(pathname, href);
            return (
              <Link
                key={href}
                href={withCafe(href)}
                onClick={onClose}
                className={cn(
                  "flex min-h-[56px] items-center gap-3 rounded-2xl px-3.5 text-[16px] font-bold no-underline",
                  active
                    ? "bg-ds-accentsoft text-ds-text"
                    : "text-ds-text"
                )}
              >
                <Icon size={22} weight={active ? "fill" : "regular"} aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-1 flex flex-col gap-1 border-t border-ds-line pt-2">
          <button
            type="button"
            onClick={onClientApp}
            className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3.5 text-left text-[16px] font-bold text-ds-text"
          >
            <MapTrifold size={22} weight="regular" aria-hidden />
            Voir l&apos;app client
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="flex min-h-[52px] items-center gap-3 rounded-2xl px-3.5 text-left text-[16px] font-bold text-ds-text"
          >
            <SignOut size={22} weight="regular" aria-hidden />
            Se déconnecter
          </button>
        </div>
      </div>
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
