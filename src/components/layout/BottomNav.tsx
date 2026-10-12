'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Heart,
  House,
  MapTrifold,
  Plus,
} from '@phosphor-icons/react';

const leftItems = [
  { href: '/', label: 'Accueil', icon: House },
  { href: '/map', label: 'Carte', icon: MapTrifold },
];

const rightItems = [
  { href: '/gamification', label: 'Activité', icon: Bell },
  { href: '/saved', label: 'Favoris', icon: Heart },
];

function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string;
  label: string;
  icon: typeof House;
  isActive: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-1 p-2 transition active:scale-95 ${
        isActive ? 'text-brand-green' : 'text-gray-400 hover:text-gray-700'
      }`}
    >
      <div className="relative">
        <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
        {isActive && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 bg-brand-green rounded-full" />
        )}
      </div>
      <span
        className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}
      >
        {label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto w-full max-w-md bg-white dark:bg-brand-surface border-t border-gray-200 dark:border-brand-mocha/15 px-6 pt-3 safe-pb z-50 flex justify-between items-center shadow-[0_-10px_20px_rgba(0,0,0,0.03)] rounded-t-3xl">
      {leftItems.map((item) => (
        <NavItem
          key={item.href}
          {...item}
          isActive={pathname === item.href}
        />
      ))}

      {/* Bouton central d'action → check-in */}
      <Link
        href="/check-in"
        aria-label="Check-in"
        className="flex flex-col items-center justify-center -mt-6"
      >
        <div className="bg-brand-dark text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-brand-dark/20 transform transition hover:scale-105 active:scale-95 border-4 border-brand-light">
          <Plus size={24} weight="bold" />
        </div>
      </Link>

      {rightItems.map((item) => (
        <NavItem
          key={item.href}
          {...item}
          isActive={pathname === item.href}
        />
      ))}
    </nav>
  );
}
