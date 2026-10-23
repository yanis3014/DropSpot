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
  CaretLeft,
  CaretRight,
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
  ShareNetwork,
  Images,
  Clock,
} from '@phosphor-icons/react';
import FavoriteButton from '@/components/places/FavoriteButton';
import PhotoViewer from '@/components/places/PhotoViewer';
import CheckInModal from '@/components/spots/CheckInModal';
import TrophyModal from '@/components/places/TrophyModal';
import TrophyBadge from '@/components/places/TrophyBadge';
import { Place } from '@/lib/api/places';
import { crowdConfig, type AggregatedVibe } from '@/lib/api/checkins';
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
import type { PlaceMedia } from '@/lib/api/placeMedia';
import { buildPlaceGallery, sectionForIndex } from '@/lib/placeGallery';
import { getPlaceOpenStatus } from '@/lib/api/openingHours';
import {
  cafeOpenStatus,
  type CafeOpenStatus,
} from '@/lib/cafePresentation';

export interface PlaceDetailViewProps {
  place: Place;
  media?: PlaceMedia[];
  vibe?: AggregatedVibe | null;
  isAuthenticated: boolean;
  isSaved: boolean;
  onToggleSave: (placeId: string) => void | Promise<void>;
  onCheckedIn?: () => void;
  /** Fallback si l’historique navigateur est vide (ex. lien direct). */
  backHref?: string;
}

const OPEN_STATUS_LABEL: Record<CafeOpenStatus, string> = {
  open: 'Ouvert',
  closing_soon: 'Ferme bientôt',
  closed: 'Fermé',
};

const OPEN_STATUS_CLASS: Record<CafeOpenStatus, string> = {
  open: 'text-ds-ok font-bold',
  closing_soon: 'text-ds-accenttext font-bold',
  closed: 'text-ds-text2 font-bold',
};

/** Au-delà, les points du carrousel deviennent illisibles : le compteur suffit. */
const MAX_CAROUSEL_DOTS = 8;

