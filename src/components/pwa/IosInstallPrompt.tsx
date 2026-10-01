'use client';

import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';

const DISMISS_KEY = 'dropspot_ios_install_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isIosDevice(ua: string): boolean {
  return /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ may report as Mac with touch
    (ua.includes('Mac') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia('(display-mode: standalone)').matches;
}

function wasDismissedRecently(now = Date.now()): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return now - at < DISMISS_MS;
  } catch {
    return false;
  }
}

/** Inline Apple-style share icon (square + arrow up). */
function ShareIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={`inline-block align-[-3px] ${className}`}
      width={18}
      height={18}
    >
      <path
        d="M12 3v11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M8 7l4-4 4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * iOS Safari: tip to install DropSpot via Share → Sur l'écran d'accueil.
 * Hidden when already installed, non-iOS, or dismissed within 7 days.
 */
export default function IosInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent || '';
    if (!isIosDevice(ua)) return;
    if (isStandalonePwa()) return;
    if (wasDismissedRecently()) return;
    setVisible(true);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 z-[90] flex justify-center pointer-events-none px-3"
      style={{
        // Above app BottomNav (~4.5rem) + Safari home indicator
        bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
      }}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-white/40 bg-white/75 dark:bg-[#2a211c]/85 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] px-3.5 py-3 flex items-start gap-2.5">
        <p className="flex-1 min-w-0 text-[13px] leading-snug text-brand-espresso font-medium">
          Pour installer l&apos;app, touchez{' '}
          <span className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded-md bg-brand-matcha/10 text-brand-matcha font-bold align-middle">
            <ShareIcon className="text-brand-matcha" />
          </span>{' '}
          puis &apos;Sur l&apos;écran d&apos;accueil&apos; 📱
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Fermer"
          className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-mocha/10 text-brand-mocha flex items-center justify-center active:scale-90 transition-transform"
        >
          <X size={14} weight="bold" />
        </button>
      </div>
    </div>
  );
}
