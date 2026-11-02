const CHIPS = ["Prises", "Calme l’après-midi", "Matcha"] as const;

/** Fausse fiche café, purement illustrative : pas de lien, pas de données réelles. */
export default function CafeCardPreview() {
  return (
    <div
      aria-label="Exemple de fiche café"
      className="w-full max-w-sm overflow-hidden rounded-[26px] bg-ds-surface shadow-ds"
    >
      {/* Fausse photo : dégradé chaud en dur, exception assumée aux jetons
          (une vraie photo n'aurait pas de jeton non plus). */}
      <div className="relative h-[130px] bg-gradient-to-br from-[#d9b893] to-[#a7744a]">
        <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-[12px] font-semibold text-[#3a2412]">
          Ouvert · ferme à 19 h
        </span>
      </div>

      <div className="p-5">
        <p className="font-display m-0 text-[21px] font-extrabold tracking-tight text-ds-text">
          Maison Grain
        </p>
        <p className="mt-1 mb-0 text-[14px] text-ds-text2">
          Libération · café d’exemple
        </p>

        <ul className="m-0 mt-4 flex list-none flex-wrap gap-2 p-0">
          <li className="rounded-full bg-ds-oksoft px-2.5 py-1 text-[12px] font-semibold text-ds-ok">
            Wi-Fi rapide · confirmé
          </li>
          {CHIPS.map((chip) => (
            <li
              key={chip}
              className="rounded-full bg-ds-surface2 px-2.5 py-1 text-[12px] font-semibold text-ds-text"
            >
              {chip}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-ds-accentsoft p-3">
          <span className="flex h-[46px] w-[46px] shrink-0 flex-col items-center justify-center rounded-xl bg-ds-accent text-ds-onaccent">
            <span className="text-[10px] font-bold uppercase leading-none">
              JEU
            </span>
            <span className="font-display text-[18px] font-extrabold leading-none">
              15h
            </span>
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] font-bold text-ds-text">
              Atelier latte art
            </span>
            <span className="block text-[13px] text-ds-accenttext">
              6 places · réservez dans l’app
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
