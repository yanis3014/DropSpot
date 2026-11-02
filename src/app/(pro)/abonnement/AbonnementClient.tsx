'use client';

import { useId, useMemo, useState } from 'react';
import { Check, Minus, X } from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import PlanBadge from '@/components/pro/PlanBadge';
import StatusTag from '@/components/pro/StatusTag';
import { useVendorPlan } from '@/hooks/useVendorPlan';
import { useAuth } from '@/lib/hooks/useAuth';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { CONTACT_EMAIL, PRO_PRICE_LABEL } from '@/lib/pro/contact';
import { cn } from '@/lib/cn';
import {
  PLAN_FEATURES,
  PLAN_IDS,
  PLAN_LABELS,
  type PlanId,
} from '@/lib/pro/planFeatures';
import { OFFERS } from '@/lib/vitrine/offers';

const PLAN_TAGLINES: Record<PlanId, string> = Object.fromEntries(
  OFFERS.map((o) => [o.id, o.tagline])
) as Record<PlanId, string>;

function formatProUntil(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(iso));
}

function buildProMailto(opts: {
  displayName: string;
  cafeNames: string[];
  plan: PlanId;
}): string {
  const subject = encodeURIComponent(`Passer à l’offre ${PLAN_LABELS[opts.plan]}`);
  const cafes =
    opts.cafeNames.length > 0
      ? opts.cafeNames.join(', ')
      : 'aucun café listé';
  const body = encodeURIComponent(
    [
      'Bonjour,',
      '',
      `Je souhaite passer à l’offre ${PLAN_LABELS[opts.plan]}.`,
      `Compte : ${opts.displayName || '—'}`,
      `Établissements : ${cafes}`,
      '',
      'Merci,',
    ].join('\n')
  );
  return `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
}

export default function AbonnementClient() {
  const titleId = useId();
  const { places, activePlace } = useActivePlace();
  const { effectivePlan, proUntil, grid, loading } = useVendorPlan(
    true,
    activePlace?.id
  );
  const { displayName, user } = useAuth();
  const [modalPlan, setModalPlan] = useState<PlanId | null>(null);
  const modalOpen = modalPlan !== null;

  const cafeNames = useMemo(
    () => places.map((p) => p.name).filter(Boolean),
    [places]
  );

  const accountLabel =
    displayName?.trim() ||
    user?.email?.trim() ||
    'Compte Dropspot';

  const mailto = buildProMailto({
    displayName: accountLabel,
    cafeNames,
    plan: modalPlan ?? 'premium',
  });

  const currentIndex = PLAN_IDS.indexOf(effectivePlan);
  const upgrades = PLAN_IDS.slice(currentIndex + 1);
  const isPaid = effectivePlan !== 'presence';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-ds-bg text-ds-text">
      <header className="flex h-[84px] shrink-0 items-center border-b border-ds-line px-4 sm:px-8">
        <div>
          <h1 className="font-display m-0 text-[26px] font-extrabold tracking-tight">
            Abonnement
          </h1>
          <p className="m-0 mt-0.5 text-sm text-ds-text2">
            Pour tous tes établissements
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-5 lg:px-8 lg:py-6">
        {/* Current offer */}
        <section className="flex flex-col gap-4 rounded-[18px] border border-ds-line bg-ds-surface p-5 sm:flex-row sm:items-center sm:gap-4 sm:p-[20px_22px]">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[13px] font-bold text-ds-text2">
              Ton offre actuelle
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-display text-[28px] font-extrabold leading-none">
                {loading ? '…' : PLAN_LABELS[effectivePlan]}
              </span>
            </div>
            {isPaid && proUntil ? (
              <p className="m-0 text-[15px] text-ds-text2">
                Active jusqu&apos;au {formatProUntil(proUntil)}
              </p>
            ) : (
              <p className="m-0 text-[15px] text-ds-text2">
                {PLAN_TAGLINES[effectivePlan]}
              </p>
            )}
            {PRO_PRICE_LABEL ? (
              <p className="m-0 text-[15px] font-semibold text-ds-text">
                {PRO_PRICE_LABEL}
              </p>
            ) : null}
          </div>
          {!loading && upgrades.length > 0 ? (
            <div className="flex shrink-0 flex-wrap gap-2">
              {upgrades.map((plan) => (
                <Button
                  key={plan}
                  variant={plan === 'premium' ? 'main' : 'tonal'}
                  className="h-[52px] rounded-[14px] px-5 text-base"
                  onClick={() => setModalPlan(plan)}
                >
                  Passer à {PLAN_LABELS[plan]}
                </Button>
              ))}
            </div>
          ) : null}
        </section>

        {/* Comparison table */}
        <section className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface">
          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] items-center border-b border-ds-line sm:grid-cols-[minmax(0,1fr)_repeat(3,140px)]">
            <div className="px-4 py-4 sm:px-[22px]">
              <span className="font-display text-lg font-bold">Comparer</span>
            </div>
            {PLAN_IDS.map((plan) => (
              <div
                key={plan}
                className={cn(
                  'flex flex-col items-center gap-0.5 self-stretch justify-center py-3',
                  plan === effectivePlan && 'bg-ds-accentsoft'
                )}
              >
                <PlanBadge plan={plan} className="max-sm:px-1.5 max-sm:text-[10px]" />
                {plan === effectivePlan ? (
                  <span className="text-[12px] text-ds-text2">ton offre</span>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] items-center border-t border-ds-line sm:grid-cols-[minmax(0,1fr)_repeat(3,140px)]">
            <span className="px-4 py-3.5 text-[15px] sm:px-[22px]">
              Fiche sur la carte, horaires, infos confirmées par les clients
            </span>
            {PLAN_IDS.map((plan) => (
              <span
                key={plan}
                className={cn(
                  'flex items-center justify-center self-stretch text-ds-ok',
                  plan === effectivePlan && 'bg-ds-accentsoft'
                )}
              >
                <Check className="h-5 w-5" weight="bold" aria-label="Inclus" />
              </span>
            ))}
          </div>

          {PLAN_FEATURES.map((feature) => (
            <div
              key={feature.key}
              className="grid grid-cols-[minmax(0,1fr)_repeat(3,64px)] items-center border-t border-ds-line sm:grid-cols-[minmax(0,1fr)_repeat(3,140px)]"
            >
              <span className="flex flex-col gap-0.5 px-4 py-3.5 sm:px-[22px]">
                <span className="flex flex-wrap items-center gap-2 text-[15px]">
                  {feature.label}
                  {feature.soon ? (
                    <StatusTag variant="scheduled">Bientôt</StatusTag>
                  ) : null}
                </span>
                <span className="text-[13px] text-ds-text2">
                  {feature.description}
                </span>
              </span>
              {PLAN_IDS.map((plan) => {
                const included = grid[feature.key].includes(plan);
                return (
                  <span
                    key={plan}
                    className={cn(
                      'flex items-center justify-center self-stretch',
                      included ? 'text-ds-ok' : 'text-ds-text2',
                      plan === effectivePlan && 'bg-ds-accentsoft'
                    )}
                  >
                    {included ? (
                      <Check className="h-5 w-5" weight="bold" aria-label="Inclus" />
                    ) : (
                      <Minus className="h-5 w-5" aria-label="Non inclus" />
                    )}
                  </span>
                );
              })}
            </div>
          ))}
        </section>
      </div>

      {modalOpen && modalPlan ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setModalPlan(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative z-[71] flex w-full max-w-[520px] flex-col gap-3.5 rounded-t-[22px] bg-ds-surface p-6 shadow-ds sm:rounded-[22px] sm:p-7"
          >
            <div className="flex items-start justify-between gap-3">
              <h2
                id={titleId}
                className="font-display m-0 text-[22px] font-extrabold"
              >
                On active {PLAN_LABELS[modalPlan]} avec toi
              </h2>
              <button
                type="button"
                aria-label="Fermer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-surface2"
                onClick={() => setModalPlan(null)}
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <p className="m-0 text-[15px] leading-relaxed text-ds-text2">
              Pas de paiement dans l&apos;app. Écris-nous et on active
              l&apos;offre {PLAN_LABELS[modalPlan]} sur ton compte.
            </p>
            <p className="m-0 text-sm text-ds-text2">
              <span className="font-semibold text-ds-text">Compte :</span>{' '}
              {accountLabel}
            </p>
            {cafeNames.length > 0 ? (
              <p className="m-0 text-sm text-ds-text2">
                <span className="font-semibold text-ds-text">Cafés :</span>{' '}
                {cafeNames.join(', ')}
              </p>
            ) : null}
            {PRO_PRICE_LABEL ? (
              <p className="m-0 text-sm font-semibold">{PRO_PRICE_LABEL}</p>
            ) : null}
            <div className="flex flex-wrap justify-end gap-2.5 pt-1">
              <Button
                variant="outline"
                className="h-11 rounded-xl px-4 text-[15px]"
                onClick={() => setModalPlan(null)}
              >
                Annuler
              </Button>
              <a
                href={mailto}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-ds-accent px-[18px] text-[15px] font-bold text-ds-onaccent no-underline"
              >
                Écrire à {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
