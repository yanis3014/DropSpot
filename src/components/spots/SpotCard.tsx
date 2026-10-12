'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  MapPin,
  Coffee,
  Plugs,
  WifiHigh,
  SunDim,
  Leaf,
} from '@phosphor-icons/react';
import FavoriteButton from '@/components/places/FavoriteButton';
import { Place } from '@/lib/api/places';
import { PreferenceId, preferenceById } from '@/lib/preferences';

// Define a type for the icon components used (Phosphor icons)
type IconComponent = React.ComponentType<{
  size?: number;
  weight?: string;
  className?: string;
}>;

interface SpotCardProps {
  place: Place;
  isSaved: boolean;
  vibe?: {
    crowd_level: number;
  } | null;
  onToggleSave: (placeId: string) => void;
  onOpenPlace: () => void;
  matches?: PreferenceId[];
}

export default function SpotCard({
  place,
  isSaved,
  vibe,
  onToggleSave,
  onOpenPlace,
  matches = [],
}: SpotCardProps) {
  const [hovered, setHovered] = useState(false);

  // Determine which attributes to show (max 2)
  const attrs: {
    Icon: IconComponent;
    label: string;
    condition: boolean;
  }[] = [
    { Icon: Plugs as IconComponent, label: 'Prises', condition: Boolean(place.has_plugs) },
    { Icon: WifiHigh as IconComponent, label: 'WiFi', condition: Boolean(place.wifi_speed) },
    { Icon: SunDim as IconComponent, label: 'Terrasse', condition: Boolean(place.has_terrace) },
    { Icon: Leaf as IconComponent, label: 'Vegan', condition: Boolean(place.is_vegan) },
  ].filter((attr) => attr.condition);

  // Limit to first 2
  const displayedAttrs = attrs.slice(0, 2);

  // Determine crowd level vibe text and color
  const crowdConfig = {
    0: { label: 'Calme', emoji: '🟢', class: 'bg-brand-oat/20 text-brand-oat' },
    1: { label: 'Modéré', emoji: '🟡', class: 'bg-brand-matcha/20 text-brand-matcha' },
    2: { label: 'Animé', emoji: '🔴', class: 'bg-brand-terracotta/20 text-brand-terracotta' },
  };
  const vibeInfo = vibe ? crowdConfig[vibe.crowd_level as keyof typeof crowdConfig] : crowdConfig[0];

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onOpenPlace()}
      onClick={onOpenPlace}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`relative w-[240px] flex-shrink-0 snap-start bg-brand-surface rounded-2xl overflow-hidden shadow-sm border cursor-pointer active:scale-[0.97] transition-transform ${
        matches.length > 0
          ? 'border-brand-matcha/40 ring-1 ring-brand-matcha/20'
          : 'border-brand-mocha/5'
      } ${hovered ? 'shadow-md' : ''}`}
    >
      {/* Image placeholder */}
      <div className="relative h-24 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
        {place.image_url ? (
          <Image
            src={place.image_url}
            alt={place.name}
            fill
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Coffee size={28} weight="duotone" className="text-white/30" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Type icon and label (top-left) */}
        <span className="absolute top-2 left-2 flex items-center gap-1 bg-brand-surface/95 backdrop-blur-sm rounded-full px-2 py-0.5 shadow">
          <MapPin size={10} weight="fill" className="text-brand-mocha" />
          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-espresso">
            Spot
          </span>
        </span>

        {/* Crowd level badge (top-right) */}
        <span className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${vibeInfo.class}">
          {vibeInfo.emoji} {vibeInfo.label}
        </span>

        {/* Pour toi badge (bottom-left) */}
        {matches.length > 0 && (
          <span className="absolute bottom-2 left-2">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-matcha text-white">
              <span className="text-[8px]">✨</span> Pour toi
            </span>
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h4 className="text-sm font-bold text-brand-espresso truncate mb-1">
          {place.name}
        </h4>
        <div className="flex items-center gap-2 text-xs text-brand-mocha">
          <MapPin size={11} weight="fill" className="flex-shrink-0" />
          <span className="truncate max-w-[180px]">
            {place.address ?? place.city ?? 'Adresse non spécifiée'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {displayedAttrs.map(({ Icon, label }) => (
            <span
              key={label}
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 bg-brand-oat text-brand-mocha rounded-full`}
            >
              <Icon size={12} weight="duotone" />
              {label}
            </span>
          ))}
          {/* Add more attributes if needed */}
        </div>

        {/* Favorite button (top-right corner of card) */}
        <div className="absolute top-3 right-3">
          <FavoriteButton
            placeId={place.id}
            isSaved={isSaved}
            onToggle={onToggleSave}
            size={18}
            className=""
          />
        </div>
      </div>
    </div>
  );
}