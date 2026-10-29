'use client';

import { useId, useMemo, useRef, useState } from 'react';
import {
  Check,
  Lock,
  Minus,
  X,
} from '@phosphor-icons/react';
import Button from '@/components/ui/Button';
import PlanBadge from '@/components/pro/PlanBadge';
import StatusTag from '@/components/pro/StatusTag';
import { useVendorPlan } from '@/hooks/useVendorPlan';
import { useAuth } from '@/lib/hooks/useAuth';
import { useActivePlace } from '@/app/(pro)/hooks/useActivePlace';
import { CONTACT_EMAIL, PRO_PRICE_LABEL } from '@/lib/pro/contact';
import { cn } from '@/lib/cn';

type CompareRow = {
  label: string;
  freeIncluded: boolean;
};

const COMPARE_ROWS: CompareRow[] = [
  {
    label: 'Fiche, horaires et horaires exceptionnels',
    freeIncluded: true,
  },
  {
    label: 'Proposer ou contester une info',
    freeIncluded: true,
  },
  {
    label: 'Drops flash ponctuels',
    freeIncluded: true,
  },
  {
    label: 'Validation au comptoir (QR ou code)',
    freeIncluded: true,
  },
  {
    label: 'Équipiers qui valident les drops',
    freeIncluded: true,
  },
  {
    label: 'Drops récurrents (chaque semaine)',
    freeIncluded: false,
  },
  {
    label: 'Rôle Responsable dans l’équipe',
    freeIncluded: false,
  },
  {
    label: 'Galerie complète et vidéo',
    freeIncluded: false,
  },
  {
    label: 'Statistiques détaillées (30 et 90 jours)',
    freeIncluded: false,
  },
];

const PRO_UNLOCK_CARDS: {
  title: string;
  text: string;
  soon?: boolean;
}[] = [
  {
    title: 'Drops récurrents',
    text: 'Ton happy hour du jeudi se publie tout seul chaque semaine.',
    soon: true,
  },
  {
    title: 'Rôle Responsable',
    text: 'Un membre de l’équipe peut créer et arrêter des drops.',
  },
  {
    title: 'Galerie complète',
    text: 'Plus de photos et une courte vidéo sur ta fiche.',
  },
  {
    title: 'Statistiques détaillées',
    text: 'Tes heures de pointe, le détail de chaque drop et ce que cherchent tes visiteurs.',
  },
];

