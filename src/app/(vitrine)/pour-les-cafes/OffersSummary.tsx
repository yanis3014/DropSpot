import { CaretDown } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/cn";
import { formatOfferPrice, OFFERS } from "@/lib/vitrine/offers";
import OffersSection from "./OffersSection";

/**
 * Les offres en une liste courte : les prix viennent de OFFERS /
 * formatOfferPrice, jamais écrits en dur. Le détail complet (cartes, pilote)
 * se déplie via un <details> natif, sans JS.
 */
export default function OffersSummary() {
  return (
    <section id="offres" className="py-16 sm:py-20">
      <h2 className="font-display m-0 text-[32px] font-extrabold leading-[1.08] tracking-tight text-balance text-ds-text sm:text-[40px]">
        Les offres
      </h2>

      <ul className="m-0 mt-8 list-none p-0">
        {OFFERS.map((offer) => {
          const paid = offer.priceHt !== null && offer.priceHt > 0;
          return (
            <li
              key={offer.id}
              className={cn(
                "flex items-center justify-between gap-4 border-t border-ds-line py-4 last:border-b",
                offer.highlighted &&
                  "rounded-[14px] border-transparent bg-ds-accentsoft px-4"
              )}
            >
              <div className="min-w-0">
                <p className="m-0 flex flex-wrap items-center gap-x-2.5 text-[17px] font-bold text-ds-text">
                  {offer.name}
                  {offer.highlighted ? (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-ds-accenttext">
                      le plus complet
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 mb-0 text-[14px] text-ds-text2">
                  {offer.tagline}
                </p>
              </div>
              <p className="m-0 flex shrink-0 items-baseline gap-1.5">
                <span className="font-display text-[20px] font-extrabold text-ds-text">
                  {formatOfferPrice(offer)}
                </span>
                {paid ? (
                  <span className="text-[12px] text-ds-text2">HT/mois</span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>

      <details className="group mt-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-[15px] font-semibold text-ds-accenttext [&::-webkit-details-marker]:hidden">
          <CaretDown
            size={16}
            weight="bold"
            aria-hidden
            className="shrink-0 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none"
          />
          Comparer le détail des offres
        </summary>
        <div className="pt-6">
          <OffersSection showHeading={false} />
        </div>
      </details>
    </section>
  );
}
