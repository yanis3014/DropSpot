'use client';

import Link from 'next/link';
import { Check, Lightning } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import { formatDateTime, getDropTiming, type Drop } from '@/lib/api/drops';
import { formatDistance } from '@/lib/geo';
import { envieLabel, needLabel } from '@/lib/onboarding';
import type { Selection, SelectionItem } from '@/lib/onboardingSelection';
import StepLayout, { GhostAction } from './StepLayout';

interface SelectionStepProps {
  loading: boolean;
  selection: Selection | null;
  drop: Drop | null;
  /** True when distances come from the real position. */
  fromPosition: boolean;
  zoneLabel: string | null;
  primaryLabel: string;
  onPrimary: () => void;
  /** Guest only: "keep my selection" → account. */
  onKeep?: () => void;
}

function subtitle(fromPosition: boolean, zoneLabel: string | null): string {
  if (fromPosition) return 'Les plus proches de toi en premier.';
  if (zoneLabel) return `Autour de ${zoneLabel}, les meilleurs en premier.`;
  return 'Les meilleurs en premier.';
}

function SelectionCard({ item, showDistance }: { item: SelectionItem; showDistance: boolean }) {
  const { place } = item;
  const tags = [...item.envies.map(envieLabel), ...item.needs.map(needLabel)].slice(0, 3);
  const where =
    showDistance && item.distance != null
      ? `à ${formatDistance(item.distance)}`
      : place.address ?? place.city ?? '';

  return (
    <Link
      href={`/place/${place.id}`}
      className="flex items-center gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-3 no-underline active:scale-[0.99]"
    >
      {place.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={place.image_url}
          alt=""
          className="h-14 w-14 shrink-0 rounded-[14px] object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="font-display flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-ds-accentsoft text-[22px] font-extrabold text-ds-accenttext"
        >
          {place.name.charAt(0).toUpperCase()}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-extrabold text-ds-text">
          {place.name}
        </span>
        {where ? (
          <span className="mt-0.5 block truncate text-[12.5px] text-ds-text2">{where}</span>
        ) : null}
        {tags.length > 0 ? (
          <span className="mt-1.5 block truncate text-xs font-bold text-ds-accenttext">
            {tags.join(' · ')}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

function DropCard({ drop }: { drop: Drop }) {
  const live = getDropTiming(drop) === 'live';
  return (
    <Link
      href="/drops"
      className="mt-3.5 flex items-center gap-3 rounded-[18px] bg-ds-pin p-3.5 text-ds-onpin no-underline"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ds-accent text-ds-onaccent">
        <Lightning size={20} weight="fill" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-[11.5px] font-extrabold uppercase tracking-wider opacity-80">
          {live ? 'Drop en ce moment' : 'Drop pour toi'}
        </span>
        <span className="mt-0.5 block truncate text-[14.5px] font-extrabold">{drop.title}</span>
        <span className="block truncate text-[12.5px] opacity-75">
          {[drop.places?.name, live ? null : formatDateTime(drop.start_time)]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
    </Link>
  );
}

/** The payoff: a few cafés and a drop that fit the envies, before the map. */
export default function SelectionStep({
  loading,
  selection,
  drop,
  fromPosition,
  zoneLabel,
  primaryLabel,
  onPrimary,
  onKeep,
}: SelectionStepProps) {
  const count = selection?.matchCount ?? 0;
  const fallback = selection?.fallback ?? false;
  const title = loading
    ? 'On prépare ta sélection…'
    : !selection || selection.items.length === 0
      ? 'Ta carte est prête'
      : fallback
        ? 'Voici les cafés les plus proches'
        : `${count} café${count > 1 ? 's' : ''} ${count > 1 ? 'collent' : 'colle'} à tes envies`;
  const sub = fallback
    ? 'Aucun café ne coche encore tes envies : la communauté complète les infos chaque jour.'
    : subtitle(fromPosition, zoneLabel);

  return (
    <StepLayout
      footer={
        <>
          <Button variant="main" onClick={onPrimary} className="w-full">
            {primaryLabel}
          </Button>
          {onKeep ? (
            <GhostAction onClick={onKeep}>Garder ma sélection + 50 Grains offerts</GhostAction>
          ) : null}
        </>
      }
    >
      <div className="pt-6">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-ds-oksoft px-3 text-[12.5px] font-extrabold text-ds-ok">
          <Check size={14} weight="bold" aria-hidden />
          Ta sélection est prête
        </span>
        <h1 className="font-display mt-3 text-[28px] font-extrabold leading-tight text-ds-text">
          {title}
        </h1>
        {!loading ? (
          <p className="mt-2 text-[15px] leading-relaxed text-ds-text2">
            {selection && selection.items.length > 0
              ? sub
              : 'Tes envies sont enregistrées : les cafés qui y répondent passent en premier sur la carte.'}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-2.5">
        {loading
          ? Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="h-[82px] animate-pulse rounded-[18px] bg-ds-surface2"
              />
            ))
          : selection?.items.map((item) => (
              <SelectionCard
                key={item.place.id}
                item={item}
                showDistance={fromPosition}
              />
            ))}
      </div>

      {!loading && drop ? <DropCard drop={drop} /> : null}
    </StepLayout>
  );
}
