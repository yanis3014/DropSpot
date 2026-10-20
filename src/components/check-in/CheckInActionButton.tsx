'use client';

import { GRAINS_PROXIMITY_M } from '@/lib/grains';

interface CheckInActionButtonProps {
  /** Distance GPS en mètres (null = GPS indisponible). */
  distanceM: number | null;
  onClick?: () => void;
  className?: string;
}

/**
 * Bouton d'action Check-in — actif uniquement si distance ≤ 100 m.
 * Extrait pour tests unitaires / composant isolé.
 */
export default function CheckInActionButton({
  distanceM,
  onClick,
  className = '',
}: CheckInActionButtonProps) {
  const tooFar =
    distanceM == null ||
    !Number.isFinite(distanceM) ||
    distanceM > GRAINS_PROXIMITY_M;

  const label =
    distanceM == null
      ? 'GPS requis'
      : tooFar
        ? 'Trop loin'
        : 'Check-in';

  return (
    <button
      type="button"
      disabled={tooFar}
      onClick={onClick}
      aria-label={label}
      className={
        className ||
        (tooFar
          ? 'bg-gray-100 text-gray-400 cursor-not-allowed font-bold text-sm px-4 py-2.5 rounded-xl'
          : 'bg-brand-green text-white font-bold text-sm px-4 py-2.5 rounded-xl shadow-md hover:bg-brand-green/90 active:scale-95 transition-all')
      }
    >
      {label}
    </button>
  );
}
