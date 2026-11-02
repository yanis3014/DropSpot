"use client";

import dynamic from "next/dynamic";

/** Chargement différé de la vidéo (sous la ligne de flottaison) pour le score perf mobile. */
const PitchVideo = dynamic(() => import("./PitchVideo"), {
  loading: () => (
    <div
      aria-hidden
      className="mx-auto aspect-[9/16] w-full max-w-[300px] rounded-[36px] bg-ds-surface2"
    />
  ),
});

export default function PitchVideoLazy() {
  return <PitchVideo />;
}
