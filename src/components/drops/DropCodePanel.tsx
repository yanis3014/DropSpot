'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { CheckCircle, WifiSlash, X } from '@phosphor-icons/react';
import GrainsToast from '@/components/ui/GrainsToast';
import {
  fetchFlashDropGrainsAmount,
  writeLastShownDropCode,
  type LastShownDropCode,
} from '@/lib/api/dropCodes';
import { formatDropCodeDisplay } from '@/lib/dropCodes/format';
import {
  resolveDropCodeScreen,
  type DropCodeStatus,
} from '@/lib/dropCodes/screen';
import { formatParisTimeHHMM } from '@/app/(pro)/dashboard-pro/lib/proHome/parisTime';
import { supabase } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';

export type DropCodePanelProps = {
  dropCodeId: string;
  code: string;
  title: string;
  cafeName: string;
  endsAt: string;
  initialStatus?: DropCodeStatus;
  onClose: () => void;
};

function subscribeOnline(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

function getOnlineSnapshot() {
  return navigator.onLine;
}

function getOnlineServerSnapshot() {
  return true;
}

export default function DropCodePanel({
  dropCodeId,
  code,
  title,
  cafeName,
  endsAt,
  initialStatus = 'issued',
  onClose,
}: DropCodePanelProps) {
  const online = useSyncExternalStore(
    subscribeOnline,
    getOnlineSnapshot,
    getOnlineServerSnapshot
  );
  const [status, setStatus] = useState<DropCodeStatus>(initialStatus);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [grainsAmount, setGrainsAmount] = useState<number | null | undefined>(
    undefined
  );
  const [visible, setVisible] = useState(false);

  const screen = resolveDropCodeScreen(status);
  const display = formatDropCodeDisplay(code);
  const validUntil = endsAt ? formatParisTimeHHMM(endsAt) : null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const snapshot: LastShownDropCode = {
      id: dropCodeId,
      code,
      title,
      cafeName,
      endsAt,
      status,
    };
    writeLastShownDropCode(snapshot);
  }, [dropCodeId, code, title, cafeName, endsAt, status]);

  useEffect(() => {
    let cancelled = false;
    void import('qrcode').then(async (QRCode) => {
      try {
        const url = await QRCode.toDataURL(code.toUpperCase(), {
          errorCorrectionLevel: 'M',
          margin: 2,
          width: 220,
          color: { dark: '#231915', light: '#FFFFFF' },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch (err) {
        console.error('QR generation failed:', err);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    const client = supabase;
    if (!client || !dropCodeId) return;

    const channel = client
      .channel(`drop-code-${dropCodeId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'drop_codes',
          filter: `id=eq.${dropCodeId}`,
        },
        (payload) => {
          const next = (payload.new as { status?: string } | null)?.status;
          if (next === 'redeemed' || next === 'cancelled' || next === 'issued') {
            setStatus(next);
          }
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [dropCodeId]);

  useEffect(() => {
    if (status !== 'redeemed') return;
    let cancelled = false;
    void fetchFlashDropGrainsAmount(dropCodeId).then((amount) => {
      if (!cancelled) setGrainsAmount(amount);
    });
    return () => {
      cancelled = true;
    };
  }, [status, dropCodeId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 220);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        aria-label="Fermer"
        onClick={handleClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Ton code"
        className={cn(
          'relative z-[71] flex w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-ds-bg shadow-2xl transition-transform duration-300 ease-out sm:rounded-3xl',
          visible ? 'translate-y-0' : 'translate-y-full sm:translate-y-4 sm:opacity-0'
        )}
      >
        <div className="flex items-center justify-between px-5 pb-1 pt-5">
          <h2 className="font-display m-0 text-2xl font-extrabold text-ds-text">
            {screen === 'validated'
              ? 'Validé !'
              : screen === 'cancelled'
                ? 'Annulé'
                : 'Ton code'}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="rounded-full bg-ds-surface2 p-2 text-ds-text transition-transform active:scale-95"
          >
            <X size={20} weight="bold" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-4 px-5 pb-8 pt-3">
          {screen === 'validated' ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ds-oksoft text-ds-ok">
                <CheckCircle size={36} weight="fill" aria-hidden />
              </div>
              <p className="m-0 text-center text-[15px] text-ds-text2">
                Le café a validé ton code.
              </p>
              {grainsAmount === undefined ? null : grainsAmount != null ? (
                <GrainsToast amount={grainsAmount} />
              ) : (
                <GrainsToast message="Validé · merci !" />
              )}
            </>
          ) : screen === 'cancelled' ? (
            <p className="m-0 rounded-2xl bg-ds-warnsoft px-4 py-3.5 text-center text-[15px] font-semibold text-ds-warn">
              Validation annulée par le café
            </p>
          ) : (
            <>
              {!online ? (
                <div
                  role="status"
                  className="flex w-full items-start gap-2.5 rounded-[14px] bg-ds-surface2 px-3.5 py-3 text-sm font-semibold text-ds-text"
                >
                  <WifiSlash size={18} className="mt-0.5 shrink-0" aria-hidden />
                  Pas de connexion : le café vérifiera ton code au comptoir
                </div>
              ) : null}

              <div className="flex h-[220px] w-[220px] items-center justify-center rounded-2xl border border-ds-line bg-white p-3">
                {qrDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrDataUrl}
                    alt={`QR code ${display}`}
                    width={220}
                    height={220}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="h-16 w-16 animate-pulse rounded-xl bg-ds-surface2" />
                )}
              </div>

              <p className="font-display m-0 text-[40px] font-extrabold tracking-widest text-ds-text tabular-nums">
                {display}
              </p>

              <div className="flex w-full flex-col items-center gap-1 text-center">
                <p className="m-0 text-lg font-bold text-ds-text">{title}</p>
                <p className="m-0 text-[15px] text-ds-text2">{cafeName}</p>
                {validUntil ? (
                  <p className="m-0 text-[15px] font-semibold text-ds-accenttext">
                    Valable jusqu&apos;à {validUntil}
                  </p>
                ) : null}
              </div>

              <p className="m-0 text-center text-sm font-semibold text-ds-text2">
                Montre ce code au comptoir
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
