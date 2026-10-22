'use client';

import { BookmarkSimple, CheckCircle, MapPin, type Icon } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import StepLayout from './StepLayout';

const NEXT_MISSIONS: { icon: Icon; text: string }[] = [
  { icon: BookmarkSimple, text: 'Enregistre ton premier café' },
  { icon: MapPin, text: 'Dis « Je suis ici » dans un café' },
  { icon: CheckCircle, text: 'Confirme une info sur place' },
];

interface GrainsStepProps {
  name: string;
  /** Grains credited by `claim_welcome_grains` (0 when already claimed). */
  awarded: number;
  primaryLabel: string;
  onContinue: () => void;
}

/** Welcome Grains celebration + ways to earn more. */
export default function GrainsStep({ name, awarded, primaryLabel, onContinue }: GrainsStepProps) {
  return (
    <StepLayout
      footer={
        <Button variant="main" onClick={onContinue} className="w-full">
          {primaryLabel}
        </Button>
      }
    >
      <div className="flex flex-col items-center pt-10 text-center">
        {awarded > 0 ? (
          <span className="animate-pop flex h-32 w-32 flex-col items-center justify-center rounded-full bg-ds-accent text-ds-onaccent shadow-[0_10px_30px_rgba(163,75,26,0.35)]">
            <span className="font-display text-[42px] font-extrabold leading-none tabular-nums">
              +{awarded}
            </span>
            <span className="mt-1 text-xs font-extrabold uppercase tracking-wider">Grains</span>
          </span>
        ) : (
          <span className="animate-pop flex h-32 w-32 items-center justify-center rounded-full bg-ds-oksoft text-ds-ok">
            <CheckCircle size={64} weight="fill" aria-hidden />
          </span>
        )}
        <h1 className="font-display mt-6 text-[28px] font-extrabold leading-tight text-ds-text">
          Bienvenue, {name.trim() || 'toi'} !
        </h1>
        <p className="mt-2 text-[15px] text-ds-text2">
          {awarded > 0
            ? 'Tes Grains de bienvenue sont dans ton solde.'
            : 'Ton profil est prêt.'}
        </p>
      </div>

      <p className="mb-2.5 mt-8 text-xs font-extrabold uppercase tracking-wider text-ds-text2">
        Pour gagner des Grains
      </p>
      <ul className="flex flex-col gap-2">
        {NEXT_MISSIONS.map(({ icon: MissionIcon, text }) => (
          <li
            key={text}
            className="flex items-center gap-3 rounded-2xl border border-ds-line bg-ds-surface px-3.5 py-3"
          >
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-ds-accentsoft text-ds-accenttext">
              <MissionIcon size={17} aria-hidden />
            </span>
            <span className="text-sm font-bold text-ds-text">{text}</span>
          </li>
        ))}
      </ul>
    </StepLayout>
  );
}
