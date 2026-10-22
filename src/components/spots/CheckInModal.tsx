'use client';

import { useEffect, useState } from 'react';
import { X, MapPin, LockKey, CheckCircle } from '@phosphor-icons/react';
import {
  checkIn,
  crowdConfig,
  CrowdLevel,
  WifiStatus,
  type CheckInResult,
} from '@/lib/api/checkins';
import { getCurrentPosition } from '@/lib/geo';
import LoginModal from '@/components/auth/LoginModal';

type RewardReason = Extract<CheckInResult, { ok: true }>['reason'];

interface CheckInModalProps {
  place: { id: string; name: string; image_url?: string };
  isAuthenticated: boolean;
  onClose: () => void;
  onSubmitted?: (result: { grainsEarned: number; reason: RewardReason }) => void;
  /**
   * Called when the user taps Fermer after a successful check-in.
   * If provided, this runs instead of a plain close — parent can open TrophyModal.
   */
  onSuccessDismiss?: (place: { id: string; name: string }) => void;
}

const wifiOptions: {
  value: WifiStatus;
  label: string;
  emoji: string;
}[] = [
  { value: 'slow', label: 'Galère', emoji: '🐌' },
  { value: 'good', label: 'Fusée', emoji: '🚀' },
];

function rewardCopy(reason: RewardReason, earned: number): string {
  if (earned > 0) return `+${earned} Grains 🌾`;
  if (reason === 'daily_cap')
    return 'Vibe partagée (0 Grain : limite du jour atteinte)';
  return 'Vibe mise à jour (0 Grain : déjà checké ici il y a moins de 3 h)';
}

function errorCopy(result: Extract<CheckInResult, { ok: false }>): string {
  switch (result.error) {
    case 'too_far':
      return result.distanceM != null
        ? `Tu es à ${Math.round(result.distanceM)} m du café. Rapproche-toi à moins de 100 m pour checker.`
        : 'Rapproche-toi à moins de 100 m du café pour checker.';
    case 'no_gps':
      return 'Active ta localisation : le check-in se fait sur place.';
    case 'not_authenticated':
      return 'Connecte-toi pour checker.';
    default:
      return "Oups, le check-in n'est pas parti. Réessaie.";
  }
}

