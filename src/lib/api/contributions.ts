import { supabase } from '@/lib/supabase/client';
import { isSpecId, specLabel, type SpecId } from '@/lib/specs';

export type ContributionKind = 'check_in' | 'spec_vote';

export type ContributionItem = {
  id: string;
  kind: ContributionKind;
  title: string;
  placeName: string;
  createdAt: string;
  gain: number | null;
  spec?: SpecId;
};

type PlaceNameJoin =
  | { name: string | null }
  | { name: string | null }[]
  | null;

function placeName(places: PlaceNameJoin): string {
  const row = Array.isArray(places) ? places[0] : places;
  return row?.name?.trim() || 'Spot inconnu';
}

/** Recent « Je suis ici » and Yes / No answers by the signed-in user. */
export async function getMyContributions(
  limit = 20
): Promise<ContributionItem[]> {
  try {
    if (!supabase) return [];
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    const [checkInsRes, votesRes] = await Promise.all([
      supabase
        .from('check_ins')
        .select('id, created_at, crowd_level, wifi_speed, places(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('place_spec_votes')
        .select('place_id, spec, vote, updated_at, places(name)')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(limit),
    ]);

    if (checkInsRes.error) {
      console.error('Error fetching check-in contributions:', checkInsRes.error);
    }
    if (votesRes.error) {
      console.error('Error fetching vote contributions:', votesRes.error);
    }

    const checkIns: ContributionItem[] = (
      (checkInsRes.data ?? []) as {
        id: string;
        created_at: string;
        wifi_speed: string;
        places: PlaceNameJoin;
      }[]
    ).map((row) => ({
      id: `check_in:${row.id}`,
      kind: 'check_in' as const,
      title: 'Ambiance partagée',
      placeName: placeName(row.places),
      createdAt: row.created_at,
      // Grains are only awarded with proximity + cooldown — unknown from check_ins alone
      gain: null,
    }));

    const votes: ContributionItem[] = (
      (votesRes.data ?? []) as {
        place_id: string;
        spec: string;
        vote: boolean;
        updated_at: string;
        places: PlaceNameJoin;
      }[]
    )
      .filter((row) => isSpecId(row.spec))
      .map((row) => {
        const spec = row.spec as SpecId;
        return {
          id: `spec_vote:${row.place_id}:${spec}`,
          kind: 'spec_vote' as const,
          title: `${specLabel(spec)} : ${row.vote ? 'oui' : 'non'}`,
          placeName: placeName(row.places),
          createdAt: row.updated_at,
          gain: null,
          spec,
        };
      });

    return [...checkIns, ...votes]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, limit);
  } catch (error) {
    console.error('Error in getMyContributions:', error);
    return [];
  }
}
