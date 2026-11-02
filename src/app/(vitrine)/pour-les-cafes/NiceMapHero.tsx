import Image from "next/image";
import Link from "next/link";
import HeroClaimSearch from "./HeroClaimSearch";
import NiceMap from "./NiceMap";

/**
 * Bandeau sombre « Nice sur la carte » de la landing cafés.
 * Sombre dans les deux thèmes (jetons --night…), pleine largeur :
 * il est rendu en dehors du conteneur max-w-6xl de la page.
 * Composant serveur : aucune interactivité côté client.
 */
export default function NiceMapHero() {
  return (
    <section className="bg-ds-night text-ds-onnight">
      <div className="relative mx-auto max-w-6xl px-4 pb-14 sm:px-6 sm:pb-16">
        {/* En-tête : posé sur la carte en mobile (dégradé pour la lisibilité),
            en haut du bandeau dans le flux à partir de lg. */}
        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 bg-gradient-to-b from-ds-night to-transparent px-4 pt-5 pb-12 sm:px-6 lg:static lg:bg-none lg:px-0 lg:py-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <Image
              src="/icons/icon.svg"
              alt=""
              width={28}
              height={28}
              className="shrink-0"
              priority
            />
            <span className="font-display text-lg font-extrabold tracking-tight sm:text-xl">
              Dropspot
            </span>
            <span className="rounded-full bg-ds-night2 px-2.5 py-0.5 text-[12px] font-bold text-ds-nightaccenttext">
              Pour les cafés
            </span>
          </div>
          <Link
            href="/login?redirect=/dashboard-pro&espace=pro"
            prefetch={false}
            className="flex min-h-11 shrink-0 items-center rounded-md text-[15px] font-semibold text-ds-onnight2 no-underline hover:text-ds-onnight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-nightaccent"
          >
            Se connecter
          </Link>
        </header>

        <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-12">
          <NiceMap />

          <div className="relative -mt-10 lg:order-first lg:mt-0">
            <h1
              className="font-display text-[44px] leading-none font-extrabold tracking-tight text-balance sm:text-[52px] lg:text-[60px]"
              style={{ fontStretch: "85%" }}
            >
              Nice cherche un café. Le vôtre est sur la carte&nbsp;?
            </h1>
            <p className="mt-5 mb-0 max-w-[34em] text-[17px] leading-relaxed text-ds-onnight2 sm:text-[18px]">
              Les cafés de Nice sont déjà sur Dropspot. Retrouvez le vôtre et
              prenez-en la main en quelques minutes.
            </p>
            <div className="mt-7">
              <HeroClaimSearch />
            </div>
            <p className="mt-4 mb-0 text-[13px] text-ds-onnight2">
              Gratuit pour commencer · sans carte bancaire · le même compte que
              l’app Dropspot
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
