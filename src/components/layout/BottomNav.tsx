'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, MapTrifold, MapPinPlus, Heart } from '@phosphor-icons/react';

const navItems = [
  { href: '/', label: 'Feed', icon: House },
  { href: '/map', label: 'Map', icon: MapTrifold },
  { href: '/check-in', label: 'Check-in', icon: MapPinPlus },
  { href: '/saved', label: 'Saved', icon: Heart },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-brand-mocha/20 z-50">
      <div className="max-w-md mx-auto flex justify-around items-center h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center w-full h-full transition-colors ${
                isActive ? 'text-brand-matcha' : 'text-brand-mocha'
              }`}
            >
              <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
              <span className="text-xs mt-1">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
