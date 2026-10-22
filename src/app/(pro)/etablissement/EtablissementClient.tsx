'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  Eye,
  Lock,
  Plus,
  Trash,
  X,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import PlanBadge from '@/components/pro/PlanBadge';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { useVendorPlan } from '@/hooks/useVendorPlan';
import {
  countUnpublishedChanges,
  DESCRIPTION_MAX,
  formatSpecialDateLabel,
  reorderPhotos,
  validateSpecial,
  validateWeekHours,
  WEEKDAY_LABELS,
  type DayHoursDraft,
  type PhotoDraft,
  type PlaceFicheDraft,
  type SpecialHoursDraft,
} from '@/app/(pro)/dashboard-pro/lib/etablissement/draft';
import {
  listPlaceOpeningHours,
  listPlaceSpecialHours,
  openingHoursToDraft,
  replacePlaceOpeningHours,
  replacePlaceSpecialHours,
  specialHoursToDraft,
} from '@/app/(pro)/dashboard-pro/lib/api/placeHours';
import {
  deletePlaceMedia,
  FREE_VENUE_PHOTO_MAX,
  listPlaceMedia,
  placeMediaErrorMessage,
  reorderPlaceMedia,
  uploadPlaceMedia,
} from '@/app/(pro)/dashboard-pro/lib/api/placePhotos';
import { updateVendorPlace } from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import {
  getPlaceOpenStatus,
  type PlaceOpenStatusRow,
} from '@/lib/api/openingHours';
import EtablissementPreview from '@/app/(pro)/etablissement/EtablissementPreview';
import type { Place } from '@/lib/api/places';

type FieldErrors = {
  name?: string;
  address?: string;
  description?: string;
  hours?: Record<number, string>;
  specials?: Record<string, string>;
  photos?: string;
  form?: string;
};

function cloneDraft(d: PlaceFicheDraft): PlaceFicheDraft {
  return {
    name: d.name,
    address: d.address,
    description: d.description,
    hours: d.hours.map((h) => ({
      ...h,
      slots: h.slots.map((s) => ({ ...s })),
    })),
    specials: d.specials.map((s) => ({ ...s })),
    photos: d.photos.map((p) => ({ ...p })),
  };
}

function buildDraftFromPlace(
  place: Place,
  hours: DayHoursDraft[],
  specials: SpecialHoursDraft[],
  photos: PhotoDraft[]
): PlaceFicheDraft {
  return {
    name: place.name ?? '',
    address: place.address ?? '',
    description: place.description ?? '',
    hours,
    specials,
    photos,
  };
}

