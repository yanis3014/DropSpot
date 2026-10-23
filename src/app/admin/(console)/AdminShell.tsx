"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ClockCounterClockwise,
  Crown,
  DotsThreeOutline,
  Briefcase,
  MapTrifold,
  SealCheck,
  SignOut,
  Storefront,
  Tray,
  UsersThree,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/hooks/useAuth";
import { writeDropspotMode } from "@/lib/auth/dropspotMode";
import { fetchIsPro } from "@/app/(pro)/dashboard-pro/lib/api/vendor";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Tray;
  exact?: boolean;
  /** Not built yet: shown greyed out so the plan stays visible. */
  soon?: boolean;
  count?: number;
};

function isActivePath(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function CountPill({ value }: { value?: number }) {
  if (!value) return null;
  return (
    <span className="ml-auto min-w-[22px] rounded-full bg-ds-accent px-1.5 text-center text-[11px] font-bold leading-[18px] text-ds-onaccent tabular-nums">
      {value}
    </span>
  );
}

/** Admin console chrome: ink sidebar on desktop, top bar + tabs on phone. */
export default function AdminShell({
  pendingClaims,
  placesToReview,
  children,
}: {
  pendingClaims: number;
  placesToReview: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut, displayName } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchIsPro().then((value) => {
      if (!cancelled) setIsPro(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const main: NavItem[] = [
    { href: "/admin", label: "À traiter", icon: Tray, exact: true, count: pendingClaims + placesToReview },
    { href: "/admin/revendications", label: "Revendications", icon: SealCheck, count: pendingClaims },
    { href: "/admin/cafes", label: "Cafés", icon: Storefront, count: placesToReview },
    { href: "/admin/utilisateurs", label: "Utilisateurs", icon: UsersThree },
    { href: "/admin/abonnements", label: "Abonnements Pro", icon: Crown },
  ];
  const follow: NavItem[] = [
    { href: "/admin/journal", label: "Journal", icon: ClockCounterClockwise },
  ];

  const goToClientApp = () => {
    writeDropspotMode("client");
    setMoreOpen(false);
    router.push("/map");
  };
  const goToProSpace = () => {
    writeDropspotMode("pro");
    setMoreOpen(false);
    router.push("/dashboard-pro");
  };
  const handleSignOut = () => {
    setMoreOpen(false);
    void signOut();
  };

  const renderSideItem = ({ href, label, icon: Icon, exact, soon, count }: NavItem) => {
    if (soon) {
      return (
        <span
          key={href}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold text-ds-onadmin/40"
        >
          <Icon size={19} aria-hidden />
          {label}
          <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">bientôt</span>
        </span>
      );
    }
    const active = isActivePath(pathname, href, exact);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-semibold no-underline transition-colors",
          active
            ? "bg-white/12 text-ds-onadmin"
            : "text-ds-onadmin/75 hover:bg-white/8 hover:text-ds-onadmin"
        )}
      >
        <Icon size={19} weight={active ? "fill" : "regular"} aria-hidden />
        {label}
        <CountPill value={count} />
      </Link>
    );
  };

  const accountButtons = (
    <>
      <button
        type="button"
        onClick={goToClientApp}
        className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-ds-onadmin/75 hover:bg-white/8 hover:text-ds-onadmin"
      >
        <MapTrifold size={19} aria-hidden />
        Voir l&apos;app client
      </button>
      {isPro ? (
        <button
          type="button"
          onClick={goToProSpace}
          className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-ds-onadmin/75 hover:bg-white/8 hover:text-ds-onadmin"
        >
          <Briefcase size={19} aria-hidden />
          Espace pro
        </button>
      ) : null}
      <button
        type="button"
        onClick={handleSignOut}
        className="flex h-10 items-center gap-3 rounded-xl px-3 text-left text-[14px] font-semibold text-ds-onadmin/75 hover:bg-white/8 hover:text-ds-onadmin"
      >
        <SignOut size={19} aria-hidden />
        Se déconnecter
      </button>
    </>
  );

  return (
    <div className="relative flex min-h-full w-full bg-ds-bg text-ds-text">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[256px] shrink-0 flex-col gap-4 bg-ds-admin px-3 py-5 text-ds-onadmin lg:flex">
        <div className="flex items-center gap-2 px-2.5">
          <span className="font-display text-[20px] font-extrabold tracking-tight">Dropspot</span>
          <span className="rounded bg-ds-onadmin px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-ds-admin">
            ADMIN
          </span>
        </div>
        <nav aria-label="Administration" className="flex flex-col gap-0.5">
          {main.map(renderSideItem)}
          <span className="px-3 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ds-onadmin/50">
            Suivi
          </span>
          {follow.map(renderSideItem)}
        </nav>
        <div className="mt-auto flex flex-col gap-0.5 border-t border-white/12 pt-3">
          {accountButtons}
          {displayName ? (
            <span className="truncate px-3 pt-2 text-[13px] text-ds-onadmin/60">{displayName}</span>
          ) : null}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar: the ink band says « admin » at a glance. */}
        <header className="flex items-center justify-between bg-ds-admin px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] text-ds-onadmin lg:hidden">
          <span className="font-display text-[18px] font-extrabold">Dropspot</span>
          <span className="rounded bg-ds-onadmin px-1.5 py-0.5 text-[10px] font-bold tracking-[0.08em] text-ds-admin">
            ADMIN
          </span>
        </header>

        <main className="flex min-h-0 flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>

        <nav
          aria-label="Navigation admin"
          className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-3 border-t border-ds-line bg-ds-surface/95 px-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
        >
          {main.slice(0, 2).map(({ href, label, icon: Icon, exact, count }) => {
            const active = isActivePath(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-1 pt-2 text-[11px] leading-none no-underline",
                  active ? "font-bold text-ds-admintext" : "font-semibold text-ds-text2"
                )}
              >
                <span className="relative flex h-7 items-center justify-center" aria-hidden>
                  <Icon size={24} weight={active ? "fill" : "regular"} />
                  {count ? (
                    <span className="absolute -right-3 -top-0.5 min-w-[18px] rounded-full bg-ds-accent px-1 text-center text-[10px] font-bold leading-4 text-ds-onaccent">
                      {count}
                    </span>
                  ) : null}
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
              "flex flex-col items-center gap-1 pt-2 text-[11px] leading-none",
              moreOpen ? "font-bold text-ds-admintext" : "font-semibold text-ds-text2"
            )}
          >
            <span className="flex h-7 items-center justify-center" aria-hidden>
              <DotsThreeOutline size={24} weight={moreOpen ? "fill" : "regular"} />
            </span>
            Plus
          </button>
        </nav>
      </div>

      <AdminMoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        items={[...main.slice(2), ...follow]}
      >
        {accountButtons}
      </AdminMoreSheet>
    </div>
  );
}

