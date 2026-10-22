"use client";

import { FormEvent, useId, useMemo, useState } from "react";
import { Copy, Lock, X } from "@phosphor-icons/react";
import type { Place } from "@/lib/api/places";
import {
  insertFlashDrop,
  updateFlashDrop,
  type FlashDrop,
  type FlashDropKind,
} from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import {
  buildDefaultDropFormState,
  formatDropDurationHint,
  getDropSubmitLabel,
  translateDropWriteError,
  validateDropFormState,
  type DropFormState,
} from "@/app/(pro)/dashboard-pro/lib/proDrops/dropForm";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import ProLock from "@/components/pro/ProLock";
import ProEmptyState from "@/components/pro/ProEmptyState";
import { cn } from "@/lib/cn";

export interface DropFormProps {
  place: Place;
  mode?: "create" | "edit";
  dropId?: string;
  initialState?: DropFormState;
  copiedFromBanner?: string | null;
  role?: string | null;
  hasPro?: boolean;
  onCancel?: () => void;
  onSaved?: (drop: FlashDrop) => void;
  onUnlockPro?: () => void;
}

const KIND_OPTIONS: { id: FlashDropKind; label: string }[] = [
  { id: "discount", label: "Réduction" },
  { id: "offer", label: "Offre" },
  { id: "special_price", label: "Prix spécial" },
  { id: "activity", label: "Activité" },
];

