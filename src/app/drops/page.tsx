'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MagnifyingGlass,
  X,
  Sparkle,
  SlidersHorizontal,
  Check,
} from '@phosphor-icons/react';
import DropCard from '@/components/drops/DropCard';
import DropDetailModal from '@/components/drops/DropDetailModal';
import LoginModal from '@/components/auth/LoginModal';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getExploreDrops,
  Drop,
  formatCountdown,
  getDropTiming,
  type DropTiming,
  type DropTypeId,
} from '@/lib/api/drops';
import { dropMatchesFilter } from '@/lib/filters';

type TypeFilter = 'all' | DropTypeId;
type TimingFilter = 'all' | DropTiming;

const typeFilters: { id: TypeFilter; label: string }[] = [
  { id: 'all', label: 'Tous' },
  { id: 'promo', label: '⚡ Promos' },
  { id: 'sport', label: '🏃 Sport' },
  { id: 'event', label: '🎧 Events' },
];

const timingFilters: { id: TimingFilter; label: string }[] = [
  { id: 'all', label: 'Toutes' },
  { id: 'live', label: 'En cours' },
  { id: 'upcoming', label: 'À venir' },
  { id: 'ended', label: 'Terminés' },
];

function FiltersSheet({
  open,
  timingFilter,
  region,
  regions,
  onTimingChange,
  onRegionChange,
  onReset,
  onClose,
}: {
  open: boolean;
  timingFilter: TimingFilter;
  region: string;
  regions: string[];
  onTimingChange: (v: TimingFilter) => void;
  onRegionChange: (v: string) => void;
  onReset: () => void;
  onClose: () => void;
}) {
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
          {/* Timing */}
          <section>
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
            <section>
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

export default function DropsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [drops, setDrops] = useState<Drop[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [timingFilter, setTimingFilter] = useState<TimingFilter>('all');
  const [region, setRegion] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDrop, setSelectedDrop] = useState<Drop | null>(null);
  const [claimedDrops, setClaimedDrops] = useState<string[]>([]);
  const [showLogin, setShowLogin] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('dropspot_claims') ?? '[]');
      if (Array.isArray(stored)) setClaimedDrops(stored);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setDrops(await getExploreDrops());
      } catch (error) {
        console.error('Error loading drops:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (drops.length === 0) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [drops.length]);

  const regions = useMemo(() => {
    const set = new Set<string>();
    for (const d of drops) {
      const city = d.places?.city?.trim();
      if (city) set.add(city);
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [drops]);

  const secondaryActive =
    timingFilter !== 'all' || region !== 'all';
  const secondaryCount =
    (timingFilter !== 'all' ? 1 : 0) + (region !== 'all' ? 1 : 0);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return drops
      .filter((d) => dropMatchesFilter(d, typeFilter === 'all' ? null : typeFilter))
      .filter((d) => timingFilter === 'all' || getDropTiming(d, now) === timingFilter)
      .filter((d) => {
        if (region === 'all') return true;
        return (d.places?.city ?? '').trim() === region;
      })
      .filter(
        (d) =>
          !q ||
          [d.title, d.description, d.places?.name, d.places?.city, d.places?.address].some(
            (f) => f?.toLowerCase().includes(q)
          )
      )
      .sort((a, b) => {
        const rank = (d: Drop) => {
          const t = getDropTiming(d, now);
          return t === 'live' ? 0 : t === 'upcoming' ? 1 : 2;
        };
        const r = rank(a) - rank(b);
        if (r !== 0) return r;
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
      });
  }, [drops, typeFilter, timingFilter, region, searchQuery, now]);

  const handleClaim = (drop: Drop) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    setClaimedDrops((prev) => {
      const next = [...prev, drop.id];
      localStorage.setItem('dropspot_claims', JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="flex-1 pb-28">
      {/* Header */}
      <div className="px-5 pt-7 pb-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Retour"
          className="w-10 h-10 rounded-full bg-brand-surface border border-brand-mocha/10 flex items-center justify-center text-brand-espresso shadow-sm hover:shadow-md active:scale-95 transition-all flex-shrink-0"
        >
          <ArrowLeft size={18} weight="bold" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold text-brand-espresso tracking-tight">
            Drops
          </h1>
          <p className="text-sm text-brand-mocha mt-0.5">
            {loading
              ? 'Chargement…'
              : `${filtered.length} résultat${filtered.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* Search + filter trigger */}
      <div className="px-5 mb-4 flex gap-2.5">
        <div className="flex-1 flex items-center gap-3 bg-brand-surface rounded-2xl px-4 py-3.5 shadow-sm border border-brand-mocha/10 focus-within:border-brand-matcha/40 transition-all">
          <MagnifyingGlass size={18} weight="bold" className="text-brand-mocha flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-brand-espresso placeholder:text-brand-mocha/45"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Effacer"
              className="text-brand-mocha/50 hover:text-brand-espresso"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Ouvrir les filtres"
          className={`relative w-[52px] flex-shrink-0 rounded-2xl border flex items-center justify-center transition-all active:scale-95 ${
            secondaryActive
              ? 'bg-brand-matcha text-white border-brand-matcha shadow-md shadow-brand-matcha/25'
              : 'bg-brand-surface text-brand-espresso border-brand-mocha/10 shadow-sm'
          }`}
        >
          <SlidersHorizontal size={20} weight="bold" />
          {secondaryCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-ink text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-brand-oat">
              {secondaryCount}
            </span>
          )}
        </button>
      </div>

      {/* Single category bar */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 mb-5">
        {typeFilters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTypeFilter(f.id)}
            className={`flex-shrink-0 px-4 py-2.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              typeFilter === f.id
                ? 'bg-brand-ink text-white shadow-md shadow-brand-ink/15'
                : 'bg-brand-surface text-brand-mocha border border-brand-mocha/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Active secondary chips (compact, dismissible) */}
      {secondaryActive && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide px-5 mb-4 -mt-2">
          {timingFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setTimingFilter('all')}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-brand-matcha/12 text-brand-matcha"
            >
              {timingFilters.find((t) => t.id === timingFilter)?.label}
              <X size={12} weight="bold" />
            </button>
          )}
          {region !== 'all' && (
            <button
              type="button"
              onClick={() => setRegion('all')}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-brand-matcha/12 text-brand-matcha"
            >
              {region}
              <X size={12} weight="bold" />
            </button>
          )}
        </div>
      )}

      {/* List */}
      <div className="px-5 space-y-4">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[120px] rounded-3xl bg-brand-surface animate-pulse border border-brand-mocha/5"
            />
          ))
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-brand-surface border border-dashed border-brand-mocha/15 px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-muted flex items-center justify-center mx-auto mb-4">
              <Sparkle size={28} weight="duotone" className="text-brand-mocha/45" />
            </div>
            <p className="font-bold text-brand-espresso mb-1">Aucun drop trouvé</p>
            <p className="text-sm text-brand-mocha max-w-[240px] mx-auto">
              Élargis ta recherche ou retire un filtre.
            </p>
          </div>
        ) : (
          filtered.map((drop) => (
            <DropCard
              key={drop.id}
              variant="list"
              drop={drop}
              isClaimed={claimedDrops.includes(drop.id)}
              now={now}
              onOpen={() => setSelectedDrop(drop)}
            />
          ))
        )}
      </div>

      <FiltersSheet
        open={showFilters}
        timingFilter={timingFilter}
        region={region}
        regions={regions}
        onTimingChange={setTimingFilter}
        onRegionChange={setRegion}
        onReset={() => {
          setTimingFilter('all');
          setRegion('all');
        }}
        onClose={() => setShowFilters(false)}
      />

      {selectedDrop && (
        <DropDetailModal
          drop={selectedDrop}
          countdown={formatCountdown(selectedDrop.end_time, now)}
          isAuthenticated={isAuthenticated}
          isClaimed={claimedDrops.includes(selectedDrop.id)}
          onClaim={() => handleClaim(selectedDrop)}
          onClose={() => setSelectedDrop(null)}
        />
      )}

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
