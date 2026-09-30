'use client';

import { Check } from '@phosphor-icons/react';
import { preferenceCatalog, PreferenceId } from '@/lib/preferences';

interface PreferencePillsProps {
  value: PreferenceId[];
  onChange: (next: PreferenceId[]) => void;
  /** Compact single-line pills (settings) vs. rich cards (onboarding). */
  variant?: 'cards' | 'pills';
}

export default function PreferencePills({ value, onChange, variant = 'cards' }: PreferencePillsProps) {
  const toggle = (id: PreferenceId) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  if (variant === 'pills') {
    return (
      <div className="flex flex-wrap gap-2">
        {preferenceCatalog.map((pref) => {
          const selected = value.includes(pref.id);
          return (
            <button
              key={pref.id}
              type="button"
              onClick={() => toggle(pref.id)}
              aria-pressed={selected}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition-all active:scale-95 ${
                selected
                  ? 'bg-brand-espresso text-white border-brand-espresso shadow-md shadow-brand-espresso/20'
                  : 'bg-white text-brand-espresso border-brand-mocha/15 hover:border-brand-espresso/30'
              }`}
            >
              <span>{pref.emoji}</span>
              {pref.label}
            </button>
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
            className={`relative text-left bg-white rounded-2xl p-4 border-2 transition-all duration-200 active:scale-[0.97] ${
              selected
                ? 'border-brand-matcha bg-brand-matcha/5 shadow-md shadow-brand-matcha/10'
                : 'border-transparent shadow-sm hover:shadow-md'
            }`}
          >
            <span
              className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 ${
                selected ? 'bg-brand-matcha scale-100' : 'bg-brand-oat scale-90'
              }`}
            >
              <Check
                size={13}
                weight="bold"
                className={`text-white transition-opacity ${selected ? 'opacity-100' : 'opacity-0'}`}
              />
            </span>
            <span className="text-3xl leading-none">{pref.emoji}</span>
            <p className="mt-3 text-sm font-bold text-brand-espresso leading-snug pr-6">{pref.label}</p>
            <p className="mt-1 text-[11px] text-brand-mocha leading-snug">{pref.description}</p>
          </button>
        );
      })}
    </div>
  );
}
