'use client';

import type { ReactNode } from 'react';
import { UsersThree } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { NEED_OPTIONS, toggleInList, type NeedId } from '@/lib/onboarding';
import { cn } from '@/lib/cn';
import { NEED_ICONS } from './icons';
import StepLayout, { StepTitle } from './StepLayout';

interface NeedsStepProps {
  header: ReactNode;
  value: NeedId[];
  onChange: (next: NeedId[]) => void;
  onNext: () => void;
  onSkip: () => void;
}

/** Step 2 of 3: must-haves, pre-checked from the envies. Optional. */
export default function NeedsStep({ header, value, onChange, onNext, onSkip }: NeedsStepProps) {
  return (
    <StepLayout
      header={header}
      footer={
        <>
          <Button variant="main" onClick={onNext} className="w-full">
            Continuer
          </Button>
          <button
            type="button"
            onClick={onSkip}
            className="h-11 w-full text-sm font-bold text-ds-text2 hover:text-ds-text"
          >
            Passer
          </button>
        </>
      }
    >
      <StepTitle
        title="Tes indispensables"
        subtitle="On a pré-coché selon tes envies. Les cafés qui les ont passent en premier."
      />
      <div className="mt-5 flex flex-wrap gap-2.5">
        {NEED_OPTIONS.map((opt) => {
          const selected = value.includes(opt.id);
          const NeedIcon = NEED_ICONS[opt.id];
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(toggleInList(value, opt.id))}
              className={cn(
                'inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold transition-all active:scale-[0.97]',
                selected
                  ? 'border-2 border-ds-accent bg-ds-accentsoft text-ds-accenttext'
                  : 'border border-ds-line bg-ds-surface text-ds-text'
              )}
            >
              <NeedIcon size={18} weight={selected ? 'bold' : 'regular'} aria-hidden />
              {opt.label}
            </button>
          );
        })}
      </div>
      <div className="mt-7 flex items-start gap-3 rounded-2xl bg-ds-surface2 px-4 py-3.5">
        <UsersThree size={20} className="mt-0.5 shrink-0 text-ds-accenttext" aria-hidden />
        <p className="text-[13px] leading-relaxed text-ds-text2">
          Ces infos sont vérifiées par la communauté. Tu gagneras des Grains en les
          confirmant sur place.
        </p>
      </div>
    </StepLayout>
  );
}