const ROUND_BUTTON =
  'w-11 h-11 flex items-center justify-center rounded-full bg-ds-surface text-ds-text shadow-[var(--shadow)] active:scale-95 transition-all';

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
  const [slideIndex, setSlideIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<number | null>(null);
  const [openMeta, setOpenMeta] = useState<{
    status: CafeOpenStatus;
    statusDetail?: string;
  } | null>(null);

  const gallery = useMemo(
    () => buildPlaceGallery(media, place.image_url),
    [media, place.image_url]
  );
  const photos = gallery.photos;
  const currentSection = sectionForIndex(gallery, slideIndex);

  useEffect(() => {
    getPlaceTopTrophy(place.id).then(setTrophy);
  }, [place.id]);

  useEffect(() => {
    let cancelled = false;
    void getPlaceOpenStatus(place.id).then((row) => {
      if (cancelled) return;
      setOpenMeta(cafeOpenStatus(place, row));
    });
    return () => {
      cancelled = true;
    };
  }, [place]);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    []
  );

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2800);
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast('Lien copié');
    } catch (err) {
      // Partage annulé par l'utilisateur : rien à signaler.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error(err);
    }
  };

  const address = formatAddress(place);
  const crowd = vibe ? crowdConfig[vibe.crowd_level] : null;

  const features = [
    place.wifi_speed && {
      icon: WifiHigh,
      label: 'Wi-Fi',
      value: wifiLabel(place.wifi_speed),
    },
    place.has_plugs && { icon: Plugs, label: 'Prises', value: 'Disponibles' },
    place.noise_level && {
      icon: SpeakerHigh,
      label: 'Ambiance',
      value: noiseLabel(place.noise_level),
    },
    place.laptop_policy && {
      icon: Laptop,
      label: 'Ordinateur',
      value: laptopLabel(place.laptop_policy),
    },
    place.has_terrace && { icon: SunDim, label: 'Terrasse', value: 'Oui' },
    place.is_vegan && { icon: Leaf, label: 'Vegan', value: 'Options vegan' },
  ].filter(Boolean) as { icon: typeof WifiHigh; label: string; value: string }[];

  const onGalleryScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
    if (i !== slideIndex) setSlideIndex(i);
  };

  const scrollToSlide = (i: number, behavior: ScrollBehavior = 'smooth') => {
    const next = Math.max(0, Math.min(photos.length - 1, i));
    setSlideIndex(next);
    const track = galleryRef.current;
    if (track) track.scrollTo({ left: next * track.clientWidth, behavior });
  };

  const closeViewer = (lastIndex: number) => {
    setViewerIndex(null);
    scrollToSlide(lastIndex, 'instant');
  };

  return (
    <div className="flex flex-col min-h-[100dvh] bg-ds-bg">
      {/* Carrousel photos plein écran */}
      <div className="relative flex-shrink-0 h-[58vh] min-h-[320px] max-h-[500px] bg-ds-surface2">
        <div
          ref={galleryRef}
          className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          onScroll={onGalleryScroll}
          aria-label="Photos du café"
        >
          {photos.length > 0 ? (
            photos.map((photo, i) => (
              <button
                key={photo.url}
                type="button"
                onClick={() => setViewerIndex(i)}
                aria-label={`Agrandir la photo ${i + 1}`}
                className="relative w-full min-w-full h-full snap-center flex-shrink-0 cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={`${place.name}, photo ${i + 1}`}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  fetchPriority={i === 0 ? 'high' : 'auto'}
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              </button>
            ))
          ) : (
            <div className="w-full min-w-full h-full flex items-center justify-center snap-center">
              <Coffee size={52} weight="duotone" className="text-ds-text2/50" />
            </div>
          )}
        </div>

        <div className="absolute top-[max(1rem,env(safe-area-inset-top))] left-4 right-4 z-10 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Retour"
            className={ROUND_BUTTON}
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label="Partager"
              className={ROUND_BUTTON}
            >
              <ShareNetwork size={19} weight="bold" />
            </button>
            <FavoriteButton
              placeId={place.id}
              isSaved={isSaved}
              onToggle={onToggleSave}
              size={19}
              className="w-11 h-11 !bg-ds-surface shadow-[var(--shadow)]"
            />
          </div>
        </div>

        {photos.length > 1 && (
          <>
            {slideIndex > 0 && (
              <button
                type="button"
                onClick={() => scrollToSlide(slideIndex - 1)}
                aria-label="Photo précédente"
                className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-ds-surface/90 text-ds-text shadow-md"
              >
                <CaretLeft size={18} weight="bold" />
              </button>
            )}
            {slideIndex < photos.length - 1 && (
              <button
                type="button"
                onClick={() => scrollToSlide(slideIndex + 1)}
                aria-label="Photo suivante"
                className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-ds-surface/90 text-ds-text shadow-md"
              >
                <CaretRight size={18} weight="bold" />
              </button>
            )}
          </>
        )}

        {photos.length > 1 && photos.length <= MAX_CAROUSEL_DOTS && (
          <div
            className="pointer-events-none absolute bottom-12 left-0 right-0 z-10 flex justify-center gap-1.5"
            aria-hidden="true"
          >
            {photos.map((photo, i) => (
              <span
                key={`dot-${photo.url}`}
                className={`h-1.5 rounded-full shadow-sm transition-all ${
                  i === slideIndex ? 'w-[18px] bg-white' : 'w-1.5 bg-white/55'
                }`}
              />
            ))}
          </div>
        )}

        {photos.length > 0 && (
          <button
            type="button"
            onClick={() => setViewerIndex(slideIndex)}
            className="absolute right-4 bottom-11 z-10 inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-[#14100D]/75 text-white text-[13px] font-bold backdrop-blur-sm"
          >
            <Images size={15} weight="bold" />
            {currentSection && gallery.sections.length > 1
              ? `${currentSection.label} · `
              : ''}
            <span className="tabular-nums">
              {slideIndex + 1} / {photos.length}
            </span>
          </button>
        )}
      </div>

      {/* Contenu, en feuille qui recouvre le bas de la photo */}
      <div className="relative flex-1 -mt-7 rounded-t-[26px] bg-ds-bg px-4 pt-6 pb-40 flex flex-col gap-5">
        <div className="flex flex-col gap-1.5 px-1">
          {place.city && (
            <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ds-accenttext">
              Café · {place.city}
            </span>
          )}
          <h1 className="font-display text-[30px] font-extrabold leading-[1.1] tracking-tight text-ds-text">
            {place.name}
          </h1>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] text-ds-text2 min-w-0">
              {openMeta ? (
                <>
                  <span className={OPEN_STATUS_CLASS[openMeta.status]}>
                    {OPEN_STATUS_LABEL[openMeta.status]}
                  </span>
                  {openMeta.statusDetail ? ` · ${openMeta.statusDetail}` : null}
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => openDirections(place)}
              className="shrink-0 inline-flex items-center gap-1 h-11 text-[15px] font-bold text-ds-accent"
            >
              <NavigationArrow size={18} weight="fill" />
              Itinéraire
            </button>
          </div>
        </div>

        {trophy && (
          <div className="px-1 -mt-2">
            <TrophyBadge trophy={trophy} size="md" />
          </div>
        )}

        {crowd && vibe && (
          <div
            className={`flex items-center justify-between gap-3 rounded-2xl px-4 py-3 ${crowd.classes}`}
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
              {timeAgo(vibe.latest_at)}
            </span>
          </div>
        )}

        {features.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {features.map(({ icon: Icon, label, value }) => (
              <div
                key={label}
                className="flex flex-col gap-1.5 p-3.5 rounded-[18px] bg-ds-surface border border-ds-line"
              >
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 flex items-center justify-center rounded-[10px] bg-ds-accentsoft text-ds-accenttext">
                    <Icon size={18} weight="bold" />
                  </span>
                  <span className="text-sm font-semibold text-ds-text2">
                    {label}
                  </span>
                </div>
                <span className="text-base font-bold text-ds-text">{value}</span>
              </div>
            ))}
          </div>
        )}

        {photos.length > 1 && (
          <section className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between px-1">
              <h2 className="font-display text-xl font-extrabold text-ds-text">
                Photos
              </h2>
              <button
                type="button"
                onClick={() => setViewerIndex(0)}
                className="h-11 text-[15px] font-bold text-ds-accent"
              >
                Tout voir ({photos.length})
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {gallery.sections.map((s) => (
                <button
                  key={s.category}
                  type="button"
                  onClick={() => setViewerIndex(s.firstIndex)}
                  className="flex flex-col gap-1.5 text-left active:scale-[0.98] transition-transform"
                >
                  <span className="block w-full aspect-square rounded-[14px] overflow-hidden bg-ds-surface2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photos[s.firstIndex].url}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </span>
                  <span className="text-sm font-bold text-ds-text leading-tight">
                    {s.label}
                  </span>
                  <span className="text-[13px] text-ds-text2 -mt-1">
                    {s.count} photo{s.count > 1 ? 's' : ''}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="flex flex-col gap-2 px-1">
          <h2 className="font-display text-xl font-extrabold text-ds-text">
            L&apos;histoire du spot
          </h2>
          {place.description ? (
            <p className="text-[15px] text-ds-text/90 leading-relaxed whitespace-pre-line">
              {place.description}
            </p>
          ) : (
            <p className="text-[15px] text-ds-text2 italic">
              L&apos;équipe prépare la présentation de ce café. Reviens bientôt !
            </p>
          )}
        </section>

        {(place.opening_hours || address) && (
          <section className="flex flex-col gap-3 p-4 rounded-[18px] bg-ds-surface border border-ds-line">
            {place.opening_hours && (
              <div className="flex items-start gap-2.5">
                <Clock size={18} weight="bold" className="text-ds-text2 mt-0.5 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-[15px] font-bold text-ds-text">Horaires</h2>
                  <p className="text-[15px] text-ds-text2 leading-relaxed whitespace-pre-line">
                    {place.opening_hours}
                  </p>
                </div>
              </div>
            )}
            {place.opening_hours && address && (
              <div className="h-px bg-ds-line" aria-hidden="true" />
            )}
            {address && (
              <button
                type="button"
                onClick={() => openDirections(place)}
                className="flex items-start gap-2.5 text-left"
              >
                <MapPin size={18} weight="fill" className="text-ds-accent mt-0.5 shrink-0" />
                <span className="text-[15px] text-ds-text">{address}</span>
              </button>
            )}
          </section>
        )}
      </div>

      {/* Actions sticky au-dessus de la BottomNav */}
      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 mx-auto w-full max-w-md px-4 pb-2">
        <div className="flex gap-2.5 rounded-2xl bg-ds-surface/95 backdrop-blur-md border border-ds-line p-3 shadow-xl">
          <button
            type="button"
            onClick={() => openDirections(place)}
            className="flex-1 flex items-center justify-center gap-2 h-[52px] bg-ds-accent text-ds-onaccent font-bold rounded-[14px] hover:opacity-95 active:scale-[0.98] transition-all"
          >
            <NavigationArrow size={20} weight="fill" />
            S&apos;y rendre
          </button>
          <button
            type="button"
            onClick={() => setShowCheckIn(true)}
            className="flex items-center justify-center gap-2 h-[52px] px-5 bg-ds-accentsoft text-ds-accenttext font-bold rounded-[14px] active:scale-[0.98] transition-all"
          >
            <Lightning size={20} weight="fill" />
            Checker
          </button>
        </div>
      </div>

      {viewerIndex !== null && photos.length > 0 && (
        <PhotoViewer
          gallery={gallery}
          placeName={place.name}
          initialIndex={viewerIndex}
          onClose={closeViewer}
        />
      )}

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
            showToast('Merci ! 🎉');
            getPlaceTopTrophy(place.id).then(setTrophy);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-40 left-1/2 z-[80] -translate-x-1/2 rounded-2xl bg-ds-pin text-ds-onpin px-4 py-3 text-sm font-bold shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
