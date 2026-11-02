import type { Metadata } from "next";
import Link from "next/link";
import { ChartBar, MapPin } from "@phosphor-icons/react/ssr";
import { CONTACT_EMAIL } from "@/lib/pro/contact";
import CafeCardPreview from "./CafeCardPreview";
import ClaimCafeButton from "./ClaimCafeButton";
import DayCurve from "./DayCurve";
import FaqSection from "./FaqSection";
import NiceMapHero from "./NiceMapHero";
import OffersSummary from "./OffersSummary";
import PitchVideo from "./PitchVideo";

const FOCUS_RING =
  "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent";

/** Titre de section commun à la page. */
const SECTION_TITLE =
  "font-display m-0 text-[32px] font-extrabold leading-[1.08] tracking-tight text-balance text-ds-text sm:text-[40px]";

const TITLE = "Dropspot pour les cafés de Nice";
const DESCRIPTION =
  "Faites découvrir votre café aux Niçois qui cherchent où travailler, se poser ou sortir. Fiche, événements, chiffres de passage : gratuit pour commencer.";

// Retirer noindex au lancement
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/vitrine/pub-pro-poster.jpg" }],
  },
  robots: { index: false, follow: false },
};

const GESTURES = [
  {
    n: "1",
    title: "Retrouvez votre café",
    body: "Les cafés de Nice sont déjà sur la carte. Le vôtre n’y est pas ? Ajoutez-le.",
  },
  {
    n: "2",
    title: "On vérifie que c’est bien vous",
    body: "Une preuve simple. Personne d’autre ne peut toucher à votre fiche.",
  },
  {
    n: "3",
    title: "Publiez votre premier drop",
    body: "Titre, date, places. Votre équipe valide les participants au comptoir avec un QR code.",
  },
] as const;

export default function PourLesCafesPage() {
  return (
    <>
      {/* Bandeau sombre pleine largeur, hors du conteneur max-w-6xl */}
      <NiceMapHero />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* 1. L'heure creuse */}
        <DayCurve />

        {/* 2. La vidéo */}
        <section className="py-16 sm:py-20">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
            <h2 className="font-display m-0 max-w-[18em] text-[24px] font-extrabold leading-[1.15] tracking-tight text-balance text-ds-text sm:text-[28px]">
              Un mardi, 15 h, dans un café de Nice
            </h2>
            <PitchVideo />
          </div>
        </section>

        {/* 3. La fiche exemple */}
        <section className="py-16 sm:py-20">
          <h2 className={SECTION_TITLE}>
            Ce que voient les Niçois quand ils vous cherchent
          </h2>
          <div className="mt-10 grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
            <CafeCardPreview />
            <div>
              <p className="m-0 max-w-[32em] text-[16px] leading-relaxed text-ds-text2">
                Les clients confirment sur place le Wi-Fi, les prises,
                l’ambiance. Votre fiche reste juste sans que vous la
                surveilliez.
              </p>
              <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
                <li className="flex items-start gap-3">
                  <MapPin
                    size={24}
                    weight="duotone"
                    aria-hidden
                    className="mt-0.5 shrink-0 text-ds-accenttext"
                  />
                  <span className="text-[16px] leading-relaxed text-ds-text">
                    On vous trouve par envie : travailler au calme, un bon
                    matcha, une terrasse.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <ChartBar
                    size={24}
                    weight="duotone"
                    aria-hidden
                    className="mt-0.5 shrink-0 text-ds-accenttext"
                  />
                  <span className="text-[16px] leading-relaxed text-ds-text">
                    Vous voyez combien de personnes ont vu votre café, et
                    combien sont venues.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 4. Trois gestes */}
        <section className="py-16 sm:py-20">
          <h2 className={SECTION_TITLE}>Trois gestes, pas plus</h2>
          <ol className="m-0 mt-8 max-w-2xl list-none p-0 lg:grid lg:max-w-none lg:grid-cols-3 lg:gap-10">
            {GESTURES.map((gesture, i) => (
              <li
                key={gesture.n}
                className={
                  i === GESTURES.length - 1
                    ? "flex gap-4 border-t border-b border-ds-line py-4 lg:border-b-0"
                    : "flex gap-4 border-t border-ds-line py-4"
                }
              >
                <span className="font-display w-7 shrink-0 text-[30px] font-extrabold leading-none text-ds-accent">
                  {gesture.n}
                </span>
                <div>
                  <h3 className="m-0 text-[17px] font-bold text-ds-text">
                    {gesture.title}
                  </h3>
                  <p className="mt-1 mb-0 text-[15px] leading-relaxed text-ds-text2">
                    {gesture.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* 5. La promesse, pleine largeur comme le bandeau du haut */}
      <section className="bg-ds-night py-12 text-ds-onnight sm:py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="font-display m-0 max-w-[22em] text-[28px] font-bold text-balance sm:text-[36px]">
            Pas de pub à acheter. Pas de logiciel à apprendre.
          </p>
          <p className="mt-3 mb-0 max-w-[40em] text-[16px] text-ds-onnight2">
            Vous tenez votre fiche à jour, la communauté fait le reste.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* 6. Les offres, version courte */}
        <OffersSummary />

        {/* 7. Questions */}
        <FaqSection />

        {/* 8. Fin de page */}
        <section className="py-16 sm:py-20">
          <h2 className="font-display m-0 text-[40px] font-extrabold leading-none tracking-tight text-balance text-ds-text sm:text-[52px]">
            Votre café mérite d’être trouvé.
          </h2>
          <div className="mt-8">
            <ClaimCafeButton className="block w-full sm:w-auto" />
          </div>
          <p className="mt-6 mb-0 text-[14px] text-ds-text2">
            Une question ? Écrivez-nous à{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={`break-all font-semibold text-ds-accenttext underline ${FOCUS_RING}`}
            >
              {CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <footer className="flex flex-col gap-4 border-t border-ds-line py-8 text-[14px] text-ds-text2 sm:flex-row sm:items-center sm:justify-between">
          <span>Dropspot · Nice</span>
          <nav
            aria-label="Liens du pied de page"
            className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6"
          >
            <Link
              href="/login?redirect=/dashboard-pro&espace=pro"
              prefetch={false}
              className={`text-ds-text2 underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              Déjà gérant ? Se connecter
            </Link>
            <Link
              href="/map"
              className={`text-ds-text2 underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              Vous êtes client ? Ouvrir la carte
            </Link>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className={`text-ds-text2 underline-offset-2 hover:underline ${FOCUS_RING}`}
            >
              Contact
            </a>
          </nav>
        </footer>
      </div>
    </>
  );
}
