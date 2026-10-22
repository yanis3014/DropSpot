'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  getMyParticipationIds,
  getParticipantCounts,
  joinDrop,
  leaveDrop,
  participationErrorMessage,
} from '@/lib/api/drops';

/**
 * « Je participe » state for a list of events: public counts, the user's own
 * participations and a join / leave toggle (places checked by the server).
 */
export function useDropParticipation(eventIds: string[], isAuthenticated: boolean) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [joinedIds, setJoinedIds] = useState<string[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<{ dropId: string; message: string } | null>(null);
  const idsKey = eventIds.join(',');

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    getParticipantCounts(idsKey.split(','))
      .then((next) => {
        if (!cancelled) setCounts((prev) => ({ ...prev, ...next }));
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  useEffect(() => {
    let cancelled = false;
    (isAuthenticated ? getMyParticipationIds() : Promise.resolve([] as string[]))
      .then((ids) => {
        if (!cancelled) setJoinedIds(ids);
      })
      .catch((err) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  /** Returns false when the user must sign in first. */
  const toggle = useCallback(
    async (dropId: string): Promise<boolean> => {
      if (!isAuthenticated) return false;
      const joined = joinedIds.includes(dropId);
      setBusyId(dropId);
      setError(null);
      try {
        const result = joined ? await leaveDrop(dropId) : await joinDrop(dropId);
        if (!result.ok) {
          setError({ dropId, message: participationErrorMessage(result.error) });
          return true;
        }
        setCounts((prev) => ({ ...prev, [dropId]: result.participants }));
        setJoinedIds((prev) =>
          result.joined
            ? prev.includes(dropId)
              ? prev
              : [...prev, dropId]
            : prev.filter((id) => id !== dropId)
        );
      } catch (err) {
        console.error(err);
        setError({ dropId, message: participationErrorMessage('unknown') });
      } finally {
        setBusyId(null);
      }
      return true;
    },
    [isAuthenticated, joinedIds]
  );

  return {
    participants: (dropId: string) => counts[dropId] ?? 0,
    isJoined: (dropId: string) => joinedIds.includes(dropId),
    busyId,
    error,
    toggle,
  };
}
