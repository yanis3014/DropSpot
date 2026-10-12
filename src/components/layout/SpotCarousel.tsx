'use client';

import Link from 'next/link';
import {
  CaretRight,
  Coffee as CoffeeIcon,
  Heart as HeartIcon,
  MapPin,
} from '@phosphor-icons/react';
import { preferenceById, PreferenceId } from '@/lib/preferences';
import { Place } from '@/lib/api/places';
import { CheckIn } from '@/lib/api/checkins';

interface SpotCarouselProps {
  places: Place[];
  placesLoading?: boolean;
  vibes: Record<string, CheckIn>;
  savedIds: string[];
  onToggleSave: (placeId: string) => void;
  onOpenPlace: (place: Place) => void;
}

/** Couleur de la pastille d'affluence (vert = calme, jaune = animé, rouge = blindé, gris = inconnu). */
function getCrowdColor(crowdLevel: CheckIn['crowd_level'] | undefined): string {
  switch (crowdLevel) {
    case 'quiet':
      return 'bg-green-400';
    case 'moderate':
      return 'bg-yellow-400';
    case 'full':
      return 'bg-red-400';
    default:
      return 'bg-gray-400';
  }
}

/** Tag catégorie affiché sur la carte (icône emoji + libellé). */
function getTag(place: Place): { label: string; emoji: string } | null {
  const first = place.categories?.[0];
  if (!first) return null;
  const pref = preferenceById[first as PreferenceId];
  if (pref) return { label: pref.label, emoji: pref.emoji };
  if (place.category) return { label: place.category, emoji: '' };
  return null;
}

export default function SpotCarousel({
  places,
  placesLoading = false,
  vibes,
  savedIds,
  onToggleSave,
  onOpenPlace,
}: SpotCarouselProps) {
  return (
    <section className="mb-6">
      <div className="px-5 mb-4 flex justify-between items-end">
        <h2 className="text-xl font-bold text-brand-dark">Spots tendances</h2>
      </div>

      {placesLoading ? (
        <div className="flex gap-4 px-5 pb-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-[260px] h-[230px] flex-shrink-0 rounded-3xl bg-brand-espresso/[0.04] animate-pulse"
            />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div className="mx-5 border border-dashed border-gray-300 rounded-2xl p-8 flex flex-col items-center justify-center text-center bg-white/50">
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3 text-gray-400">
            <CoffeeIcon size={24} />
          </div>
          <h3 className="font-semibold text-brand-dark mb-1">
            Aucun spot pour l'instant
          </h3>
          <p className="text-sm text-gray-500">
            Nous préparons une sélection des meilleurs cafés de ta ville.
          </p>
        </div>
      ) : (
        <div className="flex overflow-x-auto scrollbar-hide scroll-pl-5 snap-x snap-mandatory pb-6 gap-4">
          <div className="w-5 shrink-0" aria-hidden />
          {places.map((place) => {
            const crowdLevel = vibes[place.id]?.crowd_level;
            const tag = getTag(place);
            const isLiked = savedIds.includes(place.id);

            return (
              <div
                key={place.id}
                onClick={() => onOpenPlace(place)}
                className="snap-start shrink-0 w-[260px] bg-white rounded-3xl overflow-hidden shadow-card relative cursor-pointer transform transition hover:-translate-y-1"
              >
                {/* Image */}
                <div className="h-[140px] w-full relative bg-gray-200">
                  {place.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={place.image_url}
                      alt={place.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <CoffeeIcon
                        size={28}
                        weight="duotone"
                        className="text-white/40"
                      />
                    </div>
                  )}
                  {/* Overlay gradient */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />

                  {/* Badge SPOT */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className="bg-white/90 backdrop-blur-sm text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm text-gray-800">
                      <MapPin size={10} weight="fill" className="text-brand-green" />
                      SPOT
                    </span>
                  </div>

                  {/* Pastille d'affluence + favori */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${getCrowdColor(crowdLevel)}`}
                    />
                    <button
                      type="button"
                      aria-label={
                        isLiked ? 'Retirer des favoris' : 'Ajouter aux favoris'
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleSave(place.id);
                      }}
                      className={`w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-sm transition hover:scale-110 active:scale-125 ${
                        isLiked ? 'text-red-400' : 'text-gray-400'
                      }`}
                    >
                      <HeartIcon
                        size={18}
                        weight={isLiked ? 'fill' : 'regular'}
                      />
                    </button>
                  </div>
                </div>

                {/* Contenu texte */}
                <div className="p-4">
                  <h3 className="font-bold text-[17px] mb-1 truncate text-brand-dark">
                    {place.name}
                  </h3>
                  <div className="flex items-center text-gray-500 text-xs font-medium">
                    <MapPin size={11} className="mr-1 text-gray-400 flex-shrink-0" />
                    <p className="truncate">
                      {place.address ?? place.city ?? 'Adresse non spécifiée'}
                    </p>
                  </div>
                  {tag && (
                    <div className="mt-3 flex gap-2">
                      <span className="text-[11px] font-semibold text-brand-green bg-brand-greenlight px-2 py-0.5 rounded flex items-center gap-1">
                        {tag.emoji && <span>{tag.emoji}</span>}
                        {tag.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div className="w-4 shrink-0" aria-hidden />
        </div>
      )}

      <div className="px-5 mt-[-10px]">
        <Link
          href="/map"
          className="inline-flex items-center gap-1 text-brand-green text-sm font-medium hover:underline"
        >
          Voir tous les spots <CaretRight size={12} weight="bold" />
        </Link>
      </div>
    </section>
  );
}
