import { CaretDown } from "@phosphor-icons/react/ssr";

const QUESTIONS = [
  {
    q: "Combien de temps ça me prend ?",
    a: "Quelques minutes pour la fiche. Ensuite, un événement se publie en deux minutes depuis votre téléphone.",
  },
  {
    q: "Mon café est déjà sur la carte. C’est normal ?",
    a: "Oui, nous avons ajouté les cafés de Nice. Revendiquez le vôtre pour en prendre la main : nous vérifions d’abord que c’est bien vous.",
  },
  {
    q: "Faut-il installer une application ?",
    a: "Non. Dropspot s’ouvre dans le navigateur de votre téléphone. Vous pouvez l’ajouter à votre écran d’accueil si vous le souhaitez.",
  },
  {
    q: "Mon équipe peut-elle valider les codes ?",
    a: "Oui. Vous invitez vos équipiers ; ils valident les codes au comptoir sans avoir accès au reste.",
  },
  {
    q: "Est-ce que je m’engage ?",
    a: "L’offre Présence est gratuite, sans limite de durée. Pour Analytics et Premium, nous en parlons avec vous pendant le pilote.",
  },
  {
    q: "Et les données de mes clients ?",
    a: "Vous voyez des chiffres d’ensemble : nombre de visites, heures, habitués. Jamais les informations personnelles de vos clients.",
  },
  {
    q: "Un autre café peut-il voir mes chiffres ?",
    a: "Non. Chaque café ne voit que ses propres données.",
  },
] as const;

/** Native <details>: no client JS. */
export default function FaqSection() {
  return (
    <section id="questions" className="border-t border-ds-line py-16 sm:py-20">
      <h2 className="font-display m-0 text-[32px] font-extrabold leading-[1.08] tracking-tight text-balance text-ds-text sm:text-[40px]">
        Vos questions
      </h2>
      <div className="mt-10 flex max-w-3xl flex-col gap-3">
        {QUESTIONS.map(({ q, a }) => (
          <details
            key={q}
            className="group rounded-[18px] border border-ds-line bg-ds-surface"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 rounded-[18px] px-5 py-3 text-[16px] font-bold text-ds-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent [&::-webkit-details-marker]:hidden">
              {q}
              <CaretDown
                size={20}
                weight="bold"
                aria-hidden
                className="shrink-0 text-ds-text2 motion-safe:transition-transform motion-safe:duration-200 motion-safe:group-open:rotate-180"
              />
            </summary>
            <p className="m-0 px-5 pb-5 text-[15px] leading-relaxed text-ds-text2">
              {a}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
