'use client';

import { Coffee, Eye, Leaf, Moon, WifiHigh } from '@phosphor-icons/react';
import type { Place } from '@/lib/api/places';
import type { PlaceOpenStatusRow } from '@/lib/api/openingHours';
import { cafeOpenStatus, cafeFeatureIds } from '@/lib/cafePresentation';
import {
  formatSpecialDateLabel,
  type PhotoDraft,
  type PlaceFicheDraft,
  type SpecialHoursDraft,
} from '@/app/(pro)/dashboard-pro/lib/etablissement/draft';
import { cn } from '@/lib/cn';

const STATUS_LABEL = {
  open: 'Ouvert',
  closing_soon: 'Ferme bientôt',
  closed: 'Fermé',
} as const;

const STATUS_CLASS = {
  open: 'text-ds-ok font-bold',
  closing_soon: 'text-ds-accenttext font-bold',
  closed: 'text-ds-text2 font-bold',
} as const;

const FEATURE_META: Record<
  string,
  { label: string; Icon: typeof WifiHigh }
> = {
  wifi: { label: 'Wi-Fi', Icon: WifiHigh },
  matcha: { label: 'Matcha', Icon: Leaf },
  calme: { label: 'Calme', Icon: Moon },
};

function nextSpecialBanner(specials: SpecialHoursDraft[]): string | null {
  if (specials.length === 0) return null;
  const today = new Date();
  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);

  const upcoming = [...specials]
    .filter((s) => s.onDate >= todayKey)
    .sort((a, b) => a.onDate.localeCompare(b.onDate))[0];
  if (!upcoming) return null;

  const day = formatSpecialDateLabel(upcoming.onDate);
  if (upcoming.closed) {
    return `${day} : fermé`;
  }
  return `${day} : ouvert ${upcoming.opens ?? ''} – ${upcoming.closes ?? ''}`;
}

export interface EtablissementPreviewProps {
  place: Place;
  draft: PlaceFicheDraft;
  openStatus: PlaceOpenStatusRow | null;
  className?: string;
  /** Compact header for sheet. */
  showTitle?: boolean;
}

/**
 * Client-facing preview driven by draft values.
 * Open status comes from `place_open_status` (published hours).
 * Note / avis omitted — no rating columns in `places`.
 */
export default function EtablissementPreview({
  place,
  draft,
  openStatus,
  className,
  showTitle = true,
}: EtablissementPreviewProps) {
  const photos = draft.photos.filter((p) => !p.deleted);
  const cover: PhotoDraft | undefined = photos[0];
  const previewPlace: Place = {
    ...place,
    name: draft.name.trim() || place.name,
    address: draft.address.trim() || place.address,
    description: draft.description.trim() || place.description,
    image_url: cover?.url ?? place.image_url,
  };

  const meta = cafeOpenStatus(previewPlace, openStatus);
  const features = cafeFeatureIds(previewPlace);
  const specialBanner = nextSpecialBanner(draft.specials);
  const description = draft.description.trim();

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      {showTitle ? (
        <div className="flex items-center gap-1.5 text-[15px] font-bold text-ds-text">
          <Eye className="h-4 w-4" weight="bold" aria-hidden />
          Comme le voient les clients
        </div>
      ) : null}

      <div className="relative overflow-hidden rounded-[40px] bg-ds-bg shadow-[0_0_0_8px_var(--surface2),var(--shadow,0_6px_24px_rgba(58,34,18,.14))]">
        <div className="relative h-[180px] bg-ds-surface2">
          {cover?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-ds-text2">
              <Coffee className="h-10 w-10 opacity-40" weight="duotone" />
            </div>
          )}
        </div>

        <div className="relative -mt-[22px] flex flex-col gap-3 rounded-t-[22px] bg-ds-bg px-3.5 pb-5 pt-[18px]">
          <h3 className="font-display m-0 text-[23px] font-extrabold tracking-tight text-ds-text">
            {previewPlace.name}
          </h3>

          <p className="m-0 text-[13px] text-ds-text2">
            <span className={STATUS_CLASS[meta.status]}>
              {STATUS_LABEL[meta.status]}
            </span>
            {meta.statusDetail ? (
              <>
                {' '}
                · {meta.statusDetail}
              </>
            ) : null}
          </p>

          {description ? (
            <p className="m-0 text-[13px] leading-snug text-ds-text2">
              {description.length > 140
                ? `${description.slice(0, 140).trim()}…`
                : description}
            </p>
          ) : null}

          {features.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {features.map((id) => {
                const metaFeat = FEATURE_META[id];
                if (!metaFeat) return null;
                const Icon = metaFeat.Icon;
                return (
                  <span
                    key={id}
                    className="inline-flex h-6 items-center gap-1 rounded-[7px] bg-ds-surface2 px-1.5 text-xs font-semibold text-ds-text"
                  >
                    <Icon className="h-3.5 w-3.5" weight="bold" aria-hidden />
                    {metaFeat.label}
                  </span>
                );
              })}
            </div>
          ) : null}

          {specialBanner ? (
            <div className="rounded-xl bg-ds-warnsoft px-3 py-2.5 text-[13px] font-bold text-ds-warn">
              {specialBanner}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