function newSpecialKey(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function EtablissementClient() {
  const router = useRouter();
  const { activePlace, activeMemberRole, loading: placeLoading } =
    useActivePlace();
  const { hasPro } = useVendorPlan();
  const canEdit = activeMemberRole === 'owner';

  const [baseline, setBaseline] = useState<PlaceFicheDraft | null>(null);
  const [draft, setDraft] = useState<PlaceFicheDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [openStatus, setOpenStatus] = useState<PlaceOpenStatusRow | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedPlaceId, setLoadedPlaceId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activePlace) return;
    const place = activePlace;
    let cancelled = false;

    void (async () => {
      setLoading(true);
      setErrors({});
      try {
        const [hourRows, specialRows, mediaRows, status] = await Promise.all([
          listPlaceOpeningHours(place.id),
          listPlaceSpecialHours(place.id),
          listPlaceMedia(place.id),
          getPlaceOpenStatus(place.id),
        ]);
        if (cancelled) return;

        const venue = mediaRows
          .filter((m) => m.category === 'venue')
          .sort((a, b) => a.sort_order - b.sort_order)
          .map(
            (m): PhotoDraft => ({
              key: m.id,
              id: m.id,
              url: m.url,
            })
          );

        const next = buildDraftFromPlace(
          place,
          openingHoursToDraft(hourRows),
          specialHoursToDraft(specialRows),
          venue
        );
        setBaseline(cloneDraft(next));
        setDraft(cloneDraft(next));
        setOpenStatus(status);
        setLoadedPlaceId(place.id);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setErrors({ form: 'Impossible de charger la fiche.' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activePlace]);

  const dirtyCount = useMemo(() => {
    if (!baseline || !draft) return 0;
    return countUnpublishedChanges(baseline, draft);
  }, [baseline, draft]);

  const visiblePhotos = useMemo(
    () => (draft?.photos ?? []).filter((p) => !p.deleted),
    [draft]
  );

  const photoCap = hasPro ? 8 : FREE_VENUE_PHOTO_MAX;
  const atFreeCap = !hasPro && visiblePhotos.length >= FREE_VENUE_PHOTO_MAX;

  const updateDraft = (patch: Partial<PlaceFicheDraft>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const handleCancel = () => {
    if (!baseline) return;
    setDraft(cloneDraft(baseline));
    setErrors({});
  };

  const handlePublish = async () => {
    if (!draft || !baseline || !activePlace || !canEdit) return;

    const nextErrors: FieldErrors = {};
    if (!draft.name.trim()) nextErrors.name = 'Le nom est obligatoire.';
    if (!draft.address.trim()) nextErrors.address = 'L’adresse est obligatoire.';
    if (draft.description.length > DESCRIPTION_MAX) {
      nextErrors.description = `Maximum ${DESCRIPTION_MAX} caractères.`;
    }
    const hourErrs = validateWeekHours(draft.hours);
    if (Object.keys(hourErrs).length > 0) nextErrors.hours = hourErrs;

    const specialErrs: Record<string, string> = {};
    for (const s of draft.specials) {
      const err = validateSpecial(s);
      if (err) specialErrs[s.key] = err;
    }
    if (Object.keys(specialErrs).length > 0) nextErrors.specials = specialErrs;

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setPublishing(true);
    setErrors({});
    try {
      await updateVendorPlace(activePlace.id, {
        name: draft.name.trim(),
        address: draft.address.trim(),
        description: draft.description.trim() || null,
      });

      await replacePlaceOpeningHours(activePlace.id, draft.hours);
      await replacePlaceSpecialHours(activePlace.id, draft.specials);

      const toDelete = draft.photos.filter((p) => p.deleted && p.id);
      for (const photo of toDelete) {
        if (photo.id) await deletePlaceMedia(photo.id);
      }

      const kept: PhotoDraft[] = [];
      for (const photo of draft.photos) {
        if (photo.deleted) continue;
        if (photo.file) {
          const uploaded = await uploadPlaceMedia(
            activePlace.id,
            photo.file,
            'venue'
          );
          kept.push({ key: uploaded.id, id: uploaded.id, url: uploaded.url });
        } else if (photo.id) {
          kept.push({ key: photo.id, id: photo.id, url: photo.url });
        }
      }

      const orderedIds = kept.map((p) => p.id).filter(Boolean) as string[];
      if (orderedIds.length > 0) {
        await reorderPlaceMedia(orderedIds);
      }

      const status = await getPlaceOpenStatus(activePlace.id);
      setOpenStatus(status);

      const published = cloneDraft({
        ...draft,
        name: draft.name.trim(),
        address: draft.address.trim(),
        description: draft.description.trim(),
        photos: kept,
      });
      setBaseline(published);
      setDraft(cloneDraft(published));
    } catch (err) {
      console.error(err);
      const mediaMsg = placeMediaErrorMessage(err);
      const raw =
        err instanceof Error
          ? err.message
          : typeof err === 'object' &&
              err &&
              'message' in err &&
              typeof (err as { message: unknown }).message === 'string'
            ? (err as { message: string }).message
            : '';
      if (/pro_required|Maximum \d+ photos/i.test(raw)) {
        setErrors({ photos: mediaMsg });
      } else if (/42501|permission|row-level/i.test(raw)) {
        setErrors({
          form: 'Tu n’as pas le droit de modifier cette fiche.',
        });
      } else {
        setErrors({
          form: 'Impossible de publier. Vérifie les champs et réessaie.',
        });
      }
    } finally {
      setPublishing(false);
    }
  };

  const onAddPhoto = async (file: File | null) => {
    if (!file || !draft || !canEdit) return;
    if (visiblePhotos.length >= photoCap) {
      setErrors({
        photos: hasPro
          ? 'Maximum 8 photos.'
          : placeMediaErrorMessage(
              new Error(
                `pro_required: free plan allows up to ${FREE_VENUE_PHOTO_MAX} venue photos`
              )
            ),
      });
      return;
    }

    const url = URL.createObjectURL(file);
    const key = newSpecialKey();
    updateDraft({
      photos: [...draft.photos, { key, id: null, url, file }],
    });
    setErrors((e) => ({ ...e, photos: undefined }));
  };

  const onRemovePhoto = (key: string) => {
    if (!draft || !canEdit) return;
    updateDraft({
      photos: draft.photos.map((p) =>
        p.key === key
          ? p.id
            ? { ...p, deleted: true }
            : p
          : p
      ).filter((p) => !(p.key === key && !p.id)),
    });
  };

  const onDragStart = (index: number) => {
    if (!canEdit) return;
    setDragIndex(index);
  };

  const onDropPhoto = (toIndex: number) => {
    if (!draft || dragIndex === null || !canEdit) return;
    const nextVisible = reorderPhotos(visiblePhotos, dragIndex, toIndex);
    const deleted = draft.photos.filter((p) => p.deleted);
    updateDraft({ photos: [...nextVisible, ...deleted] });
    setDragIndex(null);
  };

  if (!placeLoading && !activePlace) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
        <h1 className="font-display m-0 text-xl font-extrabold">Établissement</h1>
        <p className="m-0 text-sm text-ds-text2">
          Aucun café actif. Reviens à l’accueil ou choisis un établissement.
        </p>
      </div>
    );
  }

  if (
    placeLoading ||
    loading ||
    !activePlace ||
    !draft ||
    loadedPlaceId !== activePlace.id
  ) {
    return (
      <div className="flex min-h-[40vh] flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  const readOnly = !canEdit;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-text">
      <header className="flex shrink-0 flex-col gap-3 border-b border-ds-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-0 sm:h-[84px]">
        <div className="min-w-0">
          <h1 className="font-display m-0 text-[26px] font-extrabold tracking-tight">
            Établissement
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            {activePlace.name}
            {dirtyCount > 0 ? (
              <>
                {' '}
                · {dirtyCount} modification{dirtyCount > 1 ? 's' : ''} non
                publiée{dirtyCount > 1 ? 's' : ''}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Button
            variant="outline"
            className="h-11 rounded-xl px-[18px] text-[15px]"
            disabled={readOnly || dirtyCount === 0 || publishing}
            onClick={handleCancel}
          >
            Annuler
          </Button>
          <Button
            variant="main"
            className="h-11 rounded-xl px-[18px] text-[15px]"
            disabled={readOnly || dirtyCount === 0 || publishing}
            onClick={() => void handlePublish()}
          >
            {publishing ? 'Publication…' : 'Publier les modifications'}
          </Button>
        </div>
      </header>

      {readOnly ? (
        <div
          role="status"
          className="mx-4 mt-4 rounded-xl bg-ds-warnsoft px-4 py-3 text-sm font-semibold text-ds-warn sm:mx-8"
        >
          Lecture seule — seul le propriétaire peut modifier la fiche.
        </div>
      ) : null}

      {errors.form ? (
        <p
          role="alert"
          className="mx-4 mt-4 rounded-xl bg-ds-dangersoft px-4 py-3 text-sm font-semibold text-ds-danger sm:mx-8"
        >
          {errors.form}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 py-5 lg:flex-row lg:gap-6 lg:px-8 lg:py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4 pb-24 lg:grid lg:grid-cols-2 lg:gap-4 lg:pb-0 lg:content-start">
          {/* Infos générales */}
          <section className="flex flex-col gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-[18px] lg:col-span-1">
            <h2 className="font-display m-0 text-[17px] font-bold">
              Infos générales
            </h2>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Nom
              <input
                value={draft.name}
                disabled={readOnly}
                onChange={(e) => updateDraft({ name: e.target.value })}
                className="h-10 rounded-[10px] border border-ds-line bg-ds-bg px-3 text-[15px] font-medium outline-none disabled:opacity-70"
              />
              {errors.name ? (
                <span className="text-xs font-semibold text-ds-danger">
                  {errors.name}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Adresse
              <input
                value={draft.address}
                disabled={readOnly}
                onChange={(e) => updateDraft({ address: e.target.value })}
                className="h-10 rounded-[10px] border border-ds-line bg-ds-bg px-3 text-[15px] font-medium outline-none disabled:opacity-70"
              />
              {errors.address ? (
                <span className="text-xs font-semibold text-ds-danger">
                  {errors.address}
                </span>
              ) : null}
            </label>
            {/* phone / website / Instagram : absents de places — masqués */}
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Description
              <textarea
                value={draft.description}
                disabled={readOnly}
                maxLength={DESCRIPTION_MAX}
                onChange={(e) => updateDraft({ description: e.target.value })}
                rows={4}
                className="resize-none rounded-[10px] border border-ds-line bg-ds-bg px-3 py-2.5 text-[15px] font-medium leading-snug outline-none disabled:opacity-70"
              />
              <span className="text-[13px] font-medium text-ds-text2">
                {draft.description.length} / {DESCRIPTION_MAX} caractères
              </span>
              {errors.description ? (
                <span className="text-xs font-semibold text-ds-danger">
                  {errors.description}
                </span>
              ) : null}
            </label>
          </section>

          {/* Horaires */}
          <section className="flex flex-col gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display m-0 text-[17px] font-bold">Horaires</h2>
              <span className="text-[13px] text-ds-text2">Heure de Paris</span>
            </div>

            <div className="flex flex-col gap-2">
              {draft.hours.map((day) => (
                <DayRow
                  key={day.weekday}
                  day={day}
                  readOnly={readOnly}
                  error={errors.hours?.[day.weekday]}
                  onChange={(next) => {
                    updateDraft({
                      hours: draft.hours.map((d) =>
                        d.weekday === day.weekday ? next : d
                      ),
                    });
                  }}
                />
              ))}
            </div>

            <div className="mt-1 flex flex-col gap-2 border-t border-ds-line pt-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[15px] font-bold">
                  Horaires exceptionnels
                </span>
                {!readOnly ? (
                  <button
                    type="button"
                    className="inline-flex h-[34px] items-center gap-1 rounded-[10px] px-3 text-sm font-bold text-ds-accent"
                    onClick={() => {
                      const row: SpecialHoursDraft = {
                        key: newSpecialKey(),
                        onDate: '',
                        label: '',
                        closed: false,
                        opens: '09:00',
                        closes: '18:00',
                      };
                      updateDraft({ specials: [...draft.specials, row] });
                    }}
                  >
                    <Plus className="h-4 w-4" weight="bold" aria-hidden />
                    Ajouter
                  </button>
                ) : null}
              </div>

              {draft.specials.map((special) => (
                <SpecialRow
                  key={special.key}
                  special={special}
                  readOnly={readOnly}
                  error={errors.specials?.[special.key]}
                  onChange={(next) => {
                    updateDraft({
                      specials: draft.specials.map((s) =>
                        s.key === special.key ? next : s
                      ),
                    });
                  }}
                  onRemove={() => {
                    updateDraft({
                      specials: draft.specials.filter(
                        (s) => s.key !== special.key
                      ),
                    });
                  }}
                />
              ))}
            </div>
          </section>

          {/* Photos */}
          <section className="flex flex-col gap-3 rounded-[18px] border border-ds-line bg-ds-surface p-[18px] lg:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display m-0 text-[17px] font-bold">Photos</h2>
              <span className="text-[13px] text-ds-text2">
                Glisse pour changer l&apos;ordre
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
              {visiblePhotos.map((photo, index) => (
                <div
                  key={photo.key}
                  draggable={canEdit}
                  onDragStart={() => onDragStart(index)}
                  onDragOver={(e: DragEvent) => e.preventDefault()}
                  onDrop={() => onDropPhoto(index)}
                  className="relative h-[78px] overflow-hidden rounded-xl bg-ds-surface2"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                  {index === 0 ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded-xl bg-ds-surface px-2 py-0.5 text-xs font-bold text-ds-text">
                      Principale
                    </span>
                  ) : null}
                  {canEdit ? (
                    <button
                      type="button"
                      aria-label="Supprimer la photo"
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-ds-surface/90 text-ds-danger"
                      onClick={() => onRemovePhoto(photo.key)}
                    >
                      <Trash className="h-3.5 w-3.5" weight="bold" />
                    </button>
                  ) : null}
                </div>
              ))}

              {canEdit && !atFreeCap && visiblePhotos.length < photoCap ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      void onAddPhoto(f);
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    aria-label="Ajouter une photo"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-[78px] items-center justify-center rounded-xl border-[1.5px] border-dashed border-ds-line text-ds-text2"
                  >
                    <Plus className="h-5 w-5" weight="bold" />
                  </button>
                </>
              ) : null}
            </div>

            {!hasPro ? (
              <button
                type="button"
                onClick={() => router.push('/abonnement')}
                className="flex items-center gap-2 text-left text-sm text-ds-text2"
              >
                <Lock className="h-4 w-4 shrink-0" weight="bold" aria-hidden />
                Galerie complète et vidéo
                <PlanBadge plan="pro" />
              </button>
            ) : null}

            {errors.photos ? (
              <p className="m-0 text-sm font-semibold text-ds-danger">
                {errors.photos}
              </p>
            ) : null}
          </section>
        </div>

        {/* Desktop sticky preview */}
        <aside
          aria-label="Aperçu client"
          className="hidden w-[330px] shrink-0 lg:block"
        >
          <div className="sticky top-6">
            <EtablissementPreview
              place={activePlace}
              draft={draft}
              openStatus={openStatus}
            />
          </div>
        </aside>
      </div>

      {/* Mobile preview CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ds-line bg-ds-surface p-3 lg:hidden">
        <Button
          variant="outline"
          className="h-12 w-full rounded-xl text-[15px]"
          onClick={() => setPreviewOpen(true)}
        >
          <Eye className="h-4 w-4" weight="bold" aria-hidden />
          Voir l&apos;aperçu
        </Button>
      </div>

      {previewOpen ? (
        <div className="fixed inset-0 z-40 flex flex-col bg-black/40 lg:hidden">
          <button
            type="button"
            className="min-h-0 flex-1"
            aria-label="Fermer l'aperçu"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="max-h-[85dvh] overflow-y-auto rounded-t-[22px] bg-ds-bg px-4 pb-8 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[15px] font-bold">Aperçu client</span>
              <button
                type="button"
                aria-label="Fermer"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-ds-surface2"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <EtablissementPreview
              place={activePlace}
              draft={draft}
              openStatus={openStatus}
              showTitle={false}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DayRow({
  day,
  readOnly,
  error,
  onChange,
}: {
  day: DayHoursDraft;
  readOnly: boolean;
  error?: string;
  onChange: (next: DayHoursDraft) => void;
}) {
  const slot0 = day.slots[0] ?? { opens: '09:00', closes: '18:00' };
  const slot1 = day.slots[1];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex min-h-[30px] flex-wrap items-center gap-2 text-sm">
        <b className="w-[42px] font-bold">{WEEKDAY_LABELS[day.weekday]}</b>
        {day.closed ? (
          <span className="font-semibold text-ds-text2">Fermé</span>
        ) : (
          <>
            <TimeInput
              value={slot0.opens}
              disabled={readOnly}
              onChange={(opens) =>
                onChange({
                  ...day,
                  slots: [
                    { opens, closes: slot0.closes },
                    ...(slot1 ? [slot1] : []),
                  ],
                })
              }
            />
            <span aria-hidden>–</span>
            <TimeInput
              value={slot0.closes}
              disabled={readOnly}
              onChange={(closes) =>
                onChange({
                  ...day,
                  slots: [
                    { opens: slot0.opens, closes },
                    ...(slot1 ? [slot1] : []),
                  ],
                })
              }
            />
            {slot1 ? (
              <>
                <span className="text-ds-text2">·</span>
                <TimeInput
                  value={slot1.opens}
                  disabled={readOnly}
                  onChange={(opens) =>
                    onChange({
                      ...day,
                      slots: [slot0, { opens, closes: slot1.closes }],
                    })
                  }
                />
                <span aria-hidden>–</span>
                <TimeInput
                  value={slot1.closes}
                  disabled={readOnly}
                  onChange={(closes) =>
                    onChange({
                      ...day,
                      slots: [slot0, { opens: slot1.opens, closes }],
                    })
                  }
                />
              </>
            ) : null}
          </>
        )}
        {!readOnly ? (
          <div className="ml-auto flex items-center gap-2">
            {!day.closed && !slot1 && day.slots.length < 2 ? (
              <button
                type="button"
                className="text-xs font-bold text-ds-accent"
                onClick={() =>
                  onChange({
                    ...day,
                    slots: [
                      slot0,
                      { opens: '18:00', closes: '22:00' },
                    ],
                  })
                }
              >
                + créneau
              </button>
            ) : null}
            {!day.closed && slot1 ? (
              <button
                type="button"
                className="text-xs font-bold text-ds-text2"
                onClick={() => onChange({ ...day, slots: [slot0] })}
              >
                − créneau
              </button>
            ) : null}
            <label className="flex items-center gap-1.5 text-xs font-semibold text-ds-text2">
              <input
                type="checkbox"
                checked={day.closed}
                onChange={(e) => {
                  const closed = e.target.checked;
                  onChange({
                    ...day,
                    closed,
                    slots: closed
                      ? []
                      : day.slots.length
                        ? day.slots
                        : [{ opens: '09:00', closes: '18:00' }],
                  });
                }}
              />
              Fermé
            </label>
          </div>
        ) : null}
      </div>
      {error ? (
        <span className="pl-[50px] text-xs font-semibold text-ds-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function SpecialRow({
  special,
  readOnly,
  error,
  onChange,
  onRemove,
}: {
  special: SpecialHoursDraft;
  readOnly: boolean;
  error?: string;
  onChange: (next: SpecialHoursDraft) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-ds-line bg-ds-bg p-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {special.onDate ? (
          <span className="inline-flex h-6 items-center rounded-xl bg-ds-warnsoft px-2 text-xs font-bold text-ds-warn">
            {formatSpecialDateLabel(special.onDate)}
          </span>
        ) : null}
        <input
          type="date"
          value={special.onDate}
          disabled={readOnly}
          onChange={(e) => onChange({ ...special, onDate: e.target.value })}
          className="h-8 rounded-lg border border-ds-line bg-ds-surface px-2 text-sm"
        />
        <input
          value={special.label}
          disabled={readOnly}
          placeholder="Libellé"
          onChange={(e) => onChange({ ...special, label: e.target.value })}
          className="h-8 min-w-[100px] flex-1 rounded-lg border border-ds-line bg-ds-surface px-2 text-sm"
        />
        {!readOnly ? (
          <button
            type="button"
            aria-label="Supprimer"
            className="text-ds-danger"
            onClick={onRemove}
          >
            <Trash className="h-4 w-4" weight="bold" />
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {special.closed ? (
          <span className="font-semibold text-ds-text2">Fermé</span>
        ) : (
          <>
            <TimeInput
              value={special.opens ?? '09:00'}
              disabled={readOnly}
              onChange={(opens) => onChange({ ...special, opens })}
            />
            <span>–</span>
            <TimeInput
              value={special.closes ?? '18:00'}
              disabled={readOnly}
              onChange={(closes) => onChange({ ...special, closes })}
            />
          </>
        )}
        {!readOnly ? (
          <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-ds-text2">
            <input
              type="checkbox"
              checked={special.closed}
              onChange={(e) =>
                onChange({
                  ...special,
                  closed: e.target.checked,
                  opens: e.target.checked ? null : special.opens ?? '09:00',
                  closes: e.target.checked ? null : special.closes ?? '18:00',
                })
              }
            />
            Fermé
          </label>
        ) : null}
      </div>
      {error ? (
        <span className="text-xs font-semibold text-ds-danger">{error}</span>
      ) : null}
    </div>
  );
}

function TimeInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="inline-flex h-[30px] rounded-lg bg-ds-surface2 px-2 font-semibold tabular-nums outline-none disabled:opacity-70"
    />
  );
}
