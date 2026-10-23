'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin } from '@phosphor-icons/react';
import ProfileSubHeader from '@/components/profile/ProfileSubHeader';
import ContributionList from '@/components/profile/ContributionList';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/lib/hooks/useAuth';
import {
  getMyContributions,
  type ContributionItem,
} from '@/lib/api/contributions';

const CONTRIBUTIONS_LIMIT = 50;

/** Everything that earned Grains, newest first. */
export default function ProfileContributionsPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [items, setItems] = useState<ContributionItem[] | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void getMyContributions(CONTRIBUTIONS_LIMIT).then((rows) => {
      if (!cancelled) setItems(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <main className="flex flex-1 flex-col gap-4 bg-ds-bg px-4 pb-28 pt-8">
      <ProfileSubHeader title="Mes contributions" />

      {items === null ? (
        <div className="h-[168px] animate-pulse rounded-[22px] bg-ds-surface2" />
      ) : items.length === 0 ? (
        <div className="rounded-[22px] border border-ds-line bg-ds-surface py-8">
          <EmptyState
            icon={<MapPin weight="regular" />}
            title="Aucune contribution"
            description="Dis « Je suis ici » dans un café pour gagner tes premiers Grains."
            actionLabel="Voir la carte"
            onAction={() => router.push('/map')}
          />
        </div>
      ) : (
        <ContributionList items={items} />
      )}
    </main>
  );
}
