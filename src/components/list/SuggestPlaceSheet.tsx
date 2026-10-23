'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle, X } from '@phosphor-icons/react';
import { suggestPlace } from '@/app/(pro)/dashboard-pro/lib/api/vendor';
import { claimErrorMessage } from '@/app/(pro)/dashboard-pro/lib/onboarding/claimErrors';
import { geocodeAddress, NICE_CENTER } from '@/lib/geocode';
import LoginModal from '@/components/auth/LoginModal';

interface SuggestPlaceSheetProps {
  isAuthenticated: boolean;
  onClose: () => void;
  /** Called with the new place id once the café is on the map. */
  onSuggested?: (placeId: string) => void;
}

/** « Un café manque ? » : suggest_place RPC, max 3 per day. */
export default function SuggestPlaceSheet({
  isAuthenticated,
  onClose,
  onSuggested,
}: SuggestPlaceSheetProps) {
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Nice');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setError(claimErrorMessage('invalid_name'));
      return;
    }
    if (!address.trim() || !city.trim()) {
      setError('Indique l’adresse et la ville.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const coords = await geocodeAddress(address, city);
      // geocodeAddress falls back to the centre of Nice when it finds nothing.
      if (coords.lat === NICE_CENTER.lat && coords.lng === NICE_CENTER.lng) {
        setError(claimErrorMessage('invalid_coords'));
        return;
      }
      const result = await suggestPlace({
        name: cleanName,
        address: address.trim(),
        city: city.trim(),
        lat: coords.lat,
        lng: coords.lng,
      });
      if (!result.ok) {
        setError(claimErrorMessage(result.error));
        return;
      }
      setDone(true);
      onSuggested?.(result.placeId);
    } catch (err) {
      console.error(err);
      setError('Impossible d’ajouter ce café. Réessaie.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full rounded-2xl border border-ds-line bg-ds-surface px-4 py-3 text-[15px] text-ds-text outline-none focus:border-ds-accent';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-ds-bg shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-ds-text2/25" />
        </div>

        <div className="flex items-start justify-between gap-3 px-5 pb-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight text-ds-text">
              Un café manque ?
            </h2>
            <p className="mt-1 text-sm text-ds-text2">
              Ajoute-le, il apparaîtra sur la carte pour tout le monde.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-ds-text2/10 bg-ds-surface shadow-sm active:scale-95"
          >
            <X size={18} weight="bold" className="text-ds-text" />
          </button>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 px-6 pb-10 pt-4 text-center">
            <CheckCircle size={44} weight="fill" className="text-ds-ok" />
            <p className="text-lg font-extrabold text-ds-text">Merci !</p>
            <p className="text-sm text-ds-text2">
              {name.trim()} est maintenant sur la carte.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full max-w-xs rounded-2xl bg-ds-pin py-3.5 font-bold text-white active:scale-[0.98]"
            >
              Fermer
            </button>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex flex-col items-center gap-3 px-6 pb-10 pt-4 text-center">
            <p className="text-sm text-ds-text2">
              Connecte-toi pour ajouter un café.
            </p>
            <button
              type="button"
              onClick={() => setShowLogin(true)}
              className="w-full max-w-xs rounded-2xl bg-ds-pin py-3.5 font-bold text-white active:scale-[0.98]"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3 px-5 pb-6">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ds-text">Nom du café</span>
              <input
                id="suggest-place-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                autoComplete="off"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ds-text">Adresse</span>
              <input
                id="suggest-place-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                maxLength={200}
                placeholder="12 rue Bonaparte"
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-bold text-ds-text">Ville</span>
              <input
                id="suggest-place-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={80}
                className={inputClass}
              />
            </label>
            {error ? (
              <p className="text-center text-sm font-medium text-ds-accent">{error}</p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 w-full rounded-2xl bg-ds-ok py-4 font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
            >
              {busy ? 'Ajout…' : 'Ajouter le café'}
            </button>
          </form>
        )}
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