export default function DropForm({
  place,
  mode = "create",
  dropId,
  initialState,
  copiedFromBanner,
  role,
  hasPro,
  onCancel,
  onSaved,
  onUnlockPro,
}: DropFormProps) {
  const radioName = useId();
  const [state, setState] = useState<DropFormState>(
    () => initialState ?? buildDefaultDropFormState()
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isVerified = place.verification_status === "verified";

  const durationHint = useMemo(
    () => formatDropDurationHint(state.startsAtLocal, state.endsAtLocal),
    [state.startsAtLocal, state.endsAtLocal]
  );

  const submitLabel = useMemo(
    () => getDropSubmitLabel(state.startsAtLocal),
    [state.startsAtLocal]
  );

  if (!isVerified) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-[18px] border border-ds-line bg-ds-surface p-8">
        <ProEmptyState
          icon={<Lock size={32} weight="bold" aria-hidden />}
          title="Drops bientôt disponibles"
          description="Dès que la vérification est terminée, tu pourras publier ton premier drop."
        />
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const validation = validateDropFormState(state, {
      placeId: place.id,
      vendorId: place.vendor_id ?? "",
    });

    if (!validation.valid || !validation.payload) {
      setError(validation.error ?? "Formulaire invalide.");
      return;
    }

    setSubmitting(true);
    try {
      const saved =
        mode === "edit" && dropId
          ? await updateFlashDrop(dropId, validation.payload)
          : await insertFlashDrop(validation.payload);
      onSaved?.(saved);
    } catch (err) {
      setError(translateDropWriteError(err, { role, hasPro }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface shadow-ds"
      aria-label={
        mode === "edit"
          ? `Modifier le drop pour ${place.name}`
          : `Nouveau drop pour ${place.name}`
      }
    >
      {/* En-tête */}
      <div className="flex items-center justify-between border-b border-ds-line px-5 py-5 lg:px-7">
        <div>
          <h1 className="font-display m-0 text-2xl font-extrabold text-ds-text">
            {mode === "edit"
              ? `Modifier le drop pour ${place.name}`
              : `Nouveau drop pour ${place.name}`}
          </h1>
          <span className="text-[13px] font-medium text-ds-text2">
            pour {place.name}
          </span>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Fermer"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-transparent text-ds-text hover:bg-ds-surface2"
          >
            <X size={20} weight="bold" aria-hidden />
          </button>
        ) : null}
      </div>

      {/* Corps du formulaire */}
      <div className="flex flex-col gap-[18px] px-5 py-5 lg:px-7">
        {copiedFromBanner ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-ds-surface2 px-3.5 py-2.5 text-sm font-medium text-ds-text">
            <Copy size={16} weight="bold" className="shrink-0" aria-hidden />
            <span>{copiedFromBanner}</span>
          </div>
        ) : null}

        {/* Titre */}
        <label className="flex flex-col gap-2 text-sm font-bold text-ds-text">
          <span>Titre</span>
          <input
            type="text"
            required
            maxLength={60}
            value={state.title}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                title: e.target.value.slice(0, 60),
              }))
            }
            placeholder="−20 % sur les boissons chaudes"
            className="h-11 w-full rounded-xl border border-ds-line bg-ds-bg px-3 text-[15px] font-medium text-ds-text outline-none focus:border-ds-accent"
          />
        </label>

        {/* Type (kind en chips) */}
        <div className="flex flex-col gap-2 text-sm font-bold text-ds-text">
          <span>Type</span>
          <div className="flex flex-wrap gap-2">
            {KIND_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                active={state.kind === opt.id}
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    kind: opt.id,
                    discountUnit:
                      opt.id === "special_price" ? "eur" : prev.discountUnit,
                  }))
                }
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>

        {/* Réduction : discount_value + bascule % / € */}
        {state.kind === "discount" ? (
          <div className="flex flex-col gap-2 text-sm font-bold text-ds-text">
            <span>Réduction</span>
            <div className="flex items-center gap-2.5">
              <input
                type="number"
                inputMode="decimal"
                aria-label="Montant"
                min={1}
                max={state.discountUnit === "percent" ? 90 : undefined}
                value={state.discountValue}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    discountValue: e.target.value,
                  }))
                }
                className="h-11 w-[100px] rounded-xl border border-ds-line bg-ds-bg px-3 text-[15px] font-medium tabular-nums text-ds-text outline-none focus:border-ds-accent"
              />
              <div
                className="inline-flex gap-0.5 rounded-xl bg-ds-surface2 p-[3px]"
                role="group"
                aria-label="Unité de réduction"
              >
                <button
                  type="button"
                  aria-pressed={state.discountUnit === "percent"}
                  onClick={() =>
                    setState((prev) => ({ ...prev, discountUnit: "percent" }))
                  }
                  className={cn(
                    "h-9 min-w-[44px] rounded-[9px] px-3 text-sm font-bold",
                    state.discountUnit === "percent"
                      ? "bg-ds-surface text-ds-text shadow-sm"
                      : "bg-transparent text-ds-text2"
                  )}
                >
                  %
                </button>
                <button
                  type="button"
                  aria-pressed={state.discountUnit === "eur"}
                  onClick={() =>
                    setState((prev) => ({ ...prev, discountUnit: "eur" }))
                  }
                  className={cn(
                    "h-9 min-w-[44px] rounded-[9px] px-3 text-sm font-bold",
                    state.discountUnit === "eur"
                      ? "bg-ds-surface text-ds-text shadow-sm"
                      : "bg-transparent text-ds-text2"
                  )}
                >
                  €
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Début / Fin en datetime-local (Europe/Paris) */}
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-bold text-ds-text">
            <span>Début</span>
            <input
              type="datetime-local"
              aria-label="Début"
              required
              value={state.startsAtLocal}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  startsAtLocal: e.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border border-ds-line bg-ds-bg px-3 text-[15px] font-medium tabular-nums text-ds-text outline-none focus:border-ds-accent"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm font-bold text-ds-text">
            <span>Fin</span>
            <input
              type="datetime-local"
              aria-label="Fin"
              required
              value={state.endsAtLocal}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  endsAtLocal: e.target.value,
                }))
              }
              className="h-11 w-full rounded-xl border border-ds-line bg-ds-bg px-3 text-[15px] font-medium tabular-nums text-ds-text outline-none focus:border-ds-accent"
            />
          </label>
        </div>

        {durationHint ? (
          <span className="-mt-2.5 text-[13px] font-medium text-ds-text2">
            {durationHint}
          </span>
        ) : null}

        {/* Quantité */}
        <div className="flex flex-col gap-2 text-sm font-bold text-ds-text">
          <span>Quantité</span>
          <div className="flex flex-wrap items-center gap-[18px] font-semibold">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={radioName}
                checked={state.quantityMode === "limited"}
                onChange={() =>
                  setState((prev) => ({ ...prev, quantityMode: "limited" }))
                }
                className="h-[18px] w-[18px] accent-ds-accent"
              />
              <span>Limitée à</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              aria-label="Nombre de places"
              disabled={state.quantityMode === "unlimited"}
              value={state.maxUses}
              onChange={(e) =>
                setState((prev) => ({
                  ...prev,
                  quantityMode: "limited",
                  maxUses: e.target.value,
                }))
              }
              className="h-11 w-20 rounded-xl border border-ds-line bg-ds-bg px-3 text-[15px] font-medium tabular-nums text-ds-text outline-none focus:border-ds-accent disabled:opacity-50"
            />
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name={radioName}
                checked={state.quantityMode === "unlimited"}
                onChange={() =>
                  setState((prev) => ({ ...prev, quantityMode: "unlimited" }))
                }
                className="h-[18px] w-[18px] accent-ds-accent"
              />
              <span>Sans limite</span>
            </label>
          </div>
        </div>

        {/* Conditions */}
        <label className="flex flex-col gap-2 text-sm font-bold text-ds-text">
          <span>Conditions</span>
          <textarea
            rows={2}
            value={state.conditions}
            onChange={(e) =>
              setState((prev) => ({ ...prev, conditions: e.target.value }))
            }
            className="h-16 w-full resize-none rounded-xl border border-ds-line bg-ds-bg px-3 py-2.5 text-[15px] font-medium text-ds-text outline-none focus:border-ds-accent"
          />
        </label>

        {/* Répéter chaque semaine : toujours verrouillé (ProLock) */}
        <ProLock
          variant="row"
          label="Répéter chaque semaine"
          onUnlock={onUnlockPro}
          className="border-dashed"
        />

        {error ? (
          <p
            role="alert"
            className="m-0 rounded-xl bg-ds-dangersoft px-3.5 py-2.5 text-sm font-semibold text-ds-danger"
          >
            {error}
          </p>
        ) : null}
      </div>

      {/* Pied de page : Annuler, puis Programmer ou Publier à HH:MM */}
      <div className="flex items-center justify-between gap-3 border-t border-ds-line px-5 py-4 lg:px-7">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-xl bg-transparent px-[18px] text-[15px] font-bold text-ds-text hover:bg-ds-surface2"
        >
          Annuler
        </button>
        <Button
          type="submit"
          variant="main"
          disabled={submitting || !state.title.trim()}
          className="h-11 rounded-xl px-[18px] text-[15px]"
        >
          {submitting ? "Enregistrement…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
