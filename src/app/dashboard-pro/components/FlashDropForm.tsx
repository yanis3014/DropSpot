'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Lightning, Spinner } from '@phosphor-icons/react';
import { Place } from '@/lib/api/places';
import { createFlashDrop } from '@/app/dashboard-pro/lib/api/flashDrops';

interface FlashDropFormProps {
  places: Place[];
  onCreated?: () => void;
}

const DURATIONS = [
  { minutes: 30, label: '30 min' },
  { minutes: 60, label: '1 h' },
  { minutes: 120, label: '2 h' },
  { minutes: 180, label: '3 h' },
] as const;

export default function FlashDropForm({ places, onCreated }: FlashDropFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [placeId, setPlaceId] = useState(places[0]?.id ?? '');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync la sélection quand les spots vendor arrivent de Supabase
  useEffect(() => {
    if (places.length === 0) {
      setPlaceId('');
      return;
    }
    if (!places.some((p) => p.id === placeId)) {
      setPlaceId(places[0].id);
    }
  }, [places, placeId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const drop = await createFlashDrop({
        title,
        description,
        place_id: placeId,
        durationMinutes,
      });
      setSuccess(
        `Flash Drop « ${drop.title} » publié${
          drop.pin_code ? ` · PIN ${drop.pin_code}` : ''
        } · jusqu’à ${new Date(drop.ends_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        })}`
      );
      setTitle('');
      setDescription('');
      onCreated?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Impossible de créer le drop';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-ds-text2/10 bg-ds-surface p-5 shadow-soft space-y-4"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
          <Lightning size={18} weight="fill" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-ds-text">
            Créer un Flash Drop
          </h2>
          <p className="text-xs text-ds-text2">
            Promo live visible immédiatement dans l&apos;app
          </p>
        </div>
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Titre
        </span>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: -20% sur les lattes"
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm text-ds-text placeholder:text-ds-text2/50 outline-none focus:border-ds-ok/40 focus:ring-2 focus:ring-ds-ok/15"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Description
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Détails de l'offre (optionnel)"
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm text-ds-text placeholder:text-ds-text2/50 outline-none focus:border-ds-ok/40 focus:ring-2 focus:ring-ds-ok/15 resize-none"
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Spot
        </span>
        <select
          required
          value={placeId}
          onChange={(e) => setPlaceId(e.target.value)}
          className="w-full rounded-xl border border-ds-text2/15 bg-ds-bg px-3.5 py-2.5 text-sm text-ds-text outline-none focus:border-ds-ok/40 focus:ring-2 focus:ring-ds-ok/15"
        >
          {places.length === 0 && (
            <option value="">
              Aucun spot lié (places.vendor_id = ton user id)
            </option>
          )}
          {places.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {places.length === 0 && (
          <p className="text-[11px] text-ds-text2">
            Assigne ton café dans Supabase :{' '}
            <code className="text-[10px]">
              update places set vendor_id = &apos;TON_UID&apos; where id = …
            </code>
          </p>
        )}
      </label>

      <fieldset className="space-y-1.5">
        <legend className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Durée
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((d) => {
            const active = durationMinutes === d.minutes;
            return (
              <button
                key={d.minutes}
                type="button"
                onClick={() => setDurationMinutes(d.minutes)}
                className={`rounded-xl py-2 text-sm font-semibold border transition-all active:scale-95 ${
                  active
                    ? 'bg-ds-pin text-white border-ds-pin'
                    : 'bg-ds-bg text-ds-text border-ds-text2/15'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p className="text-sm font-medium text-ds-accent bg-ds-accent/10 rounded-xl px-3 py-2">
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
        disabled={submitting || places.length === 0 || !title.trim()}
        className="w-full flex items-center justify-center gap-2 bg-ds-ok text-white font-bold text-sm py-3 rounded-xl shadow-md hover:bg-ds-ok/90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <>
            <Spinner size={18} className="animate-spin" />
            Publication…
          </>
        ) : (
          <>
            <Lightning size={18} weight="fill" />
            Publier le Flash Drop
          </>
        )}
      </button>
    </form>
  );
}
