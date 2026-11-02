"use client";

import { useState, useTransition } from "react";
import { Check } from "@phosphor-icons/react";
import { setPlanFeatureAction } from "@/app/admin/(console)/actions";
import { cn } from "@/lib/cn";
import {
  PLAN_FEATURES,
  PLAN_IDS,
  PLAN_LABELS,
  removedPlans,
  type PlanFeature,
  type PlanFeatureGrid,
  type PlanId,
} from "@/lib/pro/planFeatures";

type RowMessage = { text: string; error: boolean } | null;

function FeatureRow({
  feature,
  saved,
  accounts,
  onSaved,
}: {
  feature: PlanFeature;
  saved: PlanId[];
  accounts: Record<PlanId, number>;
  onSaved: (plans: PlanId[]) => void;
}) {
  const [draft, setDraft] = useState<PlanId[]>(saved);
  const [message, setMessage] = useState<RowMessage>(null);
  const [pending, startTransition] = useTransition();

  const dirty = PLAN_IDS.some((p) => draft.includes(p) !== saved.includes(p));
  const losing = removedPlans(saved, draft);
  const losingAccounts = losing.reduce((sum, p) => sum + accounts[p], 0);

  const toggle = (plan: PlanId) => {
    setMessage(null);
    setDraft((prev) =>
      PLAN_IDS.filter((p) => (p === plan ? !prev.includes(p) : prev.includes(p)))
    );
  };

  const save = () =>
    startTransition(async () => {
      const res = await setPlanFeatureAction({ feature: feature.key, plans: draft });
      if (res.ok) {
        onSaved(draft);
        setMessage({ text: "Enregistré.", error: false });
      } else {
        setMessage({ text: res.error, error: true });
      }
    });

  return (
    <li className="flex flex-col gap-3 border-b border-ds-line px-4 py-4 last:border-b-0 md:grid md:grid-cols-[minmax(0,1fr)_repeat(3,96px)] md:items-center md:gap-0">
      <div className="flex min-w-0 flex-col gap-0.5 md:pr-4">
        <span className="flex flex-wrap items-center gap-2 font-semibold text-ds-text">
          {feature.label}
          {feature.soon ? (
            <span className="rounded-lg bg-ds-surface2 px-2 py-0.5 text-[11px] font-bold text-ds-text2">
              Bientôt dans l&apos;app
            </span>
          ) : null}
        </span>
        <span className="text-[13px] text-ds-text2">{feature.description}</span>
      </div>

      <div className="flex gap-2 md:contents">
        {PLAN_IDS.map((plan) => {
          const on = draft.includes(plan);
          return (
            <div key={plan} className="flex flex-1 justify-center md:flex-none">
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                aria-label={`${feature.label} dans ${PLAN_LABELS[plan]}`}
                onClick={() => toggle(plan)}
                className={cn(
                  "flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border-[1.5px] text-[13px] font-bold md:w-12",
                  on
                    ? "border-ds-admin bg-ds-admin text-ds-onadmin"
                    : "border-ds-line bg-ds-bg text-ds-text2"
                )}
              >
                {on ? <Check size={16} weight="bold" aria-hidden /> : null}
                <span className="md:sr-only">{PLAN_LABELS[plan]}</span>
              </button>
            </div>
          );
        })}
      </div>

      {dirty || message ? (
        <div className="flex flex-wrap items-center gap-3 md:col-span-4 md:pt-3">
          {dirty ? (
            <>
              <p className="min-w-0 flex-1 text-[13px] text-ds-text2">
                {draft.length === 0
                  ? "Aucune offre : la fonction sera fermée à tous les cafés."
                  : losingAccounts > 0
                    ? `${losingAccounts} compte(s) ${losing.map((p) => PLAN_LABELS[p]).join(" et ")} perdront l'accès.`
                    : "Aucun café ne perd l'accès."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setDraft(saved);
                  setMessage(null);
                }}
                className="h-9 rounded-xl border border-ds-line bg-ds-surface px-3 text-[13px] font-bold text-ds-text"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={save}
                className="h-9 rounded-xl bg-ds-admin px-4 text-[13px] font-bold text-ds-onadmin disabled:opacity-50"
              >
                {pending ? "…" : "Enregistrer"}
              </button>
            </>
          ) : null}
          {message && !dirty ? (
            <p
              role="status"
              className={cn(
                "text-[13px] font-semibold",
                message.error ? "text-ds-danger" : "text-ds-ok"
              )}
            >
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/** Editable grid: one row per pro feature, one box per offer. */
export default function FeatureGrid({
  initialGrid,
  accounts,
}: {
  initialGrid: PlanFeatureGrid;
  accounts: Record<PlanId, number>;
}) {
  const [grid, setGrid] = useState<PlanFeatureGrid>(initialGrid);

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
        <div className="hidden border-b border-ds-line bg-ds-surface2 px-4 py-3 text-[13px] font-bold text-ds-text2 md:grid md:grid-cols-[minmax(0,1fr)_repeat(3,96px)] md:items-center">
          <span>Fonction</span>
          {PLAN_IDS.map((plan) => (
            <span key={plan} className="flex flex-col items-center leading-tight">
              <span className="text-ds-text">{PLAN_LABELS[plan]}</span>
              <span className="text-[11px] font-semibold">
                {accounts[plan]} compte(s)
              </span>
            </span>
          ))}
        </div>
        <ul>
          <li className="flex flex-col gap-0.5 border-b border-ds-line px-4 py-4">
            <span className="font-semibold text-ds-text">
              Fiche sur la carte, horaires, infos des clients
            </span>
            <span className="text-[13px] text-ds-text2">
              Toujours incluses dans les trois offres : c&apos;est le fait d&apos;être sur Dropspot.
            </span>
          </li>
          {PLAN_FEATURES.map((feature) => (
            <FeatureRow
              key={feature.key}
              feature={feature}
              saved={grid[feature.key]}
              accounts={accounts}
              onSaved={(plans) =>
                setGrid((prev) => ({ ...prev, [feature.key]: plans }))
              }
            />
          ))}
        </ul>
      </div>
      <p className="text-[13px] text-ds-text2">
        Comptes par offre en vigueur : {PLAN_IDS.map((p) => `${PLAN_LABELS[p]} ${accounts[p]}`).join(" · ")}.
        Une offre payante terminée repasse en Présence. Chaque changement est noté dans le Journal.
      </p>
    </div>
  );
}
