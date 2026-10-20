'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Image as ImageIcon,
  MagnifyingGlass,
  PlusCircle,
  Spinner,
  Storefront,
} from '@phosphor-icons/react';
import { Place } from '@/lib/api/places';
import {
  claimVendorPlace,
  createVendorPlace,
  listUnclaimedPlaces,
  updateVendorPlace,
} from '@/app/dashboard-pro/lib/api/vendor';
import { uploadPlacePhoto } from '@/app/dashboard-pro/lib/api/placePhotos';
import {
  NOISE_OPTIONS,
  PLUGS_OPTIONS,
  WIFI_OPTIONS,
  noiseLabel,
  normalizeNoiseLevel,
  normalizePlugsLevel,
  normalizeWifiSpeed,
  plugsLabel,
  wifiLabel,
  type NoiseLevel,
  type PlugsLevel,
  type WifiSpeed,
} from '@/lib/placeAmenities';

type Mode = 'claim' | 'create' | null;
type Step = 0 | 1 | 2 | 3;

type WifiSpeedState = WifiSpeed | '';
type NoiseLevelState = NoiseLevel | '';
type PlugsLevelState = PlugsLevel | '';

const STEPS = [
  'Établissement',
  'Infos pratiques',
  'Visuels',
  'Finalisation',
] as const;

