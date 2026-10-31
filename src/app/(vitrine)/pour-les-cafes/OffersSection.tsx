import { Check } from "@phosphor-icons/react/ssr";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { CONTACT_EMAIL } from "@/lib/pro/contact";
import {
  ANNUAL_FREE_MONTHS,
  annualPriceHt,
  formatEuros,
  formatOfferPrice,
  OFFERS,
  SHOW_ANNUAL_NOTE,
  type Offer,
} from "@/lib/vitrine/offers";
import ClaimCafeButton from "./ClaimCafeButton";

const PILOT_POINTS = [
  "Une vraie personne qui répond",
  "Votre fiche prête en quelques minutes",
  "Vos premiers chiffres dès le premier mois",
] as const;

function offerMailto(offer: Offer): string {
  const subject = `Dropspot : offre ${offer.name}`;
  const body = `Bonjour,\n\nJe gère le café : \nJe souhaite en savoir plus sur l'offre ${offer.name}.\n\nMerci`;
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function OfferCard({ offer }: { offer: Offer }) {
  const paid = offer.priceHt !== null && offer.priceHt > 0;
  return (
    <li
      className={cn(
        "relative flex flex-col rounded-[24px] bg-ds-surface p-7",
        offer.highlighted
          ? "border-2 border-ds-accent"
          : "border border-ds-line"
      )}
    >
      {offer.highlighted ? (
        <span className="absolute -top-3 left-7 rounded-full bg-ds-accent px-3 py-1 text-[12px] font-bold text-ds-onaccent">
          Le plus complet
        </span>
      ) : null}
      <h3 className="font-display m-0 text-[24px] font-extrabold tracking-tight text-ds-text">
        {offer.name}
      </h3>
      <p className="mt-1 mb-0 text-[15px] text-ds-text2">{offer.tagline}</p>
      <p className="mt-5 mb-0 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cn(
            "font-display font-extrabold tracking-tight text-ds-text",
            offer.priceHt === null ? "text-[24px]" : "text-[40px] leading-none"
          )}
        >
          {formatOfferPrice(offer)}
        </span>
        {paid ? (
          <span className="text-[14px] text-ds-text2">HT / mois</span>
        ) : null}
      </p>
      {SHOW_ANNUAL_NOTE && paid && offer.priceHt !== null ? (
        <p className="mt-2 mb-0 text-[13px] text-ds-text2">
          ou {formatEuros(annualPriceHt(offer.priceHt))} HT par an (
          {ANNUAL_FREE_MONTHS} mois offerts)
        </p>
      ) : null}
      {offer.includesPrevious ? (
        <p className="mt-6 mb-0 text-[14px] font-bold text-ds-text">
          {offer.includesPrevious}
        </p>
      ) : null}
      <ul
        className={cn(
          "m-0 flex list-none flex-col gap-3 p-0",
          offer.includesPrevious ? "mt-3" : "mt-6"
        )}
      >
        {offer.features.map((f) => (
          <li key={f.label} className="flex items-start gap-2.5 text-[14px] leading-snug">
            <Check
              size={18}
              weight="bold"
              aria-hidden
              className={cn(
                "mt-px shrink-0",
                f.available ? "text-ds-ok" : "text-ds-text2"
              )}
            />
            <span className={f.available ? "text-ds-text" : "text-ds-text2"}>
              {f.label}
              {!f.available ? (
                <span className="ml-2 inline-block rounded-full bg-ds-surface2 px-2 py-0.5 align-middle text-[11px] font-semibold text-ds-text2">
                  Bientôt
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-7">
        {offer.id === "presence" ? (
          <ClaimCafeButton label="Commencer gratuitement" className="block" />
        ) : (
          <a
            href={offerMailto(offer)}
            className="block no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent"
          >
            <Button
              variant={offer.highlighted ? "main" : "outline"}
              className="w-full"
              tabIndex={-1}
            >
              En parler avec nous
            </Button>
          </a>
        )}
      </div>
    </li>
  );
}

export default function OffersSection() {
  return (
    <section id="offres" className="border-t border-ds-line py-16 sm:py-20">
      <h2 className="font-display m-0 text-[28px] font-extrabold tracking-tight text-balance text-ds-text sm:text-[36px]">
        Trois offres, selon ce dont vous avez besoin
      </h2>
      <p className="mt-3 mb-0 max-w-[40em] text-[16px] leading-relaxed text-ds-text2 sm:text-[17px]">
        Commencez gratuitement. Passez à l’offre supérieure quand vous voulez.
      </p>
      <ul className="mt-12 m-0 grid list-none grid-cols-1 gap-6 p-0 lg:grid-cols-3">
        {OFFERS.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </ul>

      <div className="mt-10 grid gap-6 rounded-[24px] bg-ds-text p-8 text-ds-bg lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="min-w-0">
          <h3 className="font-display m-0 text-[22px] font-extrabold tracking-tight text-balance sm:text-[26px]">
            On lance Dropspot à Nice avec une trentaine de cafés
          </h3>
          <p className="mt-3 mb-0 max-w-[40em] text-[15px] leading-relaxed opacity-85 sm:text-[16px]">
            Pendant le pilote, on active votre offre avec vous, directement par
            e-mail. Les premiers cafés nous aident à construire l’outil, et on
            les écoute.
          </p>
          <ul className="mt-5 m-0 flex list-none flex-col gap-2 p-0 sm:flex-row sm:flex-wrap sm:gap-x-6">
            {PILOT_POINTS.map((point) => (
              <li key={point} className="flex items-center gap-2 text-[14px] font-semibold">
                <Check size={16} weight="bold" aria-hidden className="shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <ClaimCafeButton />
      </div>

      <p className="mt-6 mb-0 text-[13px] text-ds-text2">
        Prix hors taxes, par café et par mois. Les fonctions marquées « Bientôt »
        arrivent pendant le pilote.
      </p>
    </section>
  );
}
