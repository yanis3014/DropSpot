'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarBlank, CaretRight } from '@phosphor-icons/react';
import ProfileSubHeader from '@/components/profile/ProfileSubHeader';
import EmptyState from '@/components/ui/EmptyState';
import { EVENT_CATEGORY_ICONS } from '@/components/drops/DropCard';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  formatStartLabel,
  getMyUpcomingEvents,
  isDropLive,
  type Drop,
} from '@/lib/api/drops';

/** Upcoming events the user said « Je participe » to. */
export default function ProfileEventsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [events, setEvents] = useState<Drop[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getMyUpcomingEvents()
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
      <ProfileSubHeader title="Mes événements" />

      {events === null ? (
        <div className="h-[72px] animate-pulse rounded-[18px] bg-ds-surface2" />
      ) : events.length === 0 ? (
        <div className="rounded-[22px] border border-ds-line bg-ds-surface py-8">
          <EmptyState
            icon={<CalendarBlank weight="regular" />}
            title="Aucun événement prévu"
            description="Dis « Je participe » sur un événement pour le retrouver ici."
            actionLabel="Voir les drops"
            onAction={() => router.push('/drops')}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {events.map((drop) => {
            const Icon = EVENT_CATEGORY_ICONS[drop.event_category ?? 'other'];
            return (
              <Link
                key={drop.id}
                href={`/drop/${drop.id}`}
                className="flex items-center gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-3.5 no-underline"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ds-accentsoft text-ds-accenttext">
                  <Icon size={20} weight="bold" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15px] font-bold text-ds-text">
                    {drop.title}
                  </span>
                  <span className="truncate text-[13px] font-medium text-ds-text2">
                    {drop.places?.name ?? 'Café'} ·{' '}
                    {isDropLive(drop) ? 'En ce moment' : formatStartLabel(drop.start_time)}
                  </span>
                </span>
                <CaretRight size={18} weight="bold" className="ml-auto shrink-0 text-ds-text2" />
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
