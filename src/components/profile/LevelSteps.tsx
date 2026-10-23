import { GRAIN_BADGES } from '@/lib/grains';
import { cn } from '@/lib/cn';

/** The four levels as a track; reached ones are highlighted. */
export default function LevelSteps({ lifetime }: { lifetime: number }) {
  return (
    <ol className="m-0 grid list-none grid-cols-4 gap-1 p-0">
      {GRAIN_BADGES.map((badge) => {
        const reached = lifetime >= badge.threshold;
        return (
          <li
            key={badge.name}
            className="flex flex-col items-center gap-1 text-center"
          >
            <span
              aria-hidden
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 text-xl',
                reached
                  ? 'border-ds-accent bg-ds-accentsoft'
                  : 'border-ds-line bg-ds-surface2 grayscale'
              )}
            >
              {badge.icon}
            </span>
            <span
              className={cn(
                'text-[12px] font-bold leading-tight',
                reached ? 'text-ds-text' : 'text-ds-text2'
              )}
            >
              {badge.name}
            </span>
            <span className="text-[11px] text-ds-text2">
              {reached ? 'Atteint' : `${badge.threshold} Grains`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
