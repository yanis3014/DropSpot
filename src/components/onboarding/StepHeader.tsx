'use client';

import { ArrowLeft } from '@phosphor-icons/react';
import { cn } from '@/lib/cn';

interface StepHeaderProps {
  /** 1-based position in the questionnaire. */
  step: number;
  total: number;
  onBack?: () => void;
  onSkip?: () => void;
}

/** Back button + progress bar shown on the question steps. */
export default function StepHeader({ step, total, onBack, onSkip }: StepHeaderProps) {
  return (
    <div className="mb-5 flex shrink-0 items-center gap-3">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Retour"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ds-text2 hover:bg-ds-surface2"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
      ) : (
        <span className="-ml-2 h-11 w-11" />
      )}
      <div
        className="flex flex-1 gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step}
        aria-label={`Étape ${step} sur ${total}`}
      >
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors duration-500',
              i < step ? 'bg-ds-accent' : 'bg-ds-surface2'
            )}
          />
        ))}
      </div>
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          className="-mr-2 h-11 px-2 text-sm font-bold text-ds-text2 hover:text-ds-text"
        >
          Passer
        </button>
      ) : (
        <span className="w-9 text-right text-xs font-semibold tabular-nums text-ds-text2">
          {step}/{total}
        </span>
      )}
    </div>
  );
}
