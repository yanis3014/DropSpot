import type { Metadata } from "next";
import Link from "next/link";
import {
  ChartBar,
  CheckCircle,
  Lightning,
  MapPin,
} from "@phosphor-icons/react/ssr";
import { CONTACT_EMAIL } from "@/lib/pro/contact";
import ClaimCafeButton from "./ClaimCafeButton";
import FaqSection from "./FaqSection";
import NiceMapHero from "./NiceMapHero";
import OffersSection from "./OffersSection";
import PitchVideo from "./PitchVideo";

const FOCUS_RING =
  "rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent";

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

const BENEFITS = [
  {
    Icon: MapPin,
    title: "Être trouvé par les bonnes personnes",
    body: "Les clients cherchent selon leur envie : travailler au calme, un bon matcha, une terrasse. Si c’est chez vous, c’est vous qu’ils trouvent.",
  },
  {
    Icon: Lightning,
    title: "Faire venir du monde quand c’est calme",
    body: "Un atelier, un run le samedi, une dégustation, une offre à 15 h : vous le publiez en deux minutes, il apparaît sur la carte, et vous validez les participants au comptoir.",
  },
  {
    Icon: ChartBar,
    title: "Savoir ce qui marche",
    body: "Combien de personnes ont vu votre café, combien sont venues, à quelle heure. Des chiffres simples, sans tableur.",
  },
  {
    Icon: CheckCircle,
    title: "Une fiche toujours juste",
    body: "Les clients confirment sur place ce qu’ils voient : le Wi-Fi, les prises, l’ambiance. Votre fiche reste à jour sans que vous ayez à la surveiller.",
  },
] as const;

const STEPS = [
  {
    n: "1",
    title: "Retrouvez votre café",
    body: "Les cafés de Nice sont déjà sur la carte. Le vôtre n’y est pas ? Vous l’ajoutez.",
  },
  {
    n: "2",
    title: "On vérifie que c’est bien vous",
    body: "Une preuve simple que vous gérez le lieu. Personne d’autre ne peut modifier votre fiche.",
  },
  {
    n: "3",
    title: "Lancez votre premier événement",
    body: "Titre, date, nombre de places : il apparaît sur la carte. Vos équipiers valident les participants au comptoir avec un QR code.",
  },
] as const;

export default function PourLesCafesPage() {
  return (
    <>
      {/* Bandeau sombre pleine largeur, hors du conteneur max-w-6xl */}
      <NiceMapHero />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="border-t border-ds-line py-16 sm:py-20">
        <h2 className="font-display m-0 text-[28px] font-extrabold tracking-tight text-balance text-ds-text sm:text-[36px]">
          Ce que Dropspot change pour votre café
        </h2>
        <p className="mt-3 mb-0 max-w-[40em] text-[16px] leading-relaxed text-ds-text2 sm:text-[17px]">
          Pas de publicité à acheter, pas de logiciel compliqué. Vous tenez
          votre fiche à jour, la communauté fait le reste.
        </p>
        <ul className="mt-10 m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {BENEFITS.map(({ Icon, title, body }) => (
            <li
              key={title}
              className="rounded-[20px] border border-ds-line bg-ds-surface p-6"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ds-accentsoft text-ds-accenttext">
                <Icon size={24} weight="duotone" aria-hidden />
              </span>
              <h3 className="font-display mt-4 mb-0 text-[17px] font-extrabold tracking-tight text-ds-text">
                {title}
              </h3>
              <p className="mt-2 mb-0 text-[14px] leading-relaxed text-ds-text2">
                {body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section
        id="comment"
        className="border-t border-ds-line py-16 sm:py-20"
      >
        <h2 className="font-display m-0 text-[28px] font-extrabold tracking-tight text-balance text-ds-text sm:text-[36px]">
          Trois étapes, quelques minutes
        </h2>
        <ol className="mt-10 m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-3">
          {STEPS.map(({ n, title, body }) => (
            <li
              key={n}
              className="rounded-[20px] border border-ds-line bg-ds-surface p-6"
            >
              <span className="font-display flex h-10 w-10 items-center justify-center rounded-full bg-ds-accent text-base font-extrabold text-ds-onaccent">
                {n}
              </span>
              <h3 className="font-display mt-4 mb-0 text-[17px] font-extrabold tracking-tight text-ds-text">
                {title}
              </h3>
              <p className="mt-2 mb-0 text-[14px] leading-relaxed text-ds-text2">
                {body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <OffersSection />

      <FaqSection />

      <section className="py-16 sm:py-20">
        <div className="flex flex-col items-center rounded-[28px] bg-ds-accentsoft px-6 py-14 text-center sm:px-10">
          <h2 className="font-display m-0 text-[28px] font-extrabold tracking-tight text-balance text-ds-text sm:text-[40px]">
            Votre café mérite d’être trouvé.
          </h2>
          <p className="mt-3 mb-0 text-[17px] text-ds-text2">
            Revendiquez-le aujourd’hui, c’est gratuit.
          </p>
          <div className="mt-7 w-full sm:w-auto">
            <ClaimCafeButton />
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
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-ds-line py-8 text-[14px] text-ds-text2 sm:flex-row sm:items-center sm:justify-between">
        <span>Dropspot · Nice</span>
        <nav aria-label="Liens du pied de page" className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-6">
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
