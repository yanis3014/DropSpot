'use client';

import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle, MapPin, NavigationArrow, Spinner } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { ZONE_OPTIONS, toggleInList, type ZoneId } from '@/lib/onboarding';
import { cn } from '@/lib/cn';
import StepLayout, { StepTitle } from './StepLayout';

interface WhereStepProps {
  header: ReactNode;
  geoEnabled: boolean;
  geoLoading: boolean;
  geoMessage: string | null;
  onEnableGeo: () => void;
  zones: ZoneId[];
  onZonesChange: (next: ZoneId[]) => void;
  nextLabel: string;
  busy?: boolean;
  error?: string | null;
  onNext: () => void;
}

/** Step 3 of 3: position first, neighbourhoods as a fallback. */
export default function WhereStep({
  header,
  geoEnabled,
  geoLoading,
  geoMessage,
  onEnableGeo,
  zones,
  onZonesChange,
  nextLabel,
  busy = false,
  error,
  onNext,
}: WhereStepProps) {
  return (
    <StepLayout
      header={header}
      footer={
        <>
          {error ? (
            <p className="pb-2 text-center text-sm text-ds-danger">{error}</p>
          ) : null}
          <Button variant="main" onClick={onNext} disabled={busy} className="w-full">
            {busy ? <Spinner size={18} className="animate-spin" aria-hidden /> : null}
            {nextLabel}
            {busy ? null : <ArrowRight size={18} weight="bold" aria-hidden />}
          </Button>
        </>
      }
    >
      <div className="mb-5 mt-4 flex justify-center">
        <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ds-accentsoft shadow-[0_0_0_14px_color-mix(in_srgb,var(--accentsoft)_50%,transparent)]">
          <MapPin size={48} className="text-ds-accent" aria-hidden />
        </span>
      </div>
      <div className="text-center">
        <StepTitle
          title="Autour de toi"
          subtitle="Pour voir les cafés et les drops les plus proches. Ta position reste sur ton téléphone."
        />
      </div>
      <Button
        variant={geoEnabled ? 'tonal' : 'main'}
        onClick={onEnableGeo}
        disabled={geoLoading || geoEnabled}
        className={cn(
          'mt-5 w-full',
          !geoEnabled && 'bg-ds-pin text-ds-onpin'
        )}
      >
        {geoLoading ? (
          <Spinner size={18} className="animate-spin" aria-hidden />
        ) : geoEnabled ? (
          <CheckCircle size={18} weight="fill" aria-hidden />
        ) : (
          <NavigationArrow size={18} aria-hidden />
        )}
        {geoEnabled ? 'Position activée' : 'Activer ma position'}
      </Button>
      {geoMessage ? (
        <p className="mt-2 text-center text-xs leading-relaxed text-ds-text2" role="status">
          {geoMessage}
        </p>
      ) : null}

      <div className="mb-3.5 mt-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-ds-line" />
        <span className="text-xs font-extrabold uppercase tracking-wider text-ds-text2">
          ou tes quartiers
        </span>
        <span className="h-px flex-1 bg-ds-line" />
      </div>
      <div className="flex flex-wrap gap-2.5">
        {ZONE_OPTIONS.map((opt) => {
          const selected = zones.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onZonesChange(toggleInList(zones, opt.id))}
              className={cn(
                'inline-flex h-11 items-center rounded-full px-4 text-sm font-bold transition-all active:scale-[0.97]',
                selected
                  ? 'border-2 border-ds-accent bg-ds-accentsoft text-ds-accenttext'
                  : 'border border-ds-line bg-ds-surface text-ds-text'
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </StepLayout>
  );
}
