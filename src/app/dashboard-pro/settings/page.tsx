'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardProShell from '@/app/dashboard-pro/components/DashboardProShell';
import PlaceEditorForm from '@/app/dashboard-pro/components/PlaceEditorForm';
import { useRequireVendor } from '@/app/dashboard-pro/hooks/useRequireVendor';
import { getVendorPlaces } from '@/app/dashboard-pro/lib/api/vendor';
import { Place } from '@/lib/api/places';

export default function DashboardSettingsPage() {
  const { profile, loading, denied, displayName } = useRequireVendor();
  const [places, setPlaces] = useState<Place[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  const load = useCallback(async (vendorId: string) => {
    setDataLoading(true);
    try {
      setPlaces(await getVendorPlaces(vendorId));
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    void load(profile.id);
  }, [profile, load]);

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
        <p className="mt-6 font-bold text-ds-text">
          Accès restaurateur requis
        </p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <DashboardProShell
      title="Fiche café"
      subtitle={displayName ?? 'Personnalise ton établissement'}
    >
      {dataLoading ? (
        <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
      ) : places.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ds-text2/25 bg-ds-surface p-8 text-center">
          <p className="font-bold text-ds-text mb-2">
            Aucun café associé
          </p>
          <p className="text-sm text-ds-text2 mb-5">
            Configure ton établissement pour éditer la fiche.
          </p>
          <Link
            href="/dashboard-pro/onboarding"
            className="inline-flex items-center justify-center rounded-xl bg-ds-ok text-white font-bold text-sm px-5 py-3"
          >
            Lancer l&apos;onboarding
          </Link>
        </div>
      ) : (
        <PlaceEditorForm
          places={places}
          onSaved={(updated) =>
            setPlaces((prev) =>
              prev.map((p) => (p.id === updated.id ? updated : p))
            )
          }
        />
      )}
    </DashboardProShell>
  );
}
