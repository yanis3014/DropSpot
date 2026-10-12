'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Check,
} from '@phosphor-icons/react';

type TypeFilter = 'all' | 'promo' | 'sport' | 'event' | 'remote' | 'bakery';
type TimingFilter = 'all' | 'live' | 'upcoming' | 'ended';

const typeFilters: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'promo', label: '⚡ Promos' },
  { id: 'sport', label: '🏃 Sport' },
  { id: 'event', label: '🎧 Events' },
  { id: 'remote', label: '💻 Remote Friendly' },
  { id: 'bakery', label: '🥐 Viennoiseries' },
];

const timingFilters: { id: TimingFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'live', label: 'En cours' },
  { id: 'upcoming', label: 'À venir' },
  { id: 'ended', label: 'Terminés' },
];

interface FilterSheetProps {
  open: boolean;
  categoryFilter: TypeFilter;
  timingFilter: TimingFilter;
  region: string;
  regions: string[];
  onCategoryChange: (v: TypeFilter) => void;
  onTimingChange: (v: TimingFilter) => void;
  onRegionChange: (v: string) => void;
  onReset: () => void;
  onClose: () => void;
}

export default function FilterSheet({
  open,
  categoryFilter,
  timingFilter,
  region,
  regions,
  onCategoryChange,
  onTimingChange,
  onRegionChange,
  onReset,
  onClose,
}: FilterSheetProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/45 backdrop-blur-sm transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filtres"
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl shadow-2xl transition-transform duration-200 ease-out max-h-[75dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3">
          <span className="w-10 h-1 rounded-full bg-brand-espresso/15" />
        </div>

        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <h2 className="text-lg font-extrabold text-brand-espresso tracking-tight">
            Filtres
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="w-9 h-9 rounded-full flex items-center justify-center text-brand-mocha hover:bg-brand-surface transition-colors"
          >
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">
          {/* Category */}
          <section>
            <p className="text-xs font-bold uppercase tracking-wider text-brand-mocha mb-3">
              Catégorie
            </p>
            <div className="flex flex-wrap gap-2">
              {typeFilters.map((f) => {
                const selected = categoryFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onCategoryChange(f.id)}
                    className={`flex items-center justify-between px-3 py-2 rounded-full text-sm font-semibold border transition-all ${
                      selected
                        ? 'bg-brand-ink text-white border-brand-ink'
                        : 'bg-brand-surface text-brand-espresso border-brand-mocha/10'
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Timing */}
          <section className="mt-4">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-mocha mb-3">
              Quand
            </p>
            <div className="grid grid-cols-2 gap-2">
              {timingFilters.map((f) => {
                const selected = timingFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onTimingChange(f.id)}
                    className={`flex items-center justify-between px-4 py-3 rounded-2xl text-sm font-semibold border transition-all active:scale-[0.98] ${
                      selected
                        ? 'bg-brand-matcha/12 text-brand-matcha border-brand-matcha/30'
                        : 'bg-brand-surface text-brand-espresso border-brand-mocha/10'
                    }`}
                  >
                    {f.label}
                    {selected && <Check size={16} weight="bold" />}
                  </button>
                );
              })}
            </div>
          </section>

          {/* City */}
          {regions.length > 0 && (
            <section className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-brand-mocha mb-3">
                Ville
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onRegionChange('all')}
                  className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-all ${
                    region === 'all'
                      ? 'bg-brand-ink text-white border-brand-ink'
                      : 'bg-brand-surface text-brand-espresso border-brand-mocha/10'
                  }`}
                >
                  Toutes
                </button>
                {regions.map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => onRegionChange(city)}
                    className={`px-3.5 py-2 rounded-full text-sm font-semibold border transition-all ${
                      region === city
                        ? 'bg-brand-ink text-white border-brand-ink'
                        : 'bg-brand-surface text-brand-espresso border-brand-mocha/10'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="p-5 pt-3 border-t border-brand-mocha/10 bg-brand-surface flex gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => {
              onReset();
            }}
            className="px-4 py-3.5 rounded-2xl text-sm font-semibold text-brand-mocha hover:text-brand-espresso hover:bg-brand-muted transition-colors"
          >
            Réinitialiser
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 bg-brand-ink text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}