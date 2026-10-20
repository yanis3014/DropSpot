'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Coffee,
  WifiHigh,
  Plugs,
  SpeakerHigh,
  Laptop,
  SunDim,
  Leaf,
  MapPin,
  NavigationArrow,
  Lightning,
} from '@phosphor-icons/react';
import FavoriteButton from '@/components/places/FavoriteButton';
import CheckInModal from '@/components/spots/CheckInModal';
import TrophyModal from '@/components/places/TrophyModal';
import TrophyBadge, { mockTrophyForPlace } from '@/components/places/TrophyBadge';
import { Place } from '@/lib/api/places';
import { CheckIn, crowdConfig } from '@/lib/api/checkins';
import { getPlaceTopTrophy, type PlaceTrophy } from '@/lib/api/endorsements';
import {
  markTrophyPromptShown,
  shouldShowTrophyPrompt,
} from '@/lib/trophyPrompt';
import { formatAddress, openDirections } from '@/lib/utils/directions';
import {
  laptopLabel,
  noiseLabel,
  wifiLabel,
} from '@/lib/placeAmenities';
import {
  groupPlaceMedia,
  PLACE_MEDIA_TABS,
  type PlaceMedia,
  type PlaceMediaCategory,
} from '@/lib/api/placeMedia';

export interface PlaceDetailViewProps {
  place: Place;
  media?: PlaceMedia[];
  vibe?: CheckIn | null;
  isAuthenticated: boolean;
  isSaved: boolean;
  onToggleSave: (placeId: string) => void | Promise<void>;
  onCheckedIn?: () => void;
  /** Fallback si l’historique navigateur est vide (ex. lien direct). */
  backHref?: string;
}

function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

