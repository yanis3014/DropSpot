'use client';

import { useEffect, useState } from 'react';
import { DownloadSimple, X } from '@phosphor-icons/react';

const DISMISS_KEY = 'dropspot_android_install_dismissed_at';
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

/** Minimal typing for the Chromium beforeinstallprompt event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
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

function markDismissed(now = Date.now()): void {
  try {
    localStorage.setItem(DISMISS_KEY, String(now));
  } catch {
    // ignore
  }
}

function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

/**
 * Android / Chromium: custom install banner using beforeinstallprompt.
 * Does not fire on iOS Safari — safe alongside IosInstallPrompt.
 */
export default function AndroidInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (isStandalonePwa()) return;
    if (wasDismissedRecently()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (wasDismissedRecently()) return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    markDismissed();
    setDeferredPrompt(null);
  };

  const install = async () => {
    if (!deferredPrompt || installing) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === 'dismissed') {
        markDismissed();
      }
    } catch {
      setDeferredPrompt(null);
    } finally {
      setInstalling(false);
    }
  };

  if (!deferredPrompt) return null;

  return (
    <div
      className="fixed inset-x-0 z-[90] flex justify-center pointer-events-none px-3"
      style={{
        bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
      }}
      role="dialog"
      aria-label="Installer DropSpot"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-brand-mocha/15 bg-brand-surface/95 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.18)] p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-matcha/15 text-brand-matcha flex items-center justify-center flex-shrink-0">
            <DownloadSimple size={22} weight="bold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-brand-espresso leading-snug">
              Installe DropSpot sur ton écran d&apos;accueil pour un accès
              instantané.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void install()}
                disabled={installing}
                className="flex-1 bg-brand-matcha text-white text-sm font-extrabold py-2.5 rounded-xl shadow-sm shadow-brand-matcha/25 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {installing ? 'Installation…' : "Installer l'app"}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="flex-shrink-0 px-3 py-2.5 text-sm font-semibold text-brand-mocha hover:text-brand-espresso transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="flex-shrink-0 w-7 h-7 rounded-full bg-brand-mocha/10 text-brand-mocha flex items-center justify-center active:scale-90"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}
