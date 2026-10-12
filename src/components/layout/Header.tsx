'use client';

import ThemeCycleButton from '@/components/profile/ThemeCycleButton';
import { preferenceById, PreferenceId } from '@/lib/preferences';

interface HeaderProps {
  isAuthenticated: boolean;
  email: string | undefined;
  avatarUrl: string | undefined;
  displayName: string | undefined;
  userPrefs: PreferenceId[];
  onShowProfile: () => void;
  onShowLogin: () => void;
}

export default function Header({
  isAuthenticated,
  email,
  displayName,
  userPrefs,
  onShowProfile,
  onShowLogin,
}: HeaderProps) {
  const emailSafe = email ?? '';
  const displayNameSafe = displayName ?? '';
  const displayNameToUse =
    displayNameSafe || emailSafe?.split('@')[0] || 'Utilisateur';
  const firstLetter = displayNameToUse?.charAt(0)?.toUpperCase() ?? 'U';
  const firstEmoji = userPrefs[0] ? preferenceById[userPrefs[0]]?.emoji ?? '' : '';

  return (
    <header className="px-5 pt-8 pb-4 flex justify-between items-center sticky top-0 bg-brand-light/95 backdrop-blur-md z-40">
      <h1 className="text-2xl font-bold tracking-tight text-brand-dark">
        DropSpot
      </h1>

      {isAuthenticated ? (
        <button
          onClick={onShowProfile}
          className="flex items-center gap-2 bg-white rounded-full pl-1 pr-3 py-1 shadow-sm border border-gray-100 transition active:scale-95"
          aria-label="Mon profil"
        >
          <div className="w-8 h-8 rounded-full bg-brand-purple flex items-center justify-center text-white font-semibold text-sm">
            {firstLetter}
          </div>
          <span className="text-sm font-semibold pr-1 text-brand-dark">
            {displayNameToUse}{' '}
            {firstEmoji && (
              <span className="text-lg leading-none">{firstEmoji}</span>
            )}
          </span>
        </button>
      ) : (
        <div className="flex items-center gap-3">
          <ThemeCycleButton />
          <button
            onClick={onShowLogin}
            className="text-sm font-semibold text-brand-green bg-brand-green/10 px-4 py-2 rounded-full hover:bg-brand-green/20 transition-colors"
          >
            Connexion
          </button>
        </div>
      )}
    </header>
  );
}
