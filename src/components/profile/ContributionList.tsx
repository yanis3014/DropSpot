import {
  CalendarCheck,
  CheckCircle,
  Gift,
  MapPin,
  Star,
  Storefront,
  Ticket,
} from '@phosphor-icons/react';
import type { ContributionItem } from '@/lib/api/contributions';
import { cn } from '@/lib/cn';

export function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diffSec = Math.round((Date.now() - then) / 1000);
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, 'second');
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 24) return rtf.format(-diffH, 'hour');
  const diffD = Math.round(diffH / 24);
  if (Math.abs(diffD) < 14) return rtf.format(-diffD, 'day');
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function ContributionIcon({ item }: { item: ContributionItem }) {
  const Icon =
    item.kind === 'check_in'
      ? MapPin
      : item.kind === 'spec_vote'
        ? CheckCircle
        : item.kind === 'event_presence'
          ? CalendarCheck
          : item.kind === 'place_suggested'
            ? Storefront
            : item.kind === 'welcome'
              ? Gift
              : item.kind === 'flash_drop'
                ? Ticket
                : Star;
  return <Icon size={18} weight="regular" aria-hidden />;
}

/** Ledger lines (what earned Grains), newest first. */
export default function ContributionList({ items }: { items: ContributionItem[] }) {
  return (
    <div className="overflow-hidden rounded-[22px] border border-ds-line bg-ds-surface">
      {items.map((item, i) => (
        <div
          key={item.id}
          className={cn(
            'flex min-h-14 items-center gap-3 px-3.5',
            i > 0 && 'border-t border-ds-line'
          )}
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-accentsoft text-ds-accenttext">
            <ContributionIcon item={item} />
          </span>
          <div className="min-w-0 flex-1 py-2">
            <p className="truncate text-[15px] font-bold text-ds-text">
              {item.title}
            </p>
            <p className="truncate text-[13px] text-ds-text2">
              {[item.placeName, item.createdAt ? formatWhen(item.createdAt) : '']
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
          <span
            className={cn(
              'shrink-0 text-[15px] font-bold tabular-nums',
              item.gain < 0 ? 'text-ds-text2' : 'text-ds-accenttext'
            )}
          >
            {item.gain > 0 ? `+${item.gain}` : item.gain}
          </span>
        </div>
      ))}
    </div>
  );
}
