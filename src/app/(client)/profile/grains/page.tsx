'use client';

import { useEffect, useMemo, useState } from 'react';
import ProfileSubHeader from '@/components/profile/ProfileSubHeader';
import LevelSteps from '@/components/profile/LevelSteps';
import { useAuth } from '@/lib/hooks/useAuth';
import { getMyGrains, type MyGrains } from '@/lib/api/grains';
import {
  badgeProgress,
  GRAINS_EARNING,
  PRIORITY_LIFETIME,
} from '@/lib/grains';
import { cn } from '@/lib/cn';

/** Balance, level track, priority status and how to earn Grains. */
export default function ProfileGrainsPage() {
  const { isAuthenticated } = useAuth();
  const [myGrains, setMyGrains] = useState<MyGrains | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void getMyGrains().then((next) => {
      if (!cancelled) setMyGrains(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const grains = myGrains?.balance ?? 0;
  const lifetime = myGrains?.lifetime ?? 0;
  const progress = useMemo(() => badgeProgress(lifetime), [lifetime]);

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
      <ProfileSubHeader title="Grains et niveau" />

      <section className="flex flex-col gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-baseline gap-1.5">
            <span className="font-display text-[40px] font-extrabold leading-none tabular-nums text-ds-text">
              {myGrains ? grains : '–'}
            </span>
            <span className="text-base font-semibold text-ds-text2">
              Grains à dépenser
            </span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-[5px] bg-ds-surface2">
          <div
            className="h-full rounded-[5px] bg-ds-accent transition-[width] duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="m-0 text-sm text-ds-text2">
          {progress.next
            ? `${lifetime} Grains gagnés. Encore ${progress.remaining} pour devenir ${progress.next.name}.`
            : `${lifetime} Grains gagnés. Niveau max atteint, légende locale !`}
        </p>
        <p
          className={cn(
            'm-0 rounded-xl px-3 py-2.5 text-[13px] font-semibold leading-snug',
            myGrains?.priority
              ? 'bg-ds-ok/10 text-ds-ok'
              : 'bg-ds-surface2 text-ds-text2'
          )}
        >
          {myGrains?.priority
            ? 'Accès prioritaire actif : des places te sont réservées sur les drops limités.'
            : `À ${PRIORITY_LIFETIME} Grains gagnés, des places te sont réservées sur les drops limités.`}
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-4">
        <h2 className="font-display m-0 text-[17px] font-bold text-ds-text">
          Les niveaux
        </h2>
        <LevelSteps lifetime={lifetime} />
        <p className="m-0 text-[13px] leading-snug text-ds-text2">
          Les niveaux comptent les Grains gagnés : dépenser des Grains ne fait
          jamais perdre un niveau.
        </p>
      </section>

      <section className="flex flex-col gap-2.5 rounded-[22px] border border-ds-line bg-ds-surface p-4">
        <h2 className="font-display m-0 text-[17px] font-bold text-ds-text">
          Comment gagner des Grains
        </h2>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {GRAINS_EARNING.map((row) => (
            <li key={row.label} className="flex gap-2.5 text-sm text-ds-text2">
              <span className="w-10 shrink-0 font-bold tabular-nums text-ds-accenttext">
                +{row.amount}
              </span>
              {row.label}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