const FREE_OFFER_BLURB =
  "Fiche, drops ponctuels, validation au comptoir et une équipe d'équipiers.";

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
}): string {
  const subject = encodeURIComponent('Activer Dropspot Pro');
  const cafes =
    opts.cafeNames.length > 0
      ? opts.cafeNames.join(', ')
      : 'aucun café listé';
  const body = encodeURIComponent(
    [
      'Bonjour,',
      '',
      'Je souhaite activer l’offre Pro.',
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
  const compareRef = useRef<HTMLElement>(null);
  const { plan, hasPro, proUntil, loading } = useVendorPlan();
  const { displayName, user } = useAuth();
  const { places } = useActivePlace();
  const [modalOpen, setModalOpen] = useState(false);

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
  });

  const scrollToCompare = () => {
    compareRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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

      <div className="flex min-h-0 flex-1 flex-col gap-5 px-4 py-5 lg:flex-row lg:gap-5 lg:px-8 lg:py-6">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {/* Current offer */}
          <section className="flex flex-col gap-4 rounded-[18px] border border-ds-line bg-ds-surface p-5 sm:flex-row sm:items-center sm:gap-4 sm:p-[20px_22px]">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <span className="text-[13px] font-bold text-ds-text2">
                Ton offre actuelle
              </span>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="font-display text-[28px] font-extrabold leading-none">
                  {loading ? '…' : hasPro ? 'Pro' : 'Gratuit'}
                </span>
                {!loading ? <PlanBadge plan={plan} /> : null}
              </div>
              {hasPro && proUntil ? (
                <p className="m-0 text-[15px] text-ds-text2">
                  Actif jusqu&apos;au {formatProUntil(proUntil)}
                </p>
              ) : (
                <p className="m-0 text-[15px] text-ds-text2">{FREE_OFFER_BLURB}</p>
              )}
              {PRO_PRICE_LABEL ? (
                <p className="m-0 text-[15px] font-semibold text-ds-text">
                  {PRO_PRICE_LABEL}
                </p>
              ) : null}
            </div>
            {!hasPro ? (
              <Button
                variant="main"
                className="h-[52px] shrink-0 rounded-[14px] px-5 text-base"
                onClick={() => setModalOpen(true)}
              >
                Passer au Pro
              </Button>
            ) : null}
          </section>

          {/* Comparison table */}
          <section
            ref={compareRef}
            className="overflow-hidden rounded-[18px] border border-ds-line bg-ds-surface"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center border-b border-ds-line sm:grid-cols-[minmax(0,1fr)_180px_180px]">
              <div className="px-4 py-4 sm:px-[22px]">
                <span className="font-display text-lg font-bold">Comparer</span>
              </div>
              <div className="flex flex-col items-center gap-0.5 py-3">
                <PlanBadge plan="free" />
                <span className="text-[13px] text-ds-text2">ton offre</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-0.5 self-stretch bg-ds-accentsoft py-3">
                <PlanBadge plan="pro" />
              </div>
            </div>

            {COMPARE_ROWS.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-[minmax(0,1fr)_88px_88px] items-center border-t border-ds-line sm:grid-cols-[minmax(0,1fr)_180px_180px]"
              >
                <span className="px-4 py-3.5 text-[15px] sm:px-[22px]">
                  {row.label}
                </span>
                <span
                  className={cn(
                    'flex items-center justify-center',
                    row.freeIncluded ? 'text-ds-ok' : 'text-ds-text2'
                  )}
                >
                  {row.freeIncluded ? (
                    <Check
                      className="h-5 w-5"
                      weight="bold"
                      aria-label="Inclus"
                    />
                  ) : (
                    <Minus className="h-5 w-5" aria-label="Non inclus" />
                  )}
                </span>
                <span className="flex items-center justify-center self-stretch bg-ds-accentsoft text-ds-ok">
                  <Check
                    className="h-5 w-5"
                    weight="bold"
                    aria-label="Inclus"
                  />
                </span>
              </div>
            ))}
          </section>
        </div>

        {/* Unlocked with Pro */}
        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-[360px]">
          <h2 className="font-display m-0 text-lg font-bold">
            Débloqué avec Pro
          </h2>
          {PRO_UNLOCK_CARDS.map((card) => (
            <div
              key={card.title}
              className="flex flex-col gap-2.5 rounded-[18px] border border-ds-line bg-ds-surface p-4"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-ds-surface2 text-ds-text2">
                  <Lock className="h-4 w-4" weight="bold" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 font-bold">{card.title}</span>
                {card.soon ? (
                  <StatusTag variant="scheduled">Bientôt</StatusTag>
                ) : (
                  <PlanBadge plan="pro" />
                )}
              </div>
              <p className="m-0 text-sm leading-snug text-ds-text2">
                {card.text}
              </p>
            </div>
          ))}
          <Button
            variant="tonal"
            className="h-11 rounded-xl text-[15px]"
            onClick={scrollToCompare}
          >
            Voir les détails de Pro
          </Button>
        </aside>
      </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Fermer"
            onClick={() => setModalOpen(false)}
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
                On active Pro avec toi
              </h2>
              <button
                type="button"
                aria-label="Fermer"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ds-surface2"
                onClick={() => setModalOpen(false)}
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>
            <p className="m-0 text-[15px] leading-relaxed text-ds-text2">
              Pas de paiement dans l&apos;app. Écris-nous et on active Pro sur
              ton compte.
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
                onClick={() => setModalOpen(false)}
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