export default function PlaceDetailView({
  place,
  media = [],
  vibe,
  isAuthenticated,
  isSaved,
  onToggleSave,
  onCheckedIn,
  backHref = '/map',
}: PlaceDetailViewProps) {
  const router = useRouter();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [trophy, setTrophy] = useState<PlaceTrophy | null>(null);
  const [trophyPlace, setTrophyPlace] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] =
    useState<PlaceMediaCategory>('venue');
  const [slideIndex, setSlideIndex] = useState(0);
  const galleryRef = useRef<HTMLDivElement>(null);

  const grouped = useMemo(() => groupPlaceMedia(media), [media]);

  const availableTabs = useMemo(
    () =>
      PLACE_MEDIA_TABS.filter((tab) => grouped[tab.category].length > 0),
    [grouped]
  );

  // Fallback cover si aucune entrée place_media
  const fallbackUrls = useMemo(() => {
    if (media.length > 0) return [] as string[];
    return place.image_url ? [place.image_url] : [];
  }, [media.length, place.image_url]);

  const galleryUrls = useMemo(() => {
    if (availableTabs.length === 0) return fallbackUrls;
    return grouped[activeCategory].map((m) => m.url);
  }, [availableTabs.length, grouped, activeCategory, fallbackUrls]);

  useEffect(() => {
    getPlaceTopTrophy(place.id).then(setTrophy);
  }, [place.id]);

  // Onglet initial = première catégorie non vide
  useEffect(() => {
    if (availableTabs.length === 0) return;
    if (!availableTabs.some((t) => t.category === activeCategory)) {
      setActiveCategory(availableTabs[0].category);
    }
  }, [availableTabs, activeCategory]);

  useEffect(() => {
    setSlideIndex(0);
    galleryRef.current?.scrollTo({ left: 0 });
  }, [activeCategory, place.id]);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  const address = formatAddress(place);
  const crowd = vibe ? crowdConfig[vibe.crowd_level] : null;

  const features = [
    place.wifi_speed && {
      icon: WifiHigh,
      label: `Wi-Fi ${wifiLabel(place.wifi_speed)}`,
    },
    place.has_plugs && { icon: Plugs, label: 'Prises dispo' },
    place.noise_level && {
      icon: SpeakerHigh,
      label: noiseLabel(place.noise_level),
    },
    place.laptop_policy && {
      icon: Laptop,
      label: laptopLabel(place.laptop_policy),
    },
    place.has_terrace && { icon: SunDim, label: 'Terrasse' },
    place.is_vegan && { icon: Leaf, label: 'Vegan' },
  ].filter(Boolean) as { icon: typeof WifiHigh; label: string }[];

  const onGalleryScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const w = el.clientWidth || 1;
    setSlideIndex(Math.round(el.scrollLeft / w));
  };

  const scrollToSlide = (i: number) => {
    setSlideIndex(i);
    const track = galleryRef.current;
    if (track) {
      track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
    }
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-ds-bg">
      {/* Galerie / carrousel */}
      <div className="relative flex-shrink-0 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
        <div
          ref={galleryRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-[42vh] min-h-[220px] max-h-[360px]"
          onScroll={onGalleryScroll}
          aria-label="Galerie photos"
        >
          {galleryUrls.length > 0 ? (
            galleryUrls.map((url, i) => (
              <div
                key={`${url}-${i}`}
                className="relative w-full min-w-full h-full snap-center flex-shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`${place.name} — photo ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              </div>
            ))
          ) : (
            <div className="w-full min-w-full h-full flex items-center justify-center snap-center">
              <Coffee size={48} weight="duotone" className="text-white/30" />
            </div>
          )}
        </div>

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ds-bg via-transparent to-black/30" />

        <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className="w-10 h-10 flex items-center justify-center bg-ds-surface/90 backdrop-blur-sm rounded-full shadow-md hover:bg-ds-surface active:scale-95 transition-all"
          >
            <ArrowLeft size={20} weight="bold" className="text-ds-text" />
          </button>
          <FavoriteButton
            placeId={place.id}
            isSaved={isSaved}
            onToggle={onToggleSave}
            size={18}
            className="w-10 h-10 shadow-md"
          />
        </div>

        {galleryUrls.length > 1 && (
          <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5">
            {galleryUrls.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === slideIndex
                    ? 'w-5 bg-white'
                    : 'w-1.5 bg-white/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="flex-1 px-5 pt-1 pb-36 -mt-6 relative">
        <h1 className="text-2xl font-extrabold text-ds-text tracking-tight mb-2">
          {place.name}
        </h1>

        <div className="mb-3">
          <TrophyBadge
            trophy={trophy ?? mockTrophyForPlace(place.id)}
            size="md"
          />
        </div>

        {address && (
          <p className="flex items-start gap-1.5 text-sm text-ds-text2 mb-4">
            <MapPin
              size={16}
              weight="fill"
              className="text-ds-accent flex-shrink-0 mt-0.5"
            />
            {address}
          </p>
        )}

        {/* Onglets catégories photos */}
        {availableTabs.length > 0 && (
          <div className="mb-5 -mx-5 px-5">
            <div
              className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
              role="tablist"
              aria-label="Catégories photos"
            >
              {availableTabs.map((tab) => {
                const active = tab.category === activeCategory;
                const count = grouped[tab.category].length;
                return (
                  <button
                    key={tab.category}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveCategory(tab.category)}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold border transition-all active:scale-95 ${
                      active
                        ? 'bg-ds-pin text-white border-ds-pin'
                        : 'bg-ds-surface text-ds-text border-ds-text2/15'
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`ml-1.5 tabular-nums ${
                        active ? 'text-white/70' : 'text-ds-text2'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Miniatures horizontales de la catégorie active */}
            {galleryUrls.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-1">
                {galleryUrls.map((url, i) => (
                  <button
                    key={`thumb-${i}`}
                    type="button"
                    onClick={() => scrollToSlide(i)}
                    className={`relative shrink-0 w-16 h-16 rounded-xl overflow-hidden snap-start border-2 transition-all ${
                      i === slideIndex
                        ? 'border-ds-ok'
                        : 'border-transparent opacity-80'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {crowd && vibe && (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 mb-4 ${crowd.classes}`}
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
              </span>
              <span className="text-sm font-bold">
                {crowd.emoji} {crowd.label} en ce moment
              </span>
            </div>
            <span className="text-[11px] font-medium opacity-80">
              Wi-Fi {vibe.wifi_speed === 'good' ? '🚀' : '🐌'} ·{' '}
              {timeAgo(vibe.created_at)}
            </span>
          </div>
        )}

        {features.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-5">
            {features.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-ds-surface text-ds-text rounded-full border border-ds-text2/10 shadow-sm"
              >
                <Icon size={14} weight="duotone" className="text-ds-text2" />
                {label}
              </span>
            ))}
          </div>
        )}

        <h2 className="text-sm font-bold uppercase tracking-wider text-ds-text2 mb-2">
          L&apos;histoire du spot
        </h2>
        {place.description ? (
          <p className="text-sm text-ds-text/90 leading-relaxed whitespace-pre-line">
            {place.description}
          </p>
        ) : (
          <p className="text-sm text-ds-text2/70 italic">
            L&apos;équipe prépare la présentation de ce café. Reviens bientôt !
          </p>
        )}

        {place.opening_hours && (
          <div className="mt-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-ds-text2 mb-2">
              Horaires
            </h2>
            <p className="text-sm text-ds-text/90 leading-relaxed">
              {place.opening_hours}
            </p>
          </div>
        )}
      </div>

      {/* Actions sticky au-dessus de la BottomNav */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 mx-auto w-full max-w-md px-4 pb-2">
        <div className="flex gap-2 rounded-2xl bg-ds-surface/95 backdrop-blur-md border border-ds-text2/10 p-3 shadow-xl">
          <button
            type="button"
            onClick={() => openDirections(place)}
            className="flex-1 flex items-center justify-center gap-2 bg-ds-pin text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-ds-pin/90 active:scale-[0.98] transition-all"
          >
            <NavigationArrow size={20} weight="fill" />
            S&apos;y rendre
          </button>
          <button
            type="button"
            onClick={() => setShowCheckIn(true)}
            className="flex items-center justify-center gap-2 bg-ds-ok/10 text-ds-ok font-bold px-5 py-3.5 rounded-xl hover:bg-ds-ok/20 active:scale-[0.98] transition-all"
          >
            <Lightning size={20} weight="fill" />
            Checker
          </button>
        </div>
      </div>

      {showCheckIn && (
        <CheckInModal
          place={{ id: place.id, name: place.name, image_url: place.image_url }}
          isAuthenticated={isAuthenticated}
          onClose={() => setShowCheckIn(false)}
          onSubmitted={onCheckedIn}
          onSuccessDismiss={(p) => {
            if (isAuthenticated && shouldShowTrophyPrompt()) {
              markTrophyPromptShown();
              setTrophyPlace(p);
            }
          }}
        />
      )}

      {trophyPlace && (
        <TrophyModal
          place={trophyPlace}
          onClose={() => setTrophyPlace(null)}
          onVoted={() => {
            setToast('Merci ! 🎉');
            getPlaceTopTrophy(place.id).then(setTrophy);
            window.setTimeout(() => setToast(null), 2800);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-36 left-1/2 z-[80] -translate-x-1/2 rounded-2xl bg-ds-pin text-white px-4 py-3 text-sm font-bold shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
