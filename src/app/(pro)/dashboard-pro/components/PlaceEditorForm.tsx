'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  FloppyDisk,
  Image as ImageIcon,
  Plus,
  Spinner,
  Storefront,
  Trash,
  X,
} from '@phosphor-icons/react';
import { Place } from '@/lib/api/places';
import {
  updateVendorPlace,
  type VendorPlacePatch,
} from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import {
  deletePlaceMedia,
  listPlaceMedia,
  MAX_PHOTOS_PER_CATEGORY,
  uploadPlaceMedia,
  type PlaceMedia,
  type PlaceMediaCategory,
} from '@/app/(pro)/dashboard-pro/lib/api/placePhotos';
import {
  NOISE_OPTIONS,
  PLUGS_OPTIONS,
  WIFI_OPTIONS,
  normalizeNoiseLevel,
  normalizePlugsLevel,
  normalizeWifiSpeed,
  type NoiseLevel,
  type PlugsLevel,
  type WifiSpeed,
} from '@/lib/placeAmenities';

interface PlaceEditorFormProps {
  places: Place[];
  onSaved?: (place: Place) => void;
}

type WifiSpeedState = WifiSpeed | '';
type NoiseLevelState = NoiseLevel | '';
type PlugsLevelState = PlugsLevel | '';

const GALLERY_SECTIONS: {
  category: PlaceMediaCategory;
  title: string;
  hint: string;
}[] = [
  {
    category: 'venue',
    title: 'Photos du lieu',
    hint: 'Salle, façade, terrasse… La 1re devient la couverture.',
  },
  {
    category: 'food',
    title: 'Plats et boissons',
    hint: 'Cafés, pâtisseries, assiettes…',
  },
  {
    category: 'menu',
    title: 'Menu / carte',
    hint: 'Photos de la carte ou du menu du jour.',
  },
];