function AdminMoreSheet({
  open,
  onClose,
  items,
  children,
}: {
  open: boolean;
  onClose: () => void;
  items: NavItem[];
  children: React.ReactNode;
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
        className="absolute inset-x-0 bottom-0 flex flex-col gap-2 rounded-t-[28px] bg-ds-admin px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-2.5 text-ds-onadmin shadow-lg"
      >
        <div className="mx-auto h-1.5 w-10 rounded-full bg-white/25" aria-hidden />
        <div className="flex items-center justify-between px-1 py-1.5">
          <h2 id={titleId} className="font-display text-[22px] font-extrabold">
            Plus
          </h2>
          <button type="button" onClick={onClose} className="h-11 px-1 text-base font-bold">
            Fermer
          </button>
        </div>
        <ul className="flex flex-col gap-0.5">
          {items.map(({ href, label, icon: Icon, soon, count }) => (
            <li key={href}>
              {soon ? (
                <span className="flex h-11 items-center gap-3 px-3 text-[15px] font-semibold text-ds-onadmin/45">
                  <Icon size={20} aria-hidden />
                  {label}
                  <span className="ml-auto text-[10px] font-bold uppercase tracking-wider">bientôt</span>
                </span>
              ) : (
                <Link
                  href={href}
                  onClick={onClose}
                  className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ds-onadmin no-underline"
                >
                  <Icon size={20} aria-hidden />
                  {label}
                  <CountPill value={count} />
                </Link>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-1 flex flex-col gap-0.5 border-t border-white/12 pt-2">{children}</div>
      </div>
    </div>
  );
}
