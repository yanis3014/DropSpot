'use client';

import Link from 'next/link';
import ProfileSubHeader from '@/components/profile/ProfileSubHeader';
import Button from '@/components/ui/Button';
import { ENVIE_ICONS } from '@/components/onboarding/icons';
import { useAuth } from '@/lib/hooks/useAuth';
import { useProfile } from '@/lib/hooks/useProfile';
import { envieLabel } from '@/lib/onboarding';

/** The envies chosen at onboarding, with a way to change them. */
export default function ProfileEnviesPage() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { profile, loading } = useProfile(isAuthenticated, authLoading);
  const envies = profile?.onboarding_answers.envies ?? [];

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
      <ProfileSubHeader title="Mes envies" />

      {loading ? (
        <div className="h-9 w-2/3 animate-pulse rounded-[18px] bg-ds-surface2" />
      ) : envies.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {envies.map((id) => {
            const EnvieIcon = ENVIE_ICONS[id];
            return (
              <span
                key={id}
                className="inline-flex h-9 items-center gap-1.5 rounded-[18px] bg-ds-accentsoft px-3.5 text-sm font-semibold text-ds-accenttext"
              >
                <EnvieIcon size={16} aria-hidden />
                {envieLabel(id)}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="m-0 text-[15px] text-ds-text2">
          Tu n’as pas encore choisi tes envies.
        </p>
      )}

      <p className="m-0 text-sm text-ds-text2">
        On s’en sert pour te proposer les cafés et les drops qui te ressemblent.
      </p>

      <Link href="/onboarding?edit=1" className="no-underline">
        <Button variant="tonal" className="w-full">
          {envies.length > 0 ? 'Modifier mes envies' : 'Choisir mes envies'}
        </Button>
      </Link>
    </main>
  );
}
