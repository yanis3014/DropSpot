"use client";

import { useEffect, useRef, useState } from "react";

export default function PitchVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (reduceMotion) {
      el.pause();
      return;
    }
    void el.play().catch(() => {
      // Autoplay blocked — user can still see the poster.
    });
  }, [reduceMotion]);

  return (
    <div className="mx-auto flex w-full max-w-[300px] flex-col items-center gap-3">
      <div className="aspect-[9/16] w-full overflow-hidden rounded-[36px] border-8 border-ds-text shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
        <video
          ref={videoRef}
          src="/vitrine/pub-pro.mp4"
          poster="/vitrine/pub-pro-poster.jpg"
          muted
          loop
          playsInline
          preload="metadata"
          controls={reduceMotion}
          aria-label="Vidéo : un mardi à 15 h dans un café qui utilise Dropspot"
          className="h-full w-full object-cover"
        />
      </div>
      <p className="m-0 text-[13px] text-ds-text2">1 min 27 · sans son</p>
    </div>
  );
}