export default function PlaceEditorForm({
  places,
  onSaved,
}: PlaceEditorFormProps) {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const selected = places.find((p) => p.id === placeId) ?? places[0] ?? null;

  const [description, setDescription] = useState('');
  const [openingHours, setOpeningHours] = useState('');
  const [wifiSpeed, setWifiSpeed] = useState<WifiSpeedState>('');
  const [noiseLevel, setNoiseLevel] = useState<NoiseLevelState>('');
  const [plugsLevel, setPlugsLevel] = useState<PlugsLevelState>('');
  const [hasVegan, setHasVegan] = useState(false);
  const [saving, setSaving] = useState(false);
  const [media, setMedia] = useState<PlaceMedia[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploadingCategory, setUploadingCategory] =
    useState<PlaceMediaCategory | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileRefs = useRef<
    Partial<Record<PlaceMediaCategory, HTMLInputElement | null>>
  >({});

  useEffect(() => {
    if (places.length === 0) {
      setPlaceId('');
      return;
    }
    if (!places.some((p) => p.id === placeId)) {
      setPlaceId(places[0].id);
    }
  }, [places, placeId]);

  useEffect(() => {
    if (!selected) return;
    setDescription(selected.description ?? '');
    setOpeningHours(selected.opening_hours ?? '');
    setWifiSpeed(normalizeWifiSpeed(selected.wifi_speed) ?? '');
    setNoiseLevel(normalizeNoiseLevel(selected.noise_level) ?? '');
    setPlugsLevel(
      normalizePlugsLevel(selected.plugs_level) ??
        (selected.has_plugs ? 'regular' : '')
    );
    setHasVegan(Boolean(selected.is_vegan));
    setError(null);
    setSuccess(null);
  }, [selected]);

  const refreshMedia = useCallback(async (id: string) => {
    setMediaLoading(true);
    try {
      const list = await listPlaceMedia(id);
      setMedia(list);
    } catch (err) {
      console.error(err);
      setMedia([]);
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger la galerie (migration place_media ?)'
      );
    } finally {
      setMediaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selected?.id) {
      setMedia([]);
      return;
    }
    void refreshMedia(selected.id);
  }, [selected?.id, refreshMedia]);

  const mediaFor = (category: PlaceMediaCategory) =>
    media.filter((m) => m.category === category);

  const handleUploadFiles = async (
    category: PlaceMediaCategory,
    files: FileList | null
  ) => {
    if (!selected || !files?.length) return;
    setError(null);
    setSuccess(null);
    setUploadingCategory(category);

    const current = mediaFor(category).length;
    const room = MAX_PHOTOS_PER_CATEGORY - current;
    if (room <= 0) {
      setError(
        `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos pour cette catégorie.`
      );
      setUploadingCategory(null);
      return;
    }

    const batch = Array.from(files).slice(0, room);
    try {
      for (const file of batch) {
        await uploadPlaceMedia(selected.id, file, category);
      }
      await refreshMedia(selected.id);
      setSuccess(
        batch.length > 1
          ? `${batch.length} photos ajoutées`
          : 'Photo ajoutée'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Upload impossible (bucket place-photos ?)'
      );
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleDelete = async (item: PlaceMedia) => {
    setError(null);
    setSuccess(null);
    setDeletingId(item.id);
    try {
      await deletePlaceMedia(item.id);
      setMedia((prev) => prev.filter((m) => m.id !== item.id));
      setSuccess('Photo supprimée');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Suppression impossible'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    const patch: VendorPlacePatch = {
      description: description.trim() || null,
      opening_hours: openingHours.trim() || null,
      wifi_speed: wifiSpeed.trim() || null,
      noise_level: noiseLevel.trim() || null,
      has_vegan: hasVegan,
      plugs_level: plugsLevel || null,
      has_plugs: plugsLevel ? plugsLevel !== 'limited' : false,
    };

    try {
      const updated = await updateVendorPlace(selected.id, patch);
      setSuccess(`« ${updated.name} » mis à jour`);
      onSaved?.(updated);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Impossible d’enregistrer le spot'
      );
    } finally {
      setSaving(false);
    }
  };

  if (places.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white/50 p-6 text-center text-sm text-ds-text2">
        Aucun spot à gérer. Lie un café avec{' '}
        <code className="text-[10px]">places.vendor_id</code> dans Supabase.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-ds-text2/10 bg-ds-surface p-5 shadow-soft space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-full bg-ds-accentsoft text-ds-ok flex items-center justify-center">
          <Storefront size={18} weight="duotone" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-ds-text">
            Fiche établissement
          </h2>
          <p className="text-xs text-ds-text2">
            Visible par les étudiants dans l&apos;app
          </p>
        </div>
      </div>

      {places.length > 1 && (
        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
            Spot
          </span>
          <select
            value={placeId}
            onChange={(e) => setPlaceId(e.target.value)}
            className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm outline-none"
          >
            {places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {selected && (
        <p className="text-sm font-bold text-ds-text">{selected.name}</p>
      )}

      {/* Galeries multi-photos */}
      <div className="space-y-5 pt-1">
        <div className="flex items-center gap-2">
          <ImageIcon size={16} weight="duotone" className="text-ds-ok" />
          <h3 className="text-sm font-extrabold text-ds-text">
            Galerie photos
          </h3>
          {mediaLoading && (
            <Spinner size={14} className="animate-spin text-ds-text2" />
          )}
        </div>

        {GALLERY_SECTIONS.map((section) => {
          const items = mediaFor(section.category);
          const atMax = items.length >= MAX_PHOTOS_PER_CATEGORY;
          const busy = uploadingCategory === section.category;

          return (
            <div
              key={section.category}
              className="rounded-xl border border-ds-text2/10 bg-ds-bg/50 p-3 space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-ds-text2">
                    {section.title}
                  </p>
                  <p className="text-[11px] text-ds-text2/80 mt-0.5">
                    {section.hint}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-ds-text2 tabular-nums shrink-0">
                  {items.length}/{MAX_PHOTOS_PER_CATEGORY}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-ds-surface2 group"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    {section.category === 'venue' && index === 0 && (
                      <span className="absolute left-1 bottom-1 text-[9px] font-bold uppercase tracking-wide bg-ds-pin/80 text-white px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => void handleDelete(item)}
                      aria-label="Supprimer la photo"
                      className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-ds-surface/95 shadow text-ds-accent active:scale-95 disabled:opacity-50"
                    >
                      {deletingId === item.id ? (
                        <Spinner size={12} className="animate-spin" />
                      ) : (
                        <Trash size={12} weight="bold" />
                      )}
                    </button>
                  </div>
                ))}

                {!atMax && (
                  <button
                    type="button"
                    disabled={busy || !selected}
                    onClick={() => fileRefs.current[section.category]?.click()}
                    className="aspect-square rounded-lg border border-dashed border-ds-text2/25 bg-ds-surface flex flex-col items-center justify-center gap-1 text-ds-text2 active:scale-95 disabled:opacity-50"
                  >
                    {busy ? (
                      <Spinner size={18} className="animate-spin" />
                    ) : (
                      <>
                        <Plus size={18} weight="bold" />
                        <span className="text-[10px] font-bold">Ajouter</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              <input
                ref={(el) => {
                  fileRefs.current[section.category] = el;
                }}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  void handleUploadFiles(section.category, e.target.files);
                  e.target.value = '';
                }}
              />
            </div>
          );
        })}
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Ambiance, histoire, spécialités…"
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm outline-none resize-none"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Horaires
        </span>
        <input
          type="text"
          value={openingHours}
          onChange={(e) => setOpeningHours(e.target.value)}
          placeholder="Lun–Ven 8h–18h · Sam 9h–14h"
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm outline-none"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Prises
        </span>
        <select
          value={plugsLevel}
          onChange={(e) =>
            setPlugsLevel((e.target.value || '') as PlugsLevelState)
          }
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm outline-none"
        >
          {PLUGS_OPTIONS.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Wi-Fi
        </span>
        <select
          value={wifiSpeed}
          onChange={(e) =>
            setWifiSpeed((e.target.value || '') as WifiSpeedState)
          }
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm outline-none"
        >
          {WIFI_OPTIONS.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label === '—' ? 'Non renseigné' : o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Ambiance
        </span>
        <select
          value={noiseLevel}
          onChange={(e) =>
            setNoiseLevel((e.target.value || '') as NoiseLevelState)
          }
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm outline-none"
        >
          {NOISE_OPTIONS.map((o) => (
            <option key={o.value || 'empty'} value={o.value}>
              {o.label === '—' ? 'Non renseigné' : o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="inline-flex items-center gap-2 text-sm font-semibold text-ds-text cursor-pointer">
        <input
          type="checkbox"
          checked={hasVegan}
          onChange={(e) => setHasVegan(e.target.checked)}
          className="rounded border-ds-text2/30 text-ds-ok focus:ring-ds-ok/30"
        />
        Options véganes
      </label>

      {error && (
        <p className="text-sm font-medium text-ds-accent bg-ds-accent/10 rounded-xl px-3 py-2 flex items-start gap-2">
          <X size={16} weight="bold" className="mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {success && (
        <p className="text-sm font-medium text-ds-ok bg-ds-ok/10 rounded-xl px-3 py-2">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={saving || !selected}
        className="w-full flex items-center justify-center gap-2 bg-ds-pin text-white font-bold text-sm py-3 rounded-xl shadow-md active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {saving ? (
          <>
            <Spinner size={18} className="animate-spin" />
            Enregistrement…
          </>
        ) : (
          <>
            <FloppyDisk size={18} weight="bold" />
            Enregistrer la fiche
          </>
        )}
      </button>
    </form>
  );
}
