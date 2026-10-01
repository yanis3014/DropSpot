'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import {
  addEndorsement,
  endorsementCategories,
  isEndorsementsUnavailableError,
  type EndorsementCategory,
} from '@/lib/api/endorsements';

const cardCopy: Record<
  EndorsementCategory,
  { emoji: string; title: string; hint: string }
> = {
  wifi: { emoji: '💻', title: 'Wi-Fi', hint: 'En béton' },
  coffee: { emoji: '☕', title: 'Café', hint: 'Super tasse' },
  comfort: { emoji: '🛋️', title: 'Confort', hint: 'Max chill' },
  food: { emoji: '🥐', title: 'Food', hint: 'Pépite gourmande' },
};

interface TrophyModalProps {
  place: { id: string; name: string };
  onClose: () => void;
  onVoted?: () => void;
}

export default function TrophyModal({ place, onClose, onVoted }: TrophyModalProps) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState<EndorsementCategory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleVote = async (category: EndorsementCategory) => {
    if (busy) return;
    setBusy(category);
    setError(null);
    try {
      await addEndorsement(place.id, category);
      onVoted?.();
      handleClose();
    } catch (err) {
      if (isEndorsementsUnavailableError(err)) {
        setError('Les trophées ne sont pas encore disponibles.');
      } else {
        setError("Oups, le vote n'est pas parti. Réessaie.");
      }
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out max-h-[88dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-mocha/25" />
        </div>

        <div className="px-5 pb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 text-left">
            <h2 className="text-xl font-extrabold text-brand-espresso tracking-tight">
              Un avis sur ce spot ?
            </h2>
            <p className="text-sm text-brand-mocha mt-1">
              Aide la commu en décernant un trophée (1 max).
            </p>
            <p className="text-xs text-brand-mocha/80 mt-1 truncate">{place.name}</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-surface border border-brand-mocha/10 shadow-sm active:scale-95"
          >
            <X size={18} weight="bold" className="text-brand-espresso" />
          </button>
        </div>

        <div className="px-5 pb-3 grid grid-cols-2 gap-2.5">
          {endorsementCategories.map((cat) => {
            const copy = cardCopy[cat.id];
            const loading = busy === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                disabled={!!busy}
                onClick={() => void handleVote(cat.id)}
                className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-brand-surface px-3 py-5 text-center transition-all active:scale-95 ${
                  loading
                    ? 'border-brand-matcha bg-brand-matcha/10'
                    : 'border-brand-mocha/10 hover:border-brand-matcha/35'
                } disabled:opacity-60`}
              >
                <span className="text-3xl leading-none">{copy.emoji}</span>
                <span className="text-sm font-extrabold text-brand-espresso">
                  {copy.title}
                </span>
                <span className="text-[11px] text-brand-mocha">{copy.hint}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="px-5 text-center text-xs font-medium text-brand-terracotta pb-2">
            {error}
          </p>
        )}

        <div className="px-5 pb-6 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="w-full py-3 text-sm font-semibold text-brand-mocha hover:text-brand-espresso transition-colors"
          >
            Passer
          </button>
        </div>
      </div>
    </div>
  );
}
