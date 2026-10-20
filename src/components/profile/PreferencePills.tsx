'use client';

import { Check } from '@phosphor-icons/react';
import Chip from '@/components/ui/Chip';
import { preferenceCatalog, PreferenceId } from '@/lib/preferences';
import { cn } from '@/lib/cn';

interface PreferencePillsProps {
  value: PreferenceId[];
  onChange: (next: PreferenceId[]) => void;
  /** Compact single-line pills (settings) vs. rich cards (onboarding). */
  variant?: 'cards' | 'pills';
}

export default function PreferencePills({
  value,
  onChange,
  variant = 'cards',
}: PreferencePillsProps) {
  const toggle = (id: PreferenceId) =>
    onChange(value.includes(id) ? value.filter((p) => p !== id) : [...value, id]);

  if (variant === 'pills') {
    return (
      <div className="flex flex-wrap gap-2">
        {preferenceCatalog.map((pref) => {
          const selected = value.includes(pref.id);
          return (
            <Chip
              key={pref.id}
              active={selected}
              onClick={() => toggle(pref.id)}
            >
              <span>{pref.emoji}</span>
              {pref.label}
            </Chip>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {preferenceCatalog.map((pref) => {
        const selected = value.includes(pref.id);
        return (
          <button
            key={pref.id}
            type="button"
            onClick={() => toggle(pref.id)}
            aria-pressed={selected}
            className={cn(
              'relative rounded-2xl border-2 bg-ds-surface p-4 text-left transition-all duration-200 active:scale-[0.97]',
              selected
                ? 'border-ds-accent bg-ds-accentsoft/40 shadow-ds'
                : 'border-transparent shadow-sm hover:shadow-md'
            )}
          >
            <span
              className={cn(
                'absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200',
                selected ? 'scale-100 bg-ds-accent' : 'scale-90 bg-ds-surface2'
              )}
            >
              <Check
                size={13}
                weight="bold"
                className={cn(
                  'text-ds-onaccent transition-opacity',
                  selected ? 'opacity-100' : 'opacity-0'
                )}
              />
            </span>
            <span className="text-3xl leading-none">{pref.emoji}</span>
            <p className="mt-3 pr-6 text-sm font-bold leading-snug text-ds-text">
              {pref.label}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-ds-text2">
              {pref.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
