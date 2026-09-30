'use client';

import { useState } from 'react';
import { Heart } from '@phosphor-icons/react';
import { useAuth } from '@/lib/hooks/useAuth';
import LoginModal from '@/components/auth/LoginModal';

interface FavoriteButtonProps {
  placeId: string;
  isSaved: boolean;
  onToggle: (placeId: string) => void | Promise<void>;
  size?: number;
  className?: string;
}

export default function FavoriteButton({
  placeId,
  isSaved,
  onToggle,
  size = 18,
  className = '',
}: FavoriteButtonProps) {
  const { isAuthenticated } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }

    setBusy(true);
    try {
      await onToggle(placeId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-label={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        aria-pressed={isSaved}
        className={[
          'group inline-flex items-center justify-center rounded-full bg-brand-surface/90 backdrop-blur-sm shadow-sm',
          'hover:bg-brand-surface active:scale-90 transition-all duration-200',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          className,
        ].join(' ')}
      >
        <Heart
          size={size}
          weight={isSaved ? 'fill' : 'regular'}
          className={`transition-all duration-200 ${
            isSaved
              ? 'text-brand-terracotta scale-110'
              : 'text-brand-mocha group-hover:text-brand-terracotta'
          }`}
        />
      </button>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
