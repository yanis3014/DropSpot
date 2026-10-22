'use client';

import { ArrowRight, CoffeeBean, Lightning, MapPin, type Icon } from '@phosphor-icons/react';
import LogoMark from '@/components/brand/LogoMark';

const PROMISES: { icon: Icon; title: string; text: string }[] = [
  {
    icon: MapPin,
    title: 'La carte des bons cafés',
    text: 'Wi-Fi, matcha, terrasse : des infos confirmées par la communauté.',
  },
  {
    icon: Lightning,
    title: 'Les drops du jour',
    text: 'Runs, ateliers et offres éphémères près de toi.',
  },
  {
    icon: CoffeeBean,
    title: 'Des Grains à gagner',
    text: 'Contribue, confirme, et fais-toi récompenser.',
  },
];

interface WelcomeStepProps {
  onStart: () => void;
  onLogin: () => void;
}

/** First screen for a guest. Always dark, like the splash screen it follows. */
export default function WelcomeStep({ onStart, onLogin }: WelcomeStepProps) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[radial-gradient(120%_70%_at_50%_30%,#3d2719_0%,#14100d_70%)] text-[#f4ede6]">
      <div className="flex flex-1 flex-col justify-center gap-7 px-7 py-10">
        <div className="animate-step flex items-center gap-2.5">
          <LogoMark className="h-9 w-9 text-[#e3905a]" />
          <span className="font-display text-2xl font-extrabold tracking-[-0.04em]">
            dropspot
          </span>
        </div>
        <h1 className="animate-step font-display text-[34px] font-extrabold leading-[1.08]">
          Les cafés de Nice, et ce qui s’y passe aujourd’hui.
        </h1>
        <ul className="animate-step flex flex-col gap-4">
          {PROMISES.map(({ icon: PromiseIcon, title, text }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3d2719] text-[#f3b086]">
                <PromiseIcon size={20} weight="regular" aria-hidden />
              </span>
              <span>
                <span className="block text-[15px] font-extrabold">{title}</span>
                <span className="mt-0.5 block text-[13.5px] leading-snug text-[#bbad9f]">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-1.5 px-5 pb-7">
        <button
          type="button"
          onClick={onStart}
          className="inline-flex h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-[#e3905a] text-base font-extrabold text-[#1b0f08] active:scale-[0.98]"
        >
          Trouver mes cafés
          <ArrowRight size={18} weight="bold" aria-hidden />
        </button>
        <p className="mt-1.5 text-center text-[12.5px] text-[#bbad9f]">
          30 secondes, sans créer de compte.
        </p>
        <button
          type="button"
          onClick={onLogin}
          className="h-11 w-full text-sm font-bold text-[#f3b086]"
        >
          J’ai déjà un compte
        </button>
      </div>
    </div>
  );
}