export default function CheckInModal({
  place,
  isAuthenticated,
  onClose,
  onSubmitted,
  onSuccessDismiss,
}: CheckInModalProps) {
  const [visible, setVisible] = useState(false);
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);
  const [wifi, setWifi] = useState<WifiStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [earned, setEarned] = useState(0);
  const [reason, setReason] = useState<RewardReason>('ok');
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  /** Fermer after success — let parent intercept for TrophyModal. */
  const handleSuccessFermer = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
      onSuccessDismiss?.({ id: place.id, name: place.name });
    }, 250);
  };

  const handleSubmit = async () => {
    if (!crowd || !wifi || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // Presence is checked by the server from this position.
      const geo = await getCurrentPosition({
        enableHighAccuracy: true,
        maximumAge: 30_000,
      });
      const result = await checkIn({
        placeId: place.id,
        crowd,
        wifi,
        coords: geo.ok ? geo.coords : null,
      });
      if (!result.ok) {
        setError(errorCopy(result));
        setSubmitting(false);
        return;
      }
      setEarned(result.grainsAwarded);
      setReason(result.reason);
      setSubmitted(true);
      onSubmitted?.({
        grainsEarned: result.grainsAwarded,
        reason: result.reason,
      });
      setSubmitting(false);
    } catch {
      setError("Oups, le check-in n'est pas parti. Réessaie.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        className={`relative w-full max-w-md bg-ds-bg rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out max-h-[88dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-ds-text2/25" />
        </div>

        <div className="px-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ds-text2 mb-0.5">
              Je suis ici
            </p>
            <p className="flex items-center gap-1.5 text-ds-text font-bold text-lg leading-tight">
              <MapPin size={18} weight="fill" className="text-ds-accent flex-shrink-0" />
              <span className="truncate">{place.name}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-ds-surface shadow-sm border border-ds-text2/10 hover:bg-ds-surface2 active:scale-95 transition-all"
          >
            <X size={18} weight="bold" className="text-ds-text" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 w-full text-center">
            <div className="relative shrink-0">
              <span className="absolute inset-0 rounded-full bg-ds-ok/25 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-ds-ok/15 flex items-center justify-center">
                <CheckCircle size={40} weight="fill" className="text-ds-ok" />
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-ds-text shrink-0">
              Check-in validé !
            </h2>

            {/* Non-interactive reward / status pill — never a second CTA */}
            <span
              role="status"
              className={`pointer-events-none inline-flex max-w-full items-center justify-center rounded-full px-4 py-2 text-sm font-extrabold leading-snug animate-pop ${
                earned > 0
                  ? 'bg-ds-ok/15 text-ds-ok'
                  : 'bg-ds-surface text-ds-text border border-ds-text2/15'
              }`}
            >
              {rewardCopy(reason, earned)}
            </span>

            <p className="w-full text-sm leading-relaxed text-ds-text2 text-center px-1">
              Ta vibe est partagée avec la communauté.
            </p>

            <button
              type="button"
              onClick={handleSuccessFermer}
              className="mt-1 w-full max-w-xs bg-ds-pin text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-ds-pin/90 active:scale-[0.98] transition-all"
            >
              Fermer
            </button>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-ds-accent/10 flex items-center justify-center mb-4">
              <LockKey size={28} weight="duotone" className="text-ds-accent" />
            </div>
            <p className="font-bold text-ds-text mb-1">Connecte-toi pour checker</p>
            <p className="text-sm text-ds-text2 mb-6">
              Partage la vibe du spot et gagne des Grains.
            </p>
            <button
              onClick={() => setShowLogin(true)}
              className="w-full bg-ds-pin text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-ds-pin/90 active:scale-[0.98] transition-all"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">
              <p className="text-xs text-center text-ds-text2 bg-ds-surface2 rounded-xl px-3 py-2">
                Le check-in se fait sur place : ta position est vérifiée à
                l&apos;envoi (moins de 100 m du café).
              </p>

              <div>
                <p className="text-sm font-bold text-ds-text mb-3 text-center">
                  Comment est l&apos;affluence ?
                </p>
                <div className="grid grid-cols-3 gap-2.5">
                  {(Object.keys(crowdConfig) as CrowdLevel[]).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setCrowd(level)}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-3xl border-2 transition-all active:scale-95 ${
                        crowd === level
                          ? 'border-ds-ok bg-ds-ok/10 shadow-md'
                          : 'border-transparent bg-ds-surface hover:bg-ds-surface2'
                      }`}
                    >
                      <span className="text-4xl leading-none">{crowdConfig[level].emoji}</span>
                      <span className="text-xs font-bold text-ds-text">
                        {crowdConfig[level].label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-ds-text mb-3 text-center">
                  Et le Wi-Fi ?
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {wifiOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setWifi(option.value)}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-3xl border-2 transition-all active:scale-95 ${
                        wifi === option.value
                          ? 'border-ds-ok bg-ds-ok/10 shadow-md'
                          : 'border-transparent bg-ds-surface hover:bg-ds-surface2'
                      }`}
                    >
                      <span className="text-4xl leading-none">{option.emoji}</span>
                      <span className="text-xs font-bold text-ds-text">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-ds-accent font-medium text-center">{error}</p>
              )}
            </div>

            <div className="p-5 pt-3 border-t border-ds-text2/10 bg-ds-surface flex-shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!crowd || !wifi || submitting}
                className="w-full bg-ds-ok text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-ds-ok/25 hover:bg-ds-ok/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {submitting ? 'Validation…' : 'Valider'}
              </button>
            </div>
          </>
        )}
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
