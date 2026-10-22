'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Info, Plus, UsersThree } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import Chip from '@/components/ui/Chip';
import SpecRow from '@/components/pro/SpecRow';
import ProEmptyState from '@/components/pro/ProEmptyState';
import { SPEC_ICONS } from '@/components/places/specIcons';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { declareSpec, getPlaceDeclarations, getPlaceSpecs } from '@/lib/api/specs';
import {
  CONSENSUS_THRESHOLD,
  filledPips,
  formatLastConfirmationHint,
  proRowStatus,
  votesLabel,
} from '@/app/(pro)/dashboard-pro/lib/specificites/aggregate';
import { SPECS, sortSpecs, specLabel, type PlaceSpec, type SpecId } from '@/lib/specs';
import { cn } from '@/lib/cn';

type FilterId = 'all' | 'confirmed' | 'pending' | 'contested';

type Declarations = Partial<Record<SpecId, boolean>>;

function rowHint(spec: PlaceSpec, declared: boolean | undefined): string {
  const parts: string[] = [];
  if (declared === true) parts.push('Annoncé par ton café');
  if (declared === false) parts.push('Tu as indiqué que non');
  parts.push(
    spec.last_vote_at
      ? formatLastConfirmationHint(spec.last_vote_at)
      : 'Pas encore de vote sur place'
  );
  return parts.join(' · ');
}

async function fetchTeamSpecs(
  placeId: string
): Promise<{ rows: PlaceSpec[]; declarations: Declarations }> {
  const [rows, declarations] = await Promise.all([
    getPlaceSpecs(placeId),
    getPlaceDeclarations(placeId),
  ]);
  return { rows, declarations };
}

export default function SpecificitesClient() {
  const { activePlace, activeMemberRole, loading: placeLoading } = useActivePlace();
  const [rows, setRows] = useState<PlaceSpec[]>([]);
  const [declarations, setDeclarations] = useState<Declarations>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>('all');
  const [loadedPlaceId, setLoadedPlaceId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [busySpec, setBusySpec] = useState<SpecId | null>(null);
  const canDeclare = activeMemberRole === 'owner' || activeMemberRole === 'manager';

  const apply = useCallback(
    (placeId: string, next: { rows: PlaceSpec[]; declarations: Declarations }) => {
      setRows(sortSpecs(next.rows));
      setDeclarations(next.declarations);
      setLoadedPlaceId(placeId);
    },
    []
  );

  useEffect(() => {
    if (!activePlace) return;
    const placeId = activePlace.id;
    let cancelled = false;
    fetchTeamSpecs(placeId)
      .then((next) => {
        if (cancelled) return;
        apply(placeId, next);
        setError(null);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Impossible de charger les spécificités.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activePlace, apply]);

  const handleDeclare = async (spec: SpecId, value: boolean | null) => {
    if (!activePlace) return;
    setBusySpec(spec);
    setError(null);
    try {
      const result = await declareSpec(activePlace.id, spec, value);
      if (!result.ok) {
        setError(
          result.error === 'forbidden'
            ? 'Seuls le gérant et les responsables peuvent modifier les infos du café.'
            : 'Impossible d’enregistrer. Réessaie.'
        );
        return;
      }
      setPicking(false);
      apply(activePlace.id, await fetchTeamSpecs(activePlace.id));
    } catch (err) {
      console.error(err);
      setError('Impossible d’enregistrer. Réessaie.');
    } finally {
      setBusySpec(null);
    }
  };

  const counts = useMemo(
    () => ({
      all: rows.length,
      confirmed: rows.filter((r) => proRowStatus(r.status) === 'confirmed').length,
      pending: rows.filter((r) => proRowStatus(r.status) === 'pending').length,
      contested: rows.filter((r) => proRowStatus(r.status) === 'contested').length,
    }),
    [rows]
  );

  const visible = useMemo(
    () =>
      filter === 'all' ? rows : rows.filter((r) => proRowStatus(r.status) === filter),
    [rows, filter]
  );

  // Specs the café can still announce.
  const proposable = useMemo(
    () => SPECS.filter((s) => declarations[s.id] === undefined),
    [declarations]
  );

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
            {activePlace.name} · ce que tu annonces, ce que les clients confirment
          </p>
        </div>
        {canDeclare ? (
          <Button
            variant="main"
            className="h-11 rounded-xl px-[18px] text-[15px]"
            disabled={proposable.length === 0}
            onClick={() => setPicking((v) => !v)}
          >
            <Plus className="h-5 w-5" weight="bold" aria-hidden />
            Annoncer une info
          </Button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex flex-col gap-3 rounded-2xl bg-ds-surface2 px-[18px] py-3.5 sm:flex-row sm:items-center sm:gap-3.5">
          <UsersThree
            className="h-5 w-5 shrink-0 text-ds-text2"
            weight="bold"
            aria-hidden
          />
          <p className="m-0 flex-1 text-[15px] leading-snug">
            Tu annonces ce que ton café propose. Les clients sur place répondent
            Oui ou Non : une info est confirmée à partir de {CONSENSUS_THRESHOLD} oui,
            contestée si les non l’emportent.
          </p>
        </div>

        {picking ? (
          <div className="flex flex-col gap-2.5 rounded-[18px] border border-ds-line bg-ds-surface p-4">
            <span className="text-sm font-bold">Ton café propose…</span>
            <div className="flex flex-wrap gap-2">
              {proposable.map((s) => (
                <Chip
                  key={s.id}
                  disabled={busySpec !== null}
                  onClick={() => void handleDeclare(s.id, true)}
                >
                  {s.label}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

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
          {counts.contested > 0 ? (
            <FilterChip
              label={`Contestées · ${counts.contested}`}
              active={filter === 'contested'}
              onClick={() => setFilter('contested')}
            />
          ) : null}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-[18px] border border-ds-line bg-ds-surface py-10">
            <ProEmptyState
              icon={<Info weight="bold" />}
              title="Aucune info pour l'instant"
              description={
                canDeclare
                  ? 'Annonce ce que ton café propose : les clients confirmeront sur place.'
                  : 'Les clients confirment sur place.'
              }
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
              <span>Votes sur place</span>
              <span>Statut</span>
              <span />
            </div>
            <ul className="m-0 list-none divide-y divide-ds-line p-0">
              {visible.map((row) => {
                const Icon = SPEC_ICONS[row.spec];
                const declared = declarations[row.spec];
                const status = proRowStatus(row.status);
                // Announced → can withdraw; confirmed by clients → can say it is wrong.
                const action = !canDeclare
                  ? null
                  : declared !== undefined
                    ? { label: 'Retirer', value: null }
                    : status === 'confirmed'
                      ? { label: 'Contester', value: false }
                      : null;
                return (
                  <li key={row.spec}>
                    <SpecRow
                      icon={<Icon weight="bold" aria-hidden />}
                      title={specLabel(row.spec)}
                      hint={rowHint(row, declared)}
                      filled={filledPips(row.yes_votes)}
                      total={CONSENSUS_THRESHOLD}
                      votesLabel={votesLabel(row)}
                      status={status}
                      actionLabel={action?.label}
                      onAction={
                        action && busySpec === null
                          ? () => void handleDeclare(row.spec, action.value)
                          : undefined
                      }
                    />
                  </li>
                );
              })}
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
