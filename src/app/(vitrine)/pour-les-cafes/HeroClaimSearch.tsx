"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import {
  PRO_CLAIM_PATH,
  writeProClaimQuery,
  writeProIntent,
} from "@/lib/auth/proIntent";
import {
  searchPlacesPublic,
  type VitrinePlaceHit,
} from "@/lib/vitrine/searchPlaces";

const DEBOUNCE_MS = 250;

/**
 * Premier geste de la landing cafés : taper le nom de son café.
 * Lecture publique de `places`, aucune écriture ; le clic enregistre
 * l'intention (localStorage) puis envoie vers l'assistant de revendication
 * — le proxy redirige vers /login quand on n'est pas connecté, et
 * l'intention enregistrée ramène ensuite à l'assistant.
 */
export default function HeroClaimSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // Résultats liés à leur requête : aucun setState synchrone dans l'effet
  // (règle react-hooks/set-state-in-effect), tout passe par le timer.
  const [result, setResult] = useState<{
    query: string;
    hits: VitrinePlaceHit[];
  } | null>(null);
  const requestId = useRef(0);
  const listRef = useRef<HTMLDivElement>(null);

  const q = query.trim();
  const showList = q.length >= 2;
  const hits = result?.query === q ? result.hits : [];
  const searching = showList && result?.query !== q;

  useEffect(() => {
    if (q.length < 2) return;
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      void (async () => {
        const list = await searchPlacesPublic(q);
        // Une frappe plus récente a pris le relais : réponse ignorée.
        if (requestId.current !== id) return;
        setResult({ query: q, hits: list });
      })();
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [q]);

  const goToClaim = (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length > 0) {
      writeProClaimQuery(trimmed);
      router.push(`${PRO_CLAIM_PATH}?q=${encodeURIComponent(trimmed)}`);
    } else {
      writeProIntent();
      router.push(PRO_CLAIM_PATH);
    }
  };

  // Flèches haut/bas : de l'input vers la liste, puis en boucle dans la liste.
  const focusResult = (index: number) => {
    const buttons = listRef.current?.querySelectorAll("button");
    if (!buttons || buttons.length === 0) return;
    buttons[((index % buttons.length) + buttons.length) % buttons.length].focus();
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && showList) {
      e.preventDefault();
      focusResult(0);
    }
  };

  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    const buttons = listRef.current?.querySelectorAll("button");
    if (!buttons || buttons.length === 0) return;
    e.preventDefault();
    const current = Array.from(buttons).indexOf(
      document.activeElement as HTMLButtonElement
    );
    focusResult(current + (e.key === "ArrowDown" ? 1 : -1));
  };

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        goToClaim(query);
      }}
      className="flex flex-col"
    >
      <label
        htmlFor="claim-search"
        className="text-[13px] font-semibold text-ds-onnight2"
      >
        Nom de votre café
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="claim-search"
          type="search"
          autoComplete="off"
          placeholder="Ex. Maison Grain"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          className="min-h-[52px] min-w-0 flex-1 rounded-[14px] border border-ds-nightline bg-ds-night2 px-4 text-base text-ds-onnight outline-none placeholder:text-ds-onnight2/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-nightaccent"
        />
        <button
          type="submit"
          className="min-h-[52px] shrink-0 rounded-[14px] bg-ds-nightaccent px-5 text-base font-bold text-ds-onnightaccent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-nightaccent"
        >
          Trouver
        </button>
      </div>

      <p aria-live="polite" className="sr-only">
        {showList && !searching
          ? `${hits.length} café${hits.length > 1 ? "s" : ""} trouvé${hits.length > 1 ? "s" : ""}`
          : ""}
      </p>

      {showList ? (
        <div
          ref={listRef}
          onKeyDown={onListKeyDown}
          className="mt-2 rounded-[18px] border border-ds-nightline bg-ds-night2 p-1.5"
        >
          {searching ? (
            <p className="m-0 px-3 py-2 text-[13px] text-ds-onnight2">
              Recherche…
            </p>
          ) : null}
          <ul className="m-0 list-none p-0">
            {hits.map((hit) => (
              <li key={hit.id}>
                {hit.free ? (
                  <button
                    type="button"
                    onClick={() => goToClaim(hit.name)}
                    className="flex min-h-[52px] w-full items-center gap-3 rounded-[14px] px-3 py-2 text-left hover:bg-ds-nightline/50 focus-visible:outline-2 focus-visible:outline-ds-nightaccent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ds-onnight">
                        {hit.name}
                      </span>
                      {hit.area ? (
                        <span className="block truncate text-[13px] text-ds-onnight2">
                          {hit.area}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-full bg-ds-nightaccent/15 px-2.5 py-0.5 text-[12px] font-bold text-ds-nightaccenttext">
                      Libre
                    </span>
                  </button>
                ) : (
                  <div className="flex min-h-[52px] w-full items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ds-onnight">
                        {hit.name}
                      </span>
                      {hit.area ? (
                        <span className="block truncate text-[13px] text-ds-onnight2">
                          {hit.area}
                        </span>
                      ) : null}
                      <span className="mt-0.5 block text-[13px] text-ds-onnight2">
                        Ce café a déjà un gérant. Vous travaillez avec
                        lui&nbsp;? Demandez-lui une invitation.
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-ds-nightline px-2.5 py-0.5 text-[12px] font-bold text-ds-onnight2">
                      Déjà géré
                    </span>
                  </div>
                )}
              </li>
            ))}
            <li
              className={
                hits.length > 0 || searching
                  ? "mt-1 border-t border-ds-nightline pt-1"
                  : undefined
              }
            >
              <button
                type="button"
                onClick={() => goToClaim(query)}
                className="flex min-h-[52px] w-full items-center rounded-[14px] px-3 py-2 text-left font-semibold text-ds-nightaccenttext hover:bg-ds-nightline/50 focus-visible:outline-2 focus-visible:outline-ds-nightaccent"
              >
                Votre café n’y est pas&nbsp;? Ajoutez-le
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </form>
  );
}
