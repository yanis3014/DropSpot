'use client';

import { useEffect, useState } from 'react';
import { X, MapPin, LockKey, CheckCircle } from '@phosphor-icons/react';
import {
  createCheckIn,
  crowdConfig,
  getUserLastCheckInAtPlace,
  CrowdLevel,
  WifiStatus,
  VIBE_WINDOW_MS,
} from '@/lib/api/checkins';
import {
  addGrains,
  evaluateGrainsEligibility,
  markGrainsEarned,
  type GrainsAwardReason,
} from '@/lib/grains';
import { startCheckInSession } from '@/lib/checkinSession';
import LoginModal from '@/components/auth/LoginModal';

interface CheckInModalProps {
  place: { id: string; name: string; image_url?: string };
  isAuthenticated: boolean;
  /** Distance from user GPS to place; null if GPS unknown. */
  distanceM?: number | null;
  /** True when updating vibe on the currently active session place. */
  isActiveSession?: boolean;
  onClose: () => void;
  onSubmitted?: (result: {
    grainsEarned: number;
    reason: GrainsAwardReason;
  }) => void;
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

function rewardCopy(reason: GrainsAwardReason, earned: number): string {
  if (earned > 0) return `+${earned} Grains 🌾`;
  if (reason === 'cooldown') return 'Vibe mise à jour (0 Grain — Délai de 3h)';
  if (reason === 'too_far') return 'Vibe partagée (0 Grain — trop loin)';
  return 'Vibe partagée (0 Grain — GPS requis)';
}

export default function CheckInModal({
  place,
  isAuthenticated,
  distanceM = null,
  isActiveSession = false,
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
  const [reason, setReason] = useState<GrainsAwardReason>('ok');
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
      const last = await getUserLastCheckInAtPlace(place.id);
      const serverCooldownActive = !!(
        last &&
        Date.now() - new Date(last.created_at).getTime() < VIBE_WINDOW_MS
      );

      const award = evaluateGrainsEligibility({
        placeId: place.id,
        distanceM: distanceM ?? null,
        serverCooldownActive,
      });

      await createCheckIn({
        place_id: place.id,
        crowd_level: crowd,
        wifi_speed: wifi,
      });

      if (award.eligible && award.amount > 0) {
        addGrains(award.amount);
        markGrainsEarned(place.id);
      }

      // One physical place at a time — start / refresh the active session.
      startCheckInSession(place.id, place.name);

      setEarned(award.amount);
      setReason(award.reason);
      setSubmitted(true);
      onSubmitted?.({ grainsEarned: award.amount, reason: award.reason });
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
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out max-h-[88dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-mocha/25" />
        </div>

        <div className="px-5 pb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-mocha mb-0.5">
              {isActiveSession ? 'Mettre à jour' : 'Quick vibe'}
            </p>
            <p className="flex items-center gap-1.5 text-brand-espresso font-bold text-lg leading-tight">
              <MapPin size={18} weight="fill" className="text-brand-terracotta flex-shrink-0" />
              <span className="truncate">{place.name}</span>
            </p>
          </div>
          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-brand-surface shadow-sm border border-brand-mocha/10 hover:bg-brand-muted active:scale-95 transition-all"
          >
            <X size={18} weight="bold" className="text-brand-espresso" />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 w-full text-center">
            <div className="relative shrink-0">
              <span className="absolute inset-0 rounded-full bg-brand-matcha/25 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-brand-matcha/15 flex items-center justify-center">
                <CheckCircle size={40} weight="fill" className="text-brand-matcha" />
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-brand-espresso shrink-0">
              Check-in validé !
            </h2>

            {/* Non-interactive reward / status pill — never a second CTA */}
            <span
              role="status"
              className={`pointer-events-none inline-flex max-w-full items-center justify-center rounded-full px-4 py-2 text-sm font-extrabold leading-snug animate-pop ${
                earned > 0
                  ? 'bg-brand-matcha/15 text-brand-matcha'
                  : 'bg-brand-surface text-brand-espresso border border-brand-mocha/15'
              }`}
            >
              {rewardCopy(reason, earned)}
            </span>

            <p className="w-full text-sm leading-relaxed text-brand-mocha text-center px-1">
              Ta vibe est partagée avec la communauté.
            </p>

            <button
              type="button"
              onClick={handleSuccessFermer}
              className="mt-1 w-full max-w-xs bg-brand-ink text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all"
            >
              Fermer
            </button>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-terracotta/10 flex items-center justify-center mb-4">
              <LockKey size={28} weight="duotone" className="text-brand-terracotta" />
            </div>
            <p className="font-bold text-brand-espresso mb-1">Connecte-toi pour checker</p>
            <p className="text-sm text-brand-mocha mb-6">
              Partage la vibe du spot et gagne des Grains.
            </p>
            <button
              onClick={() => setShowLogin(true)}
              className="w-full bg-brand-ink text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all"
            >
              Se connecter
            </button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 pb-4 space-y-6">
              {distanceM != null && distanceM > 100 && (
                <p className="text-xs text-center text-brand-mocha bg-brand-muted rounded-xl px-3 py-2">
                  Tu es à {Math.round(distanceM)} m — la vibe sera partagée, mais
                  sans Grains (présence &lt; 100 m requise).
                </p>
              )}
              {distanceM == null && (
                <p className="text-xs text-center text-brand-mocha bg-brand-muted rounded-xl px-3 py-2">
                  GPS indisponible — vibe OK, Grains uniquement sur place.
                </p>
              )}

              <div>
                <p className="text-sm font-bold text-brand-espresso mb-3 text-center">
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
                          ? 'border-brand-matcha bg-brand-matcha/10 shadow-md'
                          : 'border-transparent bg-brand-surface hover:bg-brand-muted'
                      }`}
                    >
                      <span className="text-4xl leading-none">{crowdConfig[level].emoji}</span>
                      <span className="text-xs font-bold text-brand-espresso">
                        {crowdConfig[level].label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-brand-espresso mb-3 text-center">
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
                          ? 'border-brand-matcha bg-brand-matcha/10 shadow-md'
                          : 'border-transparent bg-brand-surface hover:bg-brand-muted'
                      }`}
                    >
                      <span className="text-4xl leading-none">{option.emoji}</span>
                      <span className="text-xs font-bold text-brand-espresso">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-brand-terracotta font-medium text-center">{error}</p>
              )}
            </div>

            <div className="p-5 pt-3 border-t border-brand-mocha/10 bg-brand-surface flex-shrink-0">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!crowd || !wifi || submitting}
                className="w-full bg-brand-matcha text-white font-extrabold py-4 rounded-2xl shadow-lg shadow-brand-matcha/25 hover:bg-brand-matcha/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                {submitting
                  ? 'Validation…'
                  : isActiveSession
                    ? 'Mettre à jour'
                    : 'Valider'}
              </button>
            </div>
          </>
        )}
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
