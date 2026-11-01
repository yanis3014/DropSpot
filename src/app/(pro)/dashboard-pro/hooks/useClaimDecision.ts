'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  fetchProAccessStatus,
  PRO_WELCOME_PATH,
} from '@/lib/pro/accessStatus';

/** Fallback when Realtime is off or the tab slept. */
const CLAIM_POLL_MS = 20_000;

export type ClaimDecision =
  | { kind: 'waiting' }
  | { kind: 'rejected'; note: string | null };

/**
 * Waiting screen: listens to the admin's decision on `claimId`.
 * Approved → full page load to the welcome screen (fresh rights everywhere).
 * Rejected → returned so the wizard can say it and offer to start again.
 */
export function useClaimDecision(claimId: string | null): ClaimDecision {
  const [decision, setDecision] = useState<ClaimDecision>({ kind: 'waiting' });

  useEffect(() => {
    const client = supabase;
    if (!client || !claimId) return;

    let cancelled = false;
    let done = false;

    const check = async () => {
      if (cancelled || done) return;
      const { data, error } = await client
        .from('place_claims')
        .select('status, note')
        .eq('id', claimId)
        .maybeSingle();
      if (cancelled || done || error || !data) return;

      if (data.status === 'approved') {
        done = true;
        // The proxy and the welcome page re-check on the server.
        const status = await fetchProAccessStatus(client);
        window.location.replace(
          status?.state === 'active' ? '/dashboard-pro' : PRO_WELCOME_PATH
        );
        return;
      }
      if (data.status === 'rejected') {
        done = true;
        setDecision({
          kind: 'rejected',
          note: typeof data.note === 'string' && data.note.trim() ? data.note : null,
        });
      }
    };

    const channel = client
      .channel(`claim-decision-${claimId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'place_claims',
          filter: `id=eq.${claimId}`,
        },
        () => {
          void check();
        }
      )
      .subscribe();

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check();
    }, CLAIM_POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    void check();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      void client.removeChannel(channel);
    };
  }, [claimId]);

  return decision;
}
