"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lightning, List, MapTrifold, User } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

const items = [
  { href: "/map", label: "Carte", icon: MapTrifold },
  { href: "/list", label: "Liste", icon: List },
  { href: "/drops", label: "Drops", icon: Lightning },
  { href: "/profile", label: "Profil", icon: User },
] as const;

/** Routes without the B2C tab bar (Espace Pro + auth / onboarding). */
const HIDDEN_PREFIXES = ["/dashboard-pro", "/login", "/onboarding"] as const;

export default function BottomNav() {
  const pathname = usePathname();

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

        return (
          <Link
            key={href}
            href={href}
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
