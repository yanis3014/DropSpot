import Link from 'next/link';
import type { ReactNode } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';

/** One line of the profile summary, opening a sub-page. */
export default function ProfileRow({
  href,
  icon,
  title,
  subtitle,
  muted = false,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  /** Neutral icon disc (settings) instead of the accent one. */
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[60px] items-center gap-3 px-3.5 py-2 text-ds-text no-underline [&+&]:border-t [&+&]:border-ds-line"
    >
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          muted
            ? 'bg-ds-surface2 text-ds-text2'
            : 'bg-ds-accentsoft text-ds-accenttext'
        )}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[15px] font-bold">{title}</span>
        {subtitle ? (
          <span className="truncate text-[13px] text-ds-text2">{subtitle}</span>
        ) : null}
      </span>
      <CaretRight
        size={18}
        weight="bold"
        className="shrink-0 text-ds-text2"
        aria-hidden
      />
    </Link>
  );
}
