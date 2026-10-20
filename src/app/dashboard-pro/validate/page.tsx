'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Camera,
  CheckCircle,
  Keyboard,
  Spinner,
  X,
} from '@phosphor-icons/react';
import DashboardProShell from '@/app/dashboard-pro/components/DashboardProShell';
import { useRequireVendor } from '@/app/dashboard-pro/hooks/useRequireVendor';
import {
  extractValidationCode,
  validateErrorMessage,
  validateFlashDropCode,
  type ValidateFlashDropResult,
} from '@/app/dashboard-pro/lib/api/validate';

const PIN_LEN = 4;

export default function ValidatePage() {
  const router = useRouter();
  const { profile, loading, denied, displayName } = useRequireVendor();
  const [digits, setDigits] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ValidateFlashDropResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanLoopRef = useRef<number | null>(null);

  const stopScan = useCallback(() => {
    if (scanLoopRef.current != null) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setScanOpen(false);
  }, []);

  useEffect(() => () => stopScan(), [stopScan]);

  const runValidation = async (raw: string) => {
    const code = extractValidationCode(raw);
    if (code.length < PIN_LEN) {
      setError('Saisis un code à 4 chiffres.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await validateFlashDropCode(code);
      if (!res.ok) {
        setError(validateErrorMessage(res.error));
        setDigits('');
      } else {
        setResult(res);
        setDigits('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur réseau');
    } finally {
      setSubmitting(false);
    }
  };

  const appendDigit = (d: string) => {
    if (submitting || result) return;
    setError(null);
    setDigits((prev) => {
      const next = (prev + d).slice(0, PIN_LEN);
      if (next.length === PIN_LEN) {
        void runValidation(next);
      }
      return next;
    });
  };

  const backspace = () => {
    setError(null);
    setResult(null);
    setDigits((prev) => prev.slice(0, -1));
  };

  const startScan = async () => {
    setError(null);
    setResult(null);
    if (!('BarcodeDetector' in window)) {
      setError(
        'Scan caméra non supporté sur ce navigateur — saisis le code PIN.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setScanOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });

      // @ts-expect-error BarcodeDetector is not in all TS lib DOM typings
      const detector = new window.BarcodeDetector({
        formats: ['qr_code'],
      });

      const tick = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          scanLoopRef.current = requestAnimationFrame(() => void tick());
          return;
        }
        try {
          const codes = await detector.detect(videoRef.current);
          if (codes?.[0]?.rawValue) {
            stopScan();
            setDigits(extractValidationCode(codes[0].rawValue).slice(0, PIN_LEN));
            await runValidation(codes[0].rawValue);
            return;
          }
        } catch {
          // keep scanning
        }
        scanLoopRef.current = requestAnimationFrame(() => void tick());
      };
      scanLoopRef.current = requestAnimationFrame(() => void tick());
    } catch {
      setError('Impossible d’accéder à la caméra.');
      stopScan();
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ds-ok" />
      </div>
    );
  }

  if (denied) {
    return (
      <div className="px-5 pt-8">
        <Link href="/" className="text-sm font-semibold text-ds-text2">
          ← Retour
        </Link>
        <p className="mt-6 text-ds-text font-bold">Accès restaurateur requis</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <DashboardProShell
      title="Validation caisse"
      subtitle={displayName ?? 'Scanner ou saisir le code client'}
      actions={
        <button
          type="button"
          onClick={() => router.push('/dashboard-pro')}
          className="text-xs font-semibold text-ds-text2"
        >
          <ArrowLeft size={16} className="inline mr-1" />
          Accueil
        </button>
      }
    >
      {/* Succès */}
      {result?.ok && (
        <div className="mb-6 rounded-2xl border border-ds-ok/30 bg-ds-ok/10 p-6 text-center animate-pop">
          <CheckCircle
            size={48}
            weight="fill"
            className="text-ds-ok mx-auto mb-3"
          />
          <p className="text-lg font-extrabold text-ds-text">
            Réduction validée !
          </p>
          <p className="text-sm text-ds-text2 mt-1">{result.title}</p>
          {typeof result.grains_awarded === 'number' && (
            <p className="text-sm font-bold text-amber-700 mt-2">
              +{result.grains_awarded} Grains
              {result.user_credited ? ' crédités' : ' (code enregistré)'}
            </p>
          )}
          <button
            type="button"
            onClick={() => setResult(null)}
            className="mt-4 text-sm font-bold text-ds-ok underline"
          >
            Valider un autre code
          </button>
        </div>
      )}

      {!result?.ok && (
        <>
          <div className="rounded-2xl bg-ds-surface border border-ds-text2/10 p-5 shadow-soft mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-ds-text2 mb-3 flex items-center gap-1.5">
              <Keyboard size={14} /> Code PIN à 4 chiffres
            </p>
            <div className="flex justify-center gap-3 mb-5">
              {Array.from({ length: PIN_LEN }).map((_, i) => (
                <div
                  key={i}
                  className={`w-12 h-14 rounded-xl border-2 flex items-center justify-center text-2xl font-extrabold tabular-nums ${
                    digits[i]
                      ? 'border-ds-ok bg-ds-ok/10 text-ds-text'
                      : 'border-ds-text2/20 text-ds-text2/30'
                  }`}
                >
                  {digits[i] ?? '·'}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 max-w-[240px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(
                (key) =>
                  key === '' ? (
                    <div key="empty" />
                  ) : (
                    <button
                      key={key}
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        key === '⌫' ? backspace() : appendDigit(key)
                      }
                      className="h-14 rounded-xl bg-ds-bg border border-ds-text2/10 text-lg font-bold text-ds-text active:scale-95 transition-all disabled:opacity-50"
                    >
                      {key}
                    </button>
                  )
              )}
            </div>

            {submitting && (
              <p className="mt-4 text-center text-sm text-ds-text2 flex items-center justify-center gap-2">
                <Spinner size={16} className="animate-spin" /> Validation…
              </p>
            )}
            {error && (
              <p className="mt-4 text-center text-sm font-medium text-ds-accent bg-ds-accent/10 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => void startScan()}
            className="w-full flex items-center justify-center gap-2 bg-ds-pin text-white font-bold py-3.5 rounded-xl shadow-md active:scale-[0.98] transition-all"
          >
            <Camera size={20} weight="bold" />
            Scanner un QR Code
          </button>
        </>
      )}

      {scanOpen && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex flex-col">
          <div className="flex items-center justify-between p-4 text-white">
            <p className="font-bold">Scan QR</p>
            <button type="button" onClick={stopScan} aria-label="Fermer">
              <X size={24} weight="bold" />
            </button>
          </div>
          <video
            ref={videoRef}
            className="flex-1 w-full object-cover"
            playsInline
            muted
          />
          <p className="p-4 text-center text-sm text-white/80">
            Cadre le QR du client (ou le PIN DropSpot)
          </p>
        </div>
      )}
    </DashboardProShell>
  );
}
