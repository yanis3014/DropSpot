'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Coffee,
  Lightning,
  QrCode,
  Storefront,
  LockKey,
  ArrowLeft,
  Grains,
  CheckCircle,
} from '@phosphor-icons/react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useVendorProfile } from '@/app/dashboard-pro/hooks/useVendorProfile';
import {
  countActiveVendorFlashDrops,
  countVendorPlaces,
  getVendorFlashDrops,
  getVendorPlaces,
  type FlashDrop,
} from '@/app/dashboard-pro/lib/api/vendor';
import { Place } from '@/lib/api/places';
import { isFlashDropLive } from '@/app/dashboard-pro/lib/api/flashDrops';
import FlashDropForm from '@/app/dashboard-pro/components/FlashDropForm';
import DashboardProShell from '@/app/dashboard-pro/components/DashboardProShell';
import {
  getVendorTodayStats,
  type VendorTodayStats,
} from '@/app/dashboard-pro/lib/api/validate';
import { supabase } from '@/lib/supabase/client';

function formatEndsAt(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function DashboardProPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center pb-24 min-h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
        </div>
      }
    >
      <DashboardProPageContent />
    </Suspense>
  );
}

function DashboardProPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading, displayName, email, signOut } =
    useAuth();
  const { profile, loading: profileLoading } = useVendorProfile(
    isAuthenticated,
    authLoading
  );
  const [places, setPlaces] = useState<Place[]>([]);
  const [drops, setDrops] = useState<FlashDrop[]>([]);
  const [spotsCount, setSpotsCount] = useState(0);
  const [activeDropsCount, setActiveDropsCount] = useState(0);
  const [today, setToday] = useState<VendorTodayStats>({
    validations_today: 0,
    grains_awarded_today: 0,
  });
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [welcomeToast, setWelcomeToast] = useState(false);
  const [redirectingOnboard, setRedirectingOnboard] = useState(false);

  const loadVendorData = useCallback(async (vendorId: string) => {
    setDataLoading(true);
    setDataError(null);
    try {
      const [vendorPlaces, vendorDrops, placesN, activeN, stats] =
        await Promise.all([
          getVendorPlaces(vendorId),
          getVendorFlashDrops(vendorId),
          countVendorPlaces(vendorId),
          countActiveVendorFlashDrops(vendorId),
          getVendorTodayStats(),
        ]);

      // Guard : aucun spot → tunnel d'onboarding
      if (placesN === 0 || vendorPlaces.length === 0) {
        setRedirectingOnboard(true);
        router.replace('/dashboard-pro/onboarding');
        return;
      }

      setPlaces(vendorPlaces);
      setDrops(vendorDrops);
      setSpotsCount(placesN);
      setActiveDropsCount(activeN);
      setToday(stats);
    } catch (err) {
      console.error('Error loading vendor data:', err);
      setDataError(
        err instanceof Error
          ? err.message
          : 'Impossible de charger les données.'
      );
    } finally {
      setDataLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading || profileLoading) return;
    if (!isAuthenticated) {
      router.replace('/login?redirect=/dashboard-pro');
      return;
    }
    if (!profile) return;
    void loadVendorData(profile.id);
  }, [
    authLoading,
    profileLoading,
    isAuthenticated,
    profile,
    router,
    loadVendorData,
  ]);

  useEffect(() => {
    if (searchParams.get('onboarded') !== '1') return;
    setWelcomeToast(true);
    router.replace('/dashboard-pro', { scroll: false });
    const t = setTimeout(() => setWelcomeToast(false), 5000);
    return () => clearTimeout(t);
  }, [searchParams, router]);

  // Temps réel : nouvelles validations → refresh stats du jour
  useEffect(() => {
    if (!profile || !supabase) return;

    const channel = supabase
      .channel(`vendor-redemptions-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'flash_drop_redemptions',
          filter: `vendor_id=eq.${profile.id}`,
        },
        () => {
          void getVendorTodayStats().then(setToday);
          void getVendorFlashDrops(profile.id).then(setDrops);
        }
      )
      .subscribe();

    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [profile]);

  if (authLoading || profileLoading || redirectingOnboard) {
    return (
      <div className="flex-1 flex items-center justify-center pb-24 min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  if (!profile) {
    return (
      <div className="flex-1 pb-24 px-5 pt-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-mocha hover:text-brand-espresso mb-8"
        >
          <ArrowLeft size={16} weight="bold" /> Retour
        </Link>
        <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50/80 p-8 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-400 shadow-sm mb-4">
            <LockKey size={28} weight="duotone" />
          </div>
          <h1 className="text-xl font-extrabold text-brand-espresso mb-2">
            Accès restaurateur requis
          </h1>
          <p className="text-sm text-brand-mocha max-w-sm mx-auto leading-relaxed">
            Ton compte n&apos;a pas le rôle <strong>vendor</strong> ou{' '}
            <strong>owner</strong>.
          </p>
        </div>
      </div>
    );
  }

  const name =
    profile.full_name || displayName || email?.split('@')[0] || 'Partenaire';

  return (
    <DashboardProShell
      title="Dashboard"
      subtitle={`Bonjour ${name} · ${profile.role}`}
      actions={
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs font-semibold text-brand-mocha hover:text-brand-espresso shrink-0"
        >
          Déconnexion
        </button>
      }
    >
      {welcomeToast && (
        <p className="mb-4 flex items-center gap-2 text-sm font-medium text-brand-green bg-brand-green/10 rounded-xl px-3 py-2.5">
          <CheckCircle size={18} weight="fill" className="shrink-0" />
          Établissement configuré — bienvenue sur ton dashboard !
        </p>
      )}

      {dataError && (
        <p className="mb-4 text-sm font-medium text-brand-terracotta bg-brand-terracotta/10 rounded-xl px-3 py-2">
          {dataError}
        </p>
      )}

      {/* Stats du jour (temps réel) */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-2xl bg-brand-surface border border-brand-mocha/10 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-brand-mocha mb-2">
            <QrCode size={18} weight="duotone" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Validations aujourd&apos;hui
            </span>
          </div>
          <p className="text-2xl font-extrabold text-brand-espresso tabular-nums">
            {dataLoading ? '—' : today.validations_today}
          </p>
        </div>
        <div className="rounded-2xl bg-brand-surface border border-brand-mocha/10 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-brand-mocha mb-2">
            <Grains size={18} weight="duotone" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Grains distribués
            </span>
          </div>
          <p className="text-2xl font-extrabold text-amber-700 tabular-nums">
            {dataLoading ? '—' : today.grains_awarded_today}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl bg-brand-surface border border-brand-mocha/10 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-brand-mocha mb-2">
            <Storefront size={18} weight="duotone" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Spots
            </span>
          </div>
          <p className="text-2xl font-extrabold text-brand-espresso tabular-nums">
            {dataLoading ? '—' : spotsCount}
          </p>
        </div>
        <div className="rounded-2xl bg-brand-surface border border-brand-mocha/10 p-4 shadow-soft">
          <div className="flex items-center gap-2 text-brand-mocha mb-2">
            <Lightning size={18} weight="duotone" />
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Flash actifs
            </span>
          </div>
          <p className="text-2xl font-extrabold text-brand-espresso tabular-nums">
            {dataLoading ? '—' : activeDropsCount}
          </p>
        </div>
      </div>

      <Link
        href="/dashboard-pro/validate"
        className="mb-6 flex items-center justify-center gap-2 w-full bg-brand-green text-white font-bold py-3.5 rounded-xl shadow-md active:scale-[0.98] transition-all"
      >
        <QrCode size={20} weight="bold" />
        Valider une offre en caisse
      </Link>

      <FlashDropForm
        places={places}
        onCreated={() => void loadVendorData(profile.id)}
      />

      <section className="mt-6">
        <h2 className="text-base font-extrabold text-brand-espresso mb-3 flex items-center gap-2">
          <Coffee size={18} weight="fill" className="text-brand-green" />
          Tes derniers drops
        </h2>
        {dataLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </div>
        ) : drops.length === 0 ? (
          <p className="text-sm text-brand-mocha rounded-2xl border border-dashed border-gray-300 bg-white/50 p-6 text-center">
            Aucun flash drop — publie-en un ci-dessus.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {drops.map((drop) => {
              const live = isFlashDropLive(drop);
              return (
                <li
                  key={drop.id}
                  className="rounded-2xl border border-brand-mocha/10 bg-brand-surface p-3.5 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-brand-espresso truncate">
                      {drop.title}
                    </p>
                    <p className="text-[11px] text-brand-mocha truncate mt-0.5">
                      {drop.places?.name ?? 'Spot'} · expire{' '}
                      {formatEndsAt(drop.ends_at)}
                      {typeof drop.current_uses === 'number' &&
                        ` · ${drop.current_uses} val.`}
                    </p>
                    {drop.pin_code && (
                      <p className="mt-1 text-xs font-extrabold tracking-[0.2em] text-brand-green tabular-nums">
                        PIN {drop.pin_code}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full ${
                      live
                        ? 'bg-brand-green/15 text-brand-green'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {live ? 'Live' : 'Expiré'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </DashboardProShell>
  );
}
