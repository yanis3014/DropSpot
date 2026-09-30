'use client';

import { useEffect, useState } from 'react';
import {
  X,
  MapPin,
  WifiHigh,
  CheckCircle,
  LockKey,
  UsersThree,
  PaperPlaneTilt,
} from '@phosphor-icons/react';
import {
  createCheckIn,
  crowdConfig,
  CrowdLevel,
  WifiStatus,
} from '@/lib/api/checkins';
import LoginModal from '@/components/auth/LoginModal';

interface CheckInModalProps {
  place: { id: string; name: string; image_url?: string };
  isAuthenticated: boolean;
  onClose: () => void;
  onSubmitted?: () => void;
}

const wifiOptions: { value: WifiStatus; label: string; emoji: string; sublabel: string }[] = [
  { value: 'good', label: 'Fluide', emoji: '🚀', sublabel: 'Ça bosse bien' },
  { value: 'slow', label: 'Lent', emoji: '🐌', sublabel: 'Difficile à bosser' },
];

export default function CheckInModal({
  place,
  isAuthenticated,
  onClose,
  onSubmitted,
}: CheckInModalProps) {
  const [visible, setVisible] = useState(false);
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);
  const [wifi, setWifi] = useState<WifiStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Slide-in on mount, and lock body scroll while open
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

  const handleSubmit = async () => {
    if (!crowd || !wifi || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await createCheckIn({ place_id: place.id, crowd_level: crowd, wifi_speed: wifi });
      setSubmitted(true);
      onSubmitted?.();
      setTimeout(handleClose, 1400);
    } catch {
      setError("Oups, le check-in n'est pas parti. Réessaie.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        onClick={handleClose}
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Bottom sheet panel */}
      <div
        className={`relative w-full max-w-md bg-brand-oat rounded-t-3xl overflow-hidden shadow-2xl transition-transform duration-300 ease-out max-h-[85dvh] flex flex-col ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* Header */}
        <div className="relative h-28 flex-shrink-0 bg-gradient-to-br from-[#2C1E16] to-[#8B6B5D]">
          {place.image_url && (
            <img
              src={place.image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-brand-espresso/80 via-brand-espresso/30 to-transparent" />

          <button
            onClick={handleClose}
            aria-label="Fermer"
            className="absolute top-4 right-4 bg-brand-surface/90 backdrop-blur-sm rounded-full p-2 shadow-md hover:bg-brand-surface active:scale-95 transition-all"
          >
            <X size={20} weight="bold" className="text-brand-espresso" />
          </button>

          <div className="absolute bottom-3 left-5 right-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-0.5">
              Check-in
            </p>
            <p className="flex items-center gap-1.5 text-white font-bold text-lg leading-tight">
              <MapPin size={18} weight="fill" className="text-brand-terracotta flex-shrink-0" />
              <span className="truncate">{place.name}</span>
            </p>
          </div>
        </div>

        {submitted ? (
          /* Success state */
          <div className="flex-1 flex flex-col items-center justify-center py-14 px-5">
            <CheckCircle size={56} weight="fill" className="text-brand-matcha mb-3" />
            <p className="text-lg font-bold text-brand-espresso">Merci !</p>
            <p className="text-sm text-brand-mocha text-center">
              Ta vibe est partagée avec la communauté.
            </p>
          </div>
        ) : !isAuthenticated ? (
          /* Auth soft-gate */
          <div className="flex-1 flex flex-col items-center justify-center py-12 px-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-brand-terracotta/10 flex items-center justify-center mb-4">
              <LockKey size={28} weight="duotone" className="text-brand-terracotta" />
            </div>
            <p className="font-bold text-brand-espresso mb-1">Connecte-toi pour checker</p>
            <p className="text-sm text-brand-mocha mb-6">
              Partage l'affluence et le Wi-Fi du spot en temps réel.
            </p>
            <button
              onClick={() => setShowLogin(true)}
              className="w-full bg-brand-ink text-white font-bold py-3.5 rounded-2xl shadow-lg hover:bg-brand-ink/90 active:scale-[0.98] transition-all"
            >
              Se connecter
            </button>
          </div>
        ) : (
          /* Check-in form */
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Crowd level */}
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-brand-espresso mb-2.5">
                  <UsersThree size={18} weight="duotone" className="text-brand-mocha" />
                  Comment est l'affluence ?
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(crowdConfig) as CrowdLevel[]).map((level) => (
                    <button
                      key={level}
                      onClick={() => setCrowd(level)}
                      className={`flex flex-col items-center gap-0.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                        crowd === level
                          ? 'border-brand-ink bg-brand-surface shadow-md'
                          : 'border-transparent bg-brand-surface/60 hover:bg-brand-surface'
                      }`}
                    >
                      <span className="text-xl">{crowdConfig[level].emoji}</span>
                      <span className="text-xs font-bold text-brand-espresso">
                        {crowdConfig[level].label}
                      </span>
                      <span className="text-[10px] text-brand-mocha">
                        {crowdConfig[level].sublabel}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wi-Fi status */}
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-brand-espresso mb-2.5">
                  <WifiHigh size={18} weight="duotone" className="text-brand-mocha" />
                  Et le Wi-Fi ?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {wifiOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setWifi(option.value)}
                      className={`flex items-center gap-2.5 px-3.5 py-3 rounded-2xl border-2 transition-all active:scale-95 ${
                        wifi === option.value
                          ? 'border-brand-ink bg-brand-surface shadow-md'
                          : 'border-transparent bg-brand-surface/60 hover:bg-brand-surface'
                      }`}
                    >
                      <span className="text-xl">{option.emoji}</span>
                      <span className="text-left">
                        <span className="block text-xs font-bold text-brand-espresso">
                          {option.label}
                        </span>
                        <span className="block text-[10px] text-brand-mocha">
                          {option.sublabel}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm text-brand-terracotta font-medium text-center">{error}</p>
              )}
            </div>

            {/* Submit */}
            <div className="p-5 pt-3 border-t border-brand-mocha/10 bg-brand-surface flex-shrink-0">
              <button
                onClick={handleSubmit}
                disabled={!crowd || !wifi || submitting}
                className="w-full flex items-center justify-center gap-2 bg-brand-matcha text-white font-bold py-4 rounded-2xl shadow-lg shadow-brand-matcha/25 hover:bg-brand-matcha/90 active:scale-[0.98] transition-all disabled:opacity-40 disabled:pointer-events-none"
              >
                <PaperPlaneTilt size={18} weight="fill" />
                {submitting ? 'Envoi...' : 'Partager la vibe'}
              </button>
            </div>
          </>
        )}
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
