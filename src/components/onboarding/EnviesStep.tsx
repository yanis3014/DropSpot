'use client';

import type { ReactNode } from 'react';
import { ArrowRight, Check } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { ENVIE_OPTIONS, toggleInList, type EnvieId } from '@/lib/onboarding';
import { cn } from '@/lib/cn';
import { ENVIE_ICONS } from './icons';
import StepLayout, { GhostAction, StepTitle } from './StepLayout';

interface EnviesStepProps {
  header: ReactNode;
  value: EnvieId[];
  onChange: (next: EnvieId[]) => void;
  onNext: () => void;
}

/** Step 1 of 3: multi-select envies. */
export default function EnviesStep({ header, value, onChange, onNext }: EnviesStepProps) {
  const allSelected = value.length === ENVIE_OPTIONS.length;
  const count = value.length;

  return (
    <StepLayout
      header={header}
      footer={
        <Button variant="main" onClick={onNext} disabled={count === 0} className="w-full">
          {count === 0
            ? 'Choisis au moins une envie'
            : `Continuer · ${count} envie${count > 1 ? 's' : ''}`}
          {count > 0 ? <ArrowRight size={18} weight="bold" aria-hidden /> : null}
        </Button>
      }
    >
      <StepTitle
        title="Qu’est-ce qui te donne envie ?"
        subtitle="Choisis tout ce qui te parle. Tu pourras changer quand tu veux."
      />
      <div className="mt-5 grid grid-cols-3 gap-2.5">
        {ENVIE_OPTIONS.map((opt) => {
          const selected = value.includes(opt.id);
          const EnvieIcon = ENVIE_ICONS[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(toggleInList(value, opt.id))}
              className={cn(
                'relative flex min-h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] px-2 py-3 text-center transition-all active:scale-[0.97]',
                selected
                  ? 'border-2 border-ds-accent bg-ds-accentsoft text-ds-accenttext'
                  : 'border border-ds-line bg-ds-surface text-ds-text'
              )}
            >
              {selected ? (
                <span className="animate-pop absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-ds-accent text-ds-onaccent">
                  <Check size={12} weight="bold" aria-hidden />
                </span>
              ) : null}
              <EnvieIcon
                size={28}
                weight={selected ? 'fill' : 'regular'}
                className={selected ? 'text-ds-accent' : 'text-ds-text2'}
                aria-hidden
              />
              <span className="text-[13px] font-extrabold leading-tight">{opt.label}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2">
        <GhostAction
          onClick={() =>
            onChange(allSelected ? [] : ENVIE_OPTIONS.map((o) => o.id))
          }
        >
          {allSelected ? 'Tout désélectionner' : 'Tout me tente'}
        </GhostAction>
      </div>
    </StepLayout>
  );
}