export default function VendorOnboardingWizard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [mode, setMode] = useState<Mode>(null);

  const [unclaimed, setUnclaimed] = useState<Place[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [claimQuery, setClaimQuery] = useState('');
  const [selectedPlaceId, setSelectedPlaceId] = useState('');

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Nice');
  const [description, setDescription] = useState('');
  const [wifiSpeed, setWifiSpeed] = useState<WifiSpeedState>('');
  const [noiseLevel, setNoiseLevel] = useState<NoiseLevelState>('');
  const [plugsLevel, setPlugsLevel] = useState<PlugsLevelState>('');
  const [openingHours, setOpeningHours] = useState('');
  const [hasVegan, setHasVegan] = useState(false);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingImageUrl, setExistingImageUrl] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const list = await listUnclaimedPlaces();
        if (!cancelled) setUnclaimed(list);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Impossible de charger les cafés disponibles.'
          );
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const filteredUnclaimed = useMemo(() => {
    const q = claimQuery.trim().toLowerCase();
    if (!q) return unclaimed;
    return unclaimed.filter((p) => {
      const hay = `${p.name} ${p.address ?? ''} ${p.city ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [unclaimed, claimQuery]);

  const selectedPlace = useMemo(
    () => unclaimed.find((p) => p.id === selectedPlaceId) ?? null,
    [unclaimed, selectedPlaceId]
  );

  const applyPlacePrefill = (place: Place) => {
    setName(place.name);
    setAddress(place.address ?? '');
    setCity(place.city ?? 'Nice');
    setDescription(place.description ?? '');
    setWifiSpeed(normalizeWifiSpeed(place.wifi_speed) ?? '');
    setNoiseLevel(normalizeNoiseLevel(place.noise_level) ?? '');
    setPlugsLevel(normalizePlugsLevel(place.plugs_level) ?? '');
    setOpeningHours(place.opening_hours ?? '');
    setHasVegan(Boolean(place.is_vegan));
    setExistingImageUrl(place.image_url ?? null);
    setCoverFile(null);
    setCoverPreview(place.image_url ?? null);
  };

  const chooseMode = (next: Mode) => {
    setMode(next);
    setError(null);
    if (next === 'create') {
      setSelectedPlaceId('');
      setName('');
      setAddress('');
      setCity('Nice');
      setDescription('');
      setWifiSpeed('');
      setNoiseLevel('');
      setPlugsLevel('');
      setOpeningHours('');
      setHasVegan(false);
      setExistingImageUrl(null);
      setCoverFile(null);
      setCoverPreview(null);
    }
  };

  const canGoStep1 =
    mode === 'create' || (mode === 'claim' && Boolean(selectedPlaceId));

  const canGoStep2 = name.trim().length >= 2 && address.trim().length >= 3;

  const goNext = () => {
    setError(null);
    if (step === 0) {
      if (!canGoStep1) {
        setError(
          mode === 'claim'
            ? 'Sélectionne un café dans la liste.'
            : 'Choisis une option pour continuer.'
        );
        return;
      }
      if (mode === 'claim' && selectedPlace) applyPlacePrefill(selectedPlace);
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!canGoStep2) {
        setError('Indique au minimum le nom et l’adresse.');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) setStep(3);
  };

  const goBack = () => {
    setError(null);
    if (step === 0) return;
    setStep((s) => (s - 1) as Step);
  };

  const onPickCover = (file: File | null) => {
    if (coverPreview?.startsWith('blob:')) URL.revokeObjectURL(coverPreview);
    if (!file) {
      setCoverFile(null);
      setCoverPreview(existingImageUrl);
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const handleFinalize = async (e: FormEvent) => {
    e.preventDefault();
    if (!mode) return;
    setSubmitting(true);
    setError(null);
    try {
      const base = {
        name: name.trim(),
        address: address.trim(),
        city: city.trim() || null,
        description: description.trim() || null,
        // Valeurs canoniques EN (pas les libellés FR du récap)
        wifi_speed: wifiSpeed || null,
        noise_level: noiseLevel || null,
        plugs_level: plugsLevel || null,
        opening_hours: openingHours.trim() || null,
        has_vegan: hasVegan,
        image_url: existingImageUrl,
        lat: selectedPlace?.lat,
        lng: selectedPlace?.lng,
      };

      let place: Place;
      if (mode === 'claim') {
        place = await claimVendorPlace({
          ...base,
          placeId: selectedPlaceId,
        });
      } else {
        place = await createVendorPlace(base);
      }

      if (coverFile) {
        const url = await uploadPlacePhoto(place.id, coverFile);
        await updateVendorPlace(place.id, { image_url: url });
      }

      router.replace('/dashboard-pro?onboarded=1');
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : 'Impossible de finaliser l’établissement.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <ol className="flex gap-1.5">
        {STEPS.map((label, i) => {
          const active = i === step;
          const done = i < step;
          return (
            <li key={label} className="flex-1 min-w-0">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  done || active ? 'bg-brand-green' : 'bg-brand-mocha/15'
                }`}
              />
              <p
                className={`mt-1.5 text-[10px] font-bold truncate ${
                  active ? 'text-brand-espresso' : 'text-brand-mocha'
                }`}
              >
                {label}
              </p>
            </li>
          );
        })}
      </ol>

      {error && (
        <p className="text-sm font-medium text-brand-terracotta bg-brand-terracotta/10 rounded-xl px-3 py-2">
          {error}
        </p>
      )}

      {/* Étape A */}
      {step === 0 && (
        <div className="space-y-4">
          <p className="text-sm text-brand-mocha leading-relaxed">
            Associe ton premier café pour publier des Flash Drops et valider les
            offres en caisse.
          </p>

          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => chooseMode('claim')}
              className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${
                mode === 'claim'
                  ? 'border-brand-green bg-brand-green/5 shadow-soft'
                  : 'border-brand-mocha/15 bg-brand-surface hover:border-brand-green/30'
              }`}
            >
              <span className="flex items-center gap-2 font-extrabold text-brand-espresso">
                <MagnifyingGlass size={20} weight="duotone" className="text-brand-green" />
                Revendiquer un café existant
              </span>
              <span className="block text-xs text-brand-mocha mt-1">
                Choisis un spot déjà listé sur DropSpot (sans propriétaire).
              </span>
            </button>

            <button
              type="button"
              onClick={() => chooseMode('create')}
              className={`text-left rounded-2xl border p-4 transition-all active:scale-[0.99] ${
                mode === 'create'
                  ? 'border-brand-green bg-brand-green/5 shadow-soft'
                  : 'border-brand-mocha/15 bg-brand-surface hover:border-brand-green/30'
              }`}
            >
              <span className="flex items-center gap-2 font-extrabold text-brand-espresso">
                <PlusCircle size={20} weight="duotone" className="text-brand-green" />
                Ajouter un nouveau café
              </span>
              <span className="block text-xs text-brand-mocha mt-1">
                Crée ta fiche depuis zéro (Nice par défaut pour la carte).
              </span>
            </button>
          </div>

          {mode === 'claim' && (
            <div className="rounded-2xl border border-brand-mocha/10 bg-brand-surface p-4 space-y-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                  Rechercher
                </span>
                <input
                  type="search"
                  value={claimQuery}
                  onChange={(e) => setClaimQuery(e.target.value)}
                  placeholder="Nom, adresse, ville…"
                  className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
                />
              </label>

              {loadingList ? (
                <div className="flex justify-center py-6">
                  <Spinner size={24} className="animate-spin text-brand-green" />
                </div>
              ) : filteredUnclaimed.length === 0 ? (
                <p className="text-sm text-brand-mocha text-center py-4">
                  Aucun café libre trouvé — crée plutôt un nouvel établissement.
                </p>
              ) : (
                <label className="block space-y-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                    Café
                  </span>
                  <select
                    value={selectedPlaceId}
                    onChange={(e) => setSelectedPlaceId(e.target.value)}
                    className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
                  >
                    <option value="">Sélectionne un café…</option>
                    {filteredUnclaimed.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.city ? ` · ${p.city}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}
        </div>
      )}

      {/* Étape B */}
      {step === 1 && (
        <div className="rounded-2xl border border-brand-mocha/10 bg-brand-surface p-5 space-y-4 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <Storefront size={20} weight="duotone" className="text-brand-green" />
            <h2 className="text-base font-extrabold text-brand-espresso">
              Informations pratiques
            </h2>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
              Nom de l’établissement
            </span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bloom Specialty Coffee"
              className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
              Adresse complète
            </span>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="4 Bd Victor Hugo"
              className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
              Ville
            </span>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Nice"
              className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
              Description (étudiants / nomades)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Cadre calme, prises à chaque table, idéal pour bosser…"
              className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15 resize-none"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
              Horaires
            </span>
            <input
              type="text"
              value={openingHours}
              onChange={(e) => setOpeningHours(e.target.value)}
              placeholder="Lun–Ven 8h–19h · Sam 9h–18h"
              className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3.5 py-2.5 text-sm text-brand-espresso outline-none focus:border-brand-green/40 focus:ring-2 focus:ring-brand-green/15"
            />
          </label>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
              Prises
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {PLUGS_OPTIONS.filter((o) => o.value).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setPlugsLevel(o.value as PlugsLevel)}
                  className={`rounded-xl py-2.5 text-sm font-semibold border transition-all ${
                    plugsLevel === o.value
                      ? 'bg-brand-dark text-white border-brand-dark'
                      : 'bg-brand-oat text-brand-espresso border-brand-mocha/15'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                Wi-Fi
              </span>
              <select
                value={wifiSpeed}
                onChange={(e) =>
                  setWifiSpeed((e.target.value || '') as WifiSpeedState)
                }
                className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3 py-2.5 text-sm text-brand-espresso outline-none"
              >
                {WIFI_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-brand-mocha">
                Ambiance
              </span>
              <select
                value={noiseLevel}
                onChange={(e) =>
                  setNoiseLevel((e.target.value || '') as NoiseLevelState)
                }
                className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat px-3 py-2.5 text-sm text-brand-espresso outline-none"
              >
                {NOISE_OPTIONS.map((o) => (
                  <option key={o.value || 'empty'} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasVegan}
              onChange={(e) => setHasVegan(e.target.checked)}
              className="rounded border-brand-mocha/30 text-brand-green focus:ring-brand-green/30"
            />
            <span className="text-sm font-semibold text-brand-espresso">
              Options véganes
            </span>
          </label>
        </div>
      )}

      {/* Étape C */}
      {step === 2 && (
        <div className="rounded-2xl border border-brand-mocha/10 bg-brand-surface p-5 space-y-4 shadow-soft">
          <h2 className="text-base font-extrabold text-brand-espresso flex items-center gap-2">
            <ImageIcon size={20} weight="duotone" className="text-brand-green" />
            Photo de couverture
          </h2>
          <p className="text-xs text-brand-mocha">
            Optionnel — tu pourras la changer plus tard dans Fiche café.
          </p>

          <div
            className="relative aspect-[16/10] rounded-2xl overflow-hidden border border-dashed border-brand-mocha/25 bg-brand-oat flex items-center justify-center"
          >
            {coverPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverPreview}
                alt="Aperçu couverture"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm text-brand-mocha px-4 text-center">
                Aucune image sélectionnée
              </span>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => onPickCover(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl border border-brand-mocha/15 bg-brand-oat py-3 text-sm font-bold text-brand-espresso hover:border-brand-green/30 transition-colors"
          >
            {coverPreview ? 'Changer la photo' : 'Uploader une photo'}
          </button>
        </div>
      )}

      {/* Étape D */}
      {step === 3 && (
        <form
          onSubmit={handleFinalize}
          className="rounded-2xl border border-brand-mocha/10 bg-brand-surface p-5 space-y-4 shadow-soft"
        >
          <h2 className="text-base font-extrabold text-brand-espresso flex items-center gap-2">
            <CheckCircle size={20} weight="duotone" className="text-brand-green" />
            Récapitulatif
          </h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-brand-mocha">Mode</dt>
              <dd className="font-bold text-brand-espresso text-right">
                {mode === 'claim' ? 'Revendication' : 'Nouveau café'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-brand-mocha">Nom</dt>
              <dd className="font-bold text-brand-espresso text-right">{name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-brand-mocha">Adresse</dt>
              <dd className="font-semibold text-brand-espresso text-right">
                {address}
                {city ? `, ${city}` : ''}
              </dd>
            </div>
            {(wifiSpeed || noiseLevel || plugsLevel) && (
              <div className="flex justify-between gap-3">
                <dt className="text-brand-mocha">Équipements</dt>
                <dd className="font-semibold text-brand-espresso text-right text-xs">
                  {[
                    plugsLevel && plugsLabel(plugsLevel),
                    wifiSpeed && `Wi-Fi ${wifiLabel(wifiSpeed)}`,
                    noiseLevel && noiseLabel(noiseLevel),
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </dd>
              </div>
            )}
          </dl>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-brand-green text-white font-bold text-sm py-3.5 rounded-xl shadow-md hover:bg-brand-green/90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {submitting ? (
              <>
                <Spinner size={18} className="animate-spin" />
                Finalisation…
              </>
            ) : (
              <>
                <CheckCircle size={18} weight="fill" />
                Finaliser mon établissement
              </>
            )}
          </button>
        </form>
      )}

      {/* Navigation wizard */}
      {step < 3 && (
        <div className="flex gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={goBack}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-brand-mocha/15 bg-brand-surface py-3 text-sm font-bold text-brand-espresso"
            >
              <ArrowLeft size={16} weight="bold" />
              Retour
            </button>
          ) : (
            <div className="flex-1" />
          )}
          <button
            type="button"
            onClick={goNext}
            className="flex-[1.4] flex items-center justify-center gap-1.5 rounded-xl bg-brand-dark text-white py-3 text-sm font-bold active:scale-[0.98] transition-all"
          >
            Continuer
            <ArrowRight size={16} weight="bold" />
          </button>
        </div>
      )}

      {step === 3 && (
        <button
          type="button"
          onClick={goBack}
          disabled={submitting}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-brand-mocha/15 bg-brand-surface py-3 text-sm font-bold text-brand-espresso disabled:opacity-50"
        >
          <ArrowLeft size={16} weight="bold" />
          Retour
        </button>
      )}
    </div>
  );
}
