'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type UIEvent,
} from 'react';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import {
  sectionForIndex,
  type PlaceGallery,
} from '@/lib/placeGallery';

interface PhotoViewerProps {
  gallery: PlaceGallery;
  placeName: string;
  initialIndex: number;
  onClose: (lastIndex: number) => void;
}

/** Visionneuse plein écran : swipe, onglets par catégorie, miniatures. */
export default function PhotoViewer({
  gallery,
  placeName,
  initialIndex,
  onClose,
}: PhotoViewerProps) {
  const { photos, sections } = gallery;
  const [index, setIndex] = useState(initialIndex);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback(
    (i: number, behavior: ScrollBehavior = 'smooth') => {
      const next = Math.max(0, Math.min(photos.length - 1, i));
      setIndex(next);
      const track = trackRef.current;
      if (track) track.scrollTo({ left: next * track.clientWidth, behavior });
    },
    [photos.length]
  );

  // Ouverture seulement : place la piste sur la photo demandée, sans animation.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = initialIndex * track.clientWidth;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(index);
      else if (e.key === 'ArrowRight') goTo(index + 1);
      else if (e.key === 'ArrowLeft') goTo(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, index, onClose]);

  useEffect(() => {
    const thumb = thumbsRef.current?.children[index] as HTMLElement | undefined;
    thumb?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  }, [index]);

  const onScroll = (e: UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / (el.clientWidth || 1));
    if (i !== index) setIndex(i);
  };

  const current = sectionForIndex(gallery, index);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photos de ${placeName}`}
      className="fixed inset-0 z-[90] flex flex-col bg-[#14100D] text-[#F4EDE6]"
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={() => onClose(index)}
          aria-label="Fermer"
          className="w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 active:scale-95 transition-all"
        >
          <X size={20} weight="bold" />
        </button>
        <span className="text-sm font-bold tabular-nums">
          {index + 1} / {photos.length}
        </span>
        <span className="w-11" aria-hidden="true" />
      </div>

      {sections.length > 1 && (
        <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide">
          {sections.map((s) => {
            const active = current?.category === s.category;
            return (
              <button
                key={s.category}
                type="button"
                aria-pressed={active}
                onClick={() => goTo(s.firstIndex)}
                className={`shrink-0 h-9 px-3.5 rounded-full text-sm font-bold transition-colors ${
                  active
                    ? 'bg-[#F4EDE6] text-[#14100D]'
                    : 'bg-white/10 text-[#F4EDE6]'
                }`}
              >
                {s.label}
                <span className="ml-1.5 opacity-60 tabular-nums">{s.count}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div
          ref={trackRef}
          onScroll={onScroll}
          className="flex h-full overflow-x-auto snap-x snap-mandatory scrollbar-hide"
        >
          {photos.map((p, i) => (
            <div
              key={p.url}
              className="w-full min-w-full h-full snap-center flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.url}
                alt={`${placeName}, photo ${i + 1}`}
                loading={Math.abs(i - initialIndex) <= 1 ? 'eager' : 'lazy'}
                draggable={false}
                className="max-w-full max-h-full object-contain select-none"
              />
            </div>
          ))}
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={() => goTo(index - 1)}
            aria-label="Photo précédente"
            className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
        )}
        {index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => goTo(index + 1)}
            aria-label="Photo suivante"
            className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <CaretRight size={20} weight="bold" />
          </button>
        )}
      </div>

      {photos.length > 1 && (
        <div
          ref={thumbsRef}
          className="flex gap-2 px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] overflow-x-auto scrollbar-hide"
        >
          {photos.map((p, i) => (
            <button
              key={`thumb-${p.url}`}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Voir la photo ${i + 1}`}
              aria-current={i === index}
              className={`relative shrink-0 w-14 h-14 rounded-xl overflow-hidden border-2 transition-all ${
                i === index ? 'border-[#F4EDE6]' : 'border-transparent opacity-55'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
