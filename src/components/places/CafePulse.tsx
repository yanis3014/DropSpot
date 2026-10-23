'use client';

import { CheckCircle, Flag, Question, Storefront } from '@phosphor-icons/react';
import { crowdConfig, type AggregatedVibe } from '@/lib/api/checkins';
import {
  SPEC_STATUS_LABELS,
  sortSpecs,
  specDetail,
  specLabel,
  type PlaceSpec,
  type SpecStatus,
} from '@/lib/specs';
import { SPEC_ICONS } from '@/components/places/specIcons';
import { cn } from '@/lib/cn';

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h`;
}

const STATUS_STYLE: Record<SpecStatus, { className: string; Icon: typeof CheckCircle }> = {
  confirmed: { className: 'bg-ds-ok/10 text-ds-ok', Icon: CheckCircle },
  declared: { className: 'bg-ds-surface2 text-ds-text', Icon: Storefront },
  pending: { className: 'bg-ds-surface2 text-ds-text2', Icon: Question },
  disputed: { className: 'bg-ds-accent/10 text-ds-accent', Icon: Flag },
  absent: { className: 'bg-ds-surface2 text-ds-text2', Icon: Flag },
};

export interface CafePulseProps {
  vibe?: AggregatedVibe | null;
  specs: PlaceSpec[];
  onImHere: () => void;
}

/**
 * « Le pouls du café » : right now (last 3 h of « Je suis ici ») and the
 * specificities announced by the café and confirmed or disputed on site.
 */
export default function CafePulse({ vibe, specs, onImHere }: CafePulseProps) {
  const crowd = vibe ? crowdConfig[vibe.crowd_level] : null;
  const shown = sortSpecs(specs.filter((s) => s.status !== 'absent'));

  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display px-1 text-xl font-extrabold text-ds-text">
        Le pouls du café
      </h2>

      {crowd && vibe ? (
        <div
          className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${crowd.classes}`}
        >
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
            </span>
            <span className="text-sm font-bold">
              {crowd.label} · Wi-Fi {vibe.wifi_speed === 'good' ? 'rapide' : 'lent'}
            </span>
          </div>
          <span className="text-[12px] font-medium opacity-80">
            {vibe.contributors} personne{vibe.contributors > 1 ? 's' : ''},{' '}
            {timeAgo(vibe.latest_at)}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onImHere}
          className="flex items-center justify-between gap-3 rounded-2xl border border-dashed border-ds-line px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-ds-text2">
            Personne n’a partagé l’ambiance depuis 3 h.
          </span>
          <span className="shrink-0 text-sm font-bold text-ds-accent">Tu y es ?</span>
        </button>
      )}

      {shown.length > 0 ? (
        <ul className="m-0 flex list-none flex-col divide-y divide-ds-line rounded-[18px] border border-ds-line bg-ds-surface p-0">
          {shown.map((spec) => {
            const Icon = SPEC_ICONS[spec.spec];
            const style = STATUS_STYLE[spec.status];
            return (
              <li key={spec.spec} className="flex items-center gap-3 px-3.5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ds-accentsoft text-ds-accenttext">
                  <Icon size={18} weight="bold" aria-hidden />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-[15px] font-bold text-ds-text">
                    {specLabel(spec.spec)}
                  </span>
                  <span className="truncate text-[13px] text-ds-text2">
                    {specDetail(spec)}
                  </span>
                </span>
                <span
                  className={cn(
                    'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold',
                    style.className
                  )}
                >
                  <style.Icon size={13} weight="bold" aria-hidden />
                  {spec.status === 'declared' ? 'Annoncé' : SPEC_STATUS_LABELS[spec.status]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 px-1 text-[15px] text-ds-text2">
          Pas encore d’infos confirmées. Sur place, appuie sur « Je suis ici » pour
          dire ce que tu vois.
        </p>
      )}
    </section>
  );
}
