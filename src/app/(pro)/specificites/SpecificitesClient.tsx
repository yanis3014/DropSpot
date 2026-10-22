'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Coffee,
  Cookie,
  Couch,
  Info,
  Plus,
  UsersThree,
  WifiHigh,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import SpecRow from '@/components/pro/SpecRow';
import ProEmptyState from '@/components/pro/ProEmptyState';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { listPlaceSpecAggregates } from '@/app/(pro)/dashboard-pro/lib/api/specificites';
import {
  CONSENSUS_THRESHOLD,
  filledPips,
  formatLastConfirmationHint,
  votesLabel,
  type SpecCategoryAgg,
} from '@/app/(pro)/dashboard-pro/lib/specificites/aggregate';
import {
  endorsementCategories,
  type EndorsementCategory,
} from '@/lib/api/endorsements';
import { cn } from '@/lib/cn';

type FilterId = 'all' | 'confirmed' | 'pending';

const SOON = 'Bientôt disponible';

const CATEGORY_ICONS: Record<EndorsementCategory, typeof WifiHigh> = {
  wifi: WifiHigh,
  coffee: Coffee,
  comfort: Couch,
  food: Cookie,
};

function categoryTitle(category: string): string {
  const meta = endorsementCategories.find((c) => c.id === category);
  return meta?.trophyLabel ?? category;
}

function categoryIcon(category: string) {
  const id = category as EndorsementCategory;
  const Icon = CATEGORY_ICONS[id] ?? Info;
  return <Icon weight="bold" aria-hidden />;
}

export default function SpecificitesClient() {
  const { activePlace, loading: placeLoading } = useActivePlace();
  const [rows, setRows] = useState<SpecCategoryAgg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [loadedPlaceId, setLoadedPlaceId] = useState<string | null>(null);

  useEffect(() => {
    if (!activePlace) return;
    const placeId = activePlace.id;
    let cancelled = false;

    void (async () => {
      try {
        const next = await listPlaceSpecAggregates(placeId);
        if (cancelled) return;
        setRows(next);
        setLoadedPlaceId(placeId);
        setError(null);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Impossible de charger les spécificités.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePlace]);

  const counts = useMemo(() => {
    const confirmed = rows.filter((r) => r.status === 'confirmed').length;
    const pending = rows.filter((r) => r.status === 'pending').length;
    return {
      all: rows.length,
      confirmed,
      pending,
    };
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === 'confirmed') {
      return rows.filter((r) => r.status === 'confirmed');
    }
    if (filter === 'pending') {
      return rows.filter((r) => r.status === 'pending');
    }
    return rows;
  }, [rows, filter]);

  if (!placeLoading && !activePlace) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h1 className="font-display m-0 text-xl font-extrabold">Spécificités</h1>
        <p className="m-0 text-sm text-ds-text2">
          Aucun café actif. Choisis un établissement dans le menu.
        </p>
      </div>
    );
  }

  if (
    placeLoading ||
    loading ||
    !activePlace ||
    loadedPlaceId !== activePlace.id
  ) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-text">
      <header className="flex shrink-0 flex-col gap-3 border-b border-ds-line px-4 py-4 sm:h-[84px] sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-0">
        <div className="min-w-0">
          <h1 className="font-display m-0 text-[26px] font-extrabold tracking-tight">
            Spécificités
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            {activePlace.name} · ce que la communauté a confirmé
          </p>
        </div>
        <Button
          variant="main"
          className="h-11 rounded-xl px-[18px] text-[15px]"
          disabled
          title={SOON}
        >
          <Plus className="h-5 w-5" weight="bold" aria-hidden />
          Proposer une info
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-ds-surface2 px-[18px] py-3.5 sm:flex-row sm:items-center sm:gap-3.5">
          <UsersThree
            className="h-5 w-5 shrink-0 text-ds-text2"
            weight="bold"
            aria-hidden
          />
          <p className="m-0 flex-1 text-[15px] leading-snug">
            C&apos;est la communauté qui confirme. Tu peux proposer une info ou
            contester une info fausse, mais pas valider toi-même.
          </p>
          <span className="shrink-0 text-[13px] font-semibold text-ds-text2">
            Confirmée à partir de {CONSENSUS_THRESHOLD} clients
          </span>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl bg-ds-dangersoft px-4 py-3 text-sm font-semibold text-ds-danger"
          >
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <FilterChip
            label={`Toutes · ${counts.all}`}
            active={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterChip
            label={`Confirmées · ${counts.confirmed}`}
            active={filter === 'confirmed'}
            onClick={() => setFilter('confirmed')}
          />
          <FilterChip
            label={`En attente · ${counts.pending}`}
            active={filter === 'pending'}
            onClick={() => setFilter('pending')}
          />
          {/* Contestées : masqué — pas encore en base */}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[18px] border border-ds-line bg-ds-surface py-10">
            <ProEmptyState
              icon={<Info weight="bold" />}
              title="Aucune info confirmée pour l'instant"
              description="Les clients confirment sur place."
            />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[18px] border border-ds-line bg-ds-surface py-10">
            <p className="m-0 text-sm font-semibold text-ds-text2">
              Aucune info dans ce filtre.
            </p>
          </div>
        ) : (
          <section className="min-h-0 flex-1 overflow-auto rounded-[18px] border border-ds-line bg-ds-surface">
            <div className="hidden grid-cols-[44px_minmax(0,1fr)_170px_170px_130px] gap-3.5 border-b border-ds-line px-[18px] py-2.5 text-[13px] font-bold text-ds-text2 lg:grid">
              <span />
              <span>Info</span>
              <span>Confirmations</span>
              <span>Statut</span>
              <span />
            </div>
            <ul className="m-0 list-none divide-y divide-ds-line p-0">
              {visible.map((row) => (
                <li key={row.category}>
                  <SpecRow
                    icon={categoryIcon(row.category)}
                    title={categoryTitle(row.category)}
                    hint={formatLastConfirmationHint(row.lastConfirmedAt)}
                    filled={filledPips(row.voteCount)}
                    total={CONSENSUS_THRESHOLD}
                    votesLabel={votesLabel(row.voteCount)}
                    status={row.status}
                    actionDisabled
                    actionTitle={SOON}
                    actionLabel={
                      row.status === 'confirmed' ? 'Contester' : 'Retirer'
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Chip
      active={active}
      onClick={onClick}
      className={cn(!active && 'bg-ds-surface')}
    >
      {label}
    </Chip>
  );
}
