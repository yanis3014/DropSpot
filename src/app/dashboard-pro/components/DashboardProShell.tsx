'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Lightning,
  QrCode,
  GearSix,
} from '@phosphor-icons/react';

const NAV: {
  href: string;
  label: string;
  icon: typeof House;
  exact?: boolean;
}[] = [
  { href: '/dashboard-pro', label: 'Accueil', icon: House, exact: true },
  { href: '/dashboard-pro/validate', label: 'Caisse', icon: QrCode },
  { href: '/dashboard-pro/settings', label: 'Fiche', icon: GearSix },
];

export default function DashboardProShell({
  title,
  subtitle,
  children,
  actions,
  hideNav = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  /** Masque la nav (ex. tunnel d'onboarding). */
  hideNav?: boolean;
}) {
  const pathname = usePathname();

  return (
    <div
      className={`flex-1 min-h-full bg-ds-bg ${
        hideNav ? 'pb-10' : 'pb-[calc(5.5rem+env(safe-area-inset-bottom))]'
      }`}
    >
      <header className="sticky top-0 z-30 bg-ds-bg/90 backdrop-blur-md border-b border-ds-text2/10 px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-ds-ok flex items-center gap-1">
              <Lightning size={12} weight="fill" /> Espace pro
            </p>
            <h1 className="text-xl font-extrabold text-ds-text tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-ds-text2 truncate mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions}
        </div>
      </header>

      <div className="px-5 py-6">{children}</div>

      {!hideNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md bg-ds-surface/95 backdrop-blur-md border-t border-ds-text2/15 px-4 pt-2 safe-pb shadow-[0_-10px_20px_rgba(0,0,0,0.04)] rounded-t-3xl"
          aria-label="Navigation espace pro"
        >
          <div className="flex items-stretch justify-around gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-xl text-[10px] font-bold transition-all active:scale-95 ${
                    active
                      ? 'text-ds-ok'
                      : 'text-ds-text2 hover:text-ds-text'
                  }`}
                >
                  <div className="relative">
                    <Icon size={22} weight={active ? 'fill' : 'regular'} />
                    {active && (
                      <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-ds-ok" />
                    )}
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
