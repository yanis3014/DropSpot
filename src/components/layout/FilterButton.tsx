'use client';

import { SlidersHorizontal } from '@phosphor-icons/react';

interface FilterButtonProps {
  onClick: () => void;
}

export default function FilterButton({ onClick }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white border border-gray-200 rounded-2xl w-12 h-12 flex items-center justify-center text-gray-700 shadow-sm transition active:bg-gray-50 active:scale-95"
      aria-label="Ouvrir les filtres"
    >
      <SlidersHorizontal size={20} weight="bold" />
    </button>
  );
}