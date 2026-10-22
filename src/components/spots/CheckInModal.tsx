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
import { getMySpecVotes, voteSpec } from '@/lib/api/specs';
import { pickSpecQuestions, specQuestion, type PlaceSpecMap, type SpecId } from '@/lib/specs';
import LoginModal from '@/components/auth/LoginModal';

type RewardReason = Extract<CheckInResult, { ok: true }>['reason'];

interface CheckInModalProps {
  place: { id: string; name: string; image_url?: string };
  /** Café pulse, used to pick the two questions asked after the check-in. */
  specs?: PlaceSpecMap;
  isAuthenticated: boolean;
  onClose: () => void;
  /** Called on close after a check-in, answers included (refresh the café pulse). */
  onSubmitted?: (result: { grainsEarned: number; reason: RewardReason }) => void;
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
    return 'Merci ! (0 Grain : limite du jour atteinte)';
  return 'Merci ! (0 Grain : déjà passé ici il y a moins de 3 h)';
}

function errorCopy(result: Extract<CheckInResult, { ok: false }>): string {
  switch (result.error) {
    case 'too_far':
      return result.distanceM != null
        ? `Tu es à ${Math.round(result.distanceM)} m du café. Rapproche-toi à moins de 100 m.`
        : 'Rapproche-toi à moins de 100 m du café.';
    case 'no_gps':
      return 'Active ta localisation : ça se fait sur place.';
    case 'not_authenticated':
      return 'Connecte-toi d’abord.';
    default:
      return "Oups, ça n'est pas parti. Réessaie.";
  }
}

export default function CheckInModal({
  place,
  specs = {},
  isAuthenticated,
  onClose,
  onSubmitted,
}: CheckInModalProps) {
  const [visible, setVisible] = useState(false);
  const [crowd, setCrowd] = useState<CrowdLevel | null>(null);
  const [wifi, setWifi] = useState<WifiStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Questions on the café specificities, asked one by one after the check-in.
  const [questions, setQuestions] = useState<SpecId[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answering, setAnswering] = useState(false);
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
    // Once the answers are in, the café page refreshes its pulse.
    if (submitted) onSubmitted?.({ grainsEarned: earned, reason });
    setVisible(false);
    setTimeout(onClose, 250);
  };

  const handleAnswer = async (vote: boolean | null) => {
    const spec = questions[questionIndex];
    if (!spec || answering) return;
    if (vote !== null) {
      setAnswering(true);
      try {
        const result = await voteSpec(place.id, spec, vote);
        if (result.ok) setEarned((e) => e + result.grainsAwarded);
      } catch (err) {
        console.error(err);
      } finally {
        setAnswering(false);
      }
    }
    setQuestionIndex((i) => i + 1);
  };

  const askingQuestions = submitted && questionIndex < questions.length;

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
      const alreadyVoted = await getMySpecVotes(place.id).catch(() => [] as SpecId[]);
      setQuestions(pickSpecQuestions(specs, alreadyVoted));
      setEarned(result.grainsAwarded);
      setReason(result.reason);
      setSubmitted(true);
      setSubmitting(false);
    } catch {
      setError("Oups, ça n'est pas parti. Réessaie.");
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

        {askingQuestions ? (
          <div className="flex flex-col items-center gap-5 px-6 pb-10 pt-6 w-full text-center">
            <p className="text-[13px] font-semibold text-ds-text2">
              Tu es sur place : aide les autres ({questionIndex + 1}/{questions.length})
            </p>
            <h2 className="text-xl font-extrabold text-ds-text">
              {specQuestion(questions[questionIndex])}
            </h2>
            <div className="grid w-full grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={answering}
                onClick={() => void handleAnswer(true)}
                className="rounded-2xl bg-ds-ok py-4 font-extrabold text-white active:scale-[0.98] disabled:opacity-50"
              >
                Oui
              </button>
              <button
                type="button"
                disabled={answering}
                onClick={() => void handleAnswer(false)}
                className="rounded-2xl border border-ds-line bg-ds-surface py-4 font-extrabold text-ds-text active:scale-[0.98] disabled:opacity-50"
              >
                Non
              </button>
            </div>
            <button
              type="button"
              disabled={answering}
              onClick={() => void handleAnswer(null)}
              className="h-11 text-[15px] font-bold text-ds-text2"
            >
              Je ne sais pas
            </button>
          </div>
        ) : submitted ? (
          <div className="flex flex-col items-center justify-center gap-4 px-6 py-12 w-full text-center">
            <div className="relative shrink-0">
              <span className="absolute inset-0 rounded-full bg-ds-ok/25 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-ds-ok/15 flex items-center justify-center">
                <CheckCircle size={40} weight="fill" className="text-ds-ok" />
              </div>
            </div>

            <h2 className="text-xl font-extrabold text-ds-text shrink-0">
              Merci, c’est noté !
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
              Ce que tu as partagé aide les autres à choisir leur café.
            </p>

            <button
              type="button"
              onClick={handleClose}
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
            <p className="font-bold text-ds-text mb-1">Connecte-toi pour dire que tu es ici</p>
            <p className="text-sm text-ds-text2 mb-6">
              Partage l’ambiance du café et gagne des Grains.
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
                Ça se fait sur place : ta position est vérifiée à
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
