import { supabase } from '@/lib/supabase/client';
import { Place } from '@/lib/api/places';

export interface SavedPlace {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
  places: Place;
}

async function getUserId(): Promise<string | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/** Places saved by the current user, newest first (with joined place data). */
export async function getSavedPlaces(): Promise<SavedPlace[]> {
  try {
    if (!supabase) return [];
    const userId = await getUserId();
    if (!userId) return [];

    const { data, error } = await supabase
      .from('saved_places')
      .select('*, places(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching saved places:', error);
      return [];
    }

    return (data ?? []) as SavedPlace[];
  } catch (error) {
    console.error('Error in getSavedPlaces:', error);
    return [];
  }
}

/** Just the place_ids the user has saved — used to mark heart states in the feed. */
export async function getSavedPlaceIds(): Promise<string[]> {
  const saved = await getSavedPlaces();
  return saved.map((s) => s.place_id);
}

export async function savePlace(placeId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('saved_places')
    .insert({ user_id: userId, place_id: placeId });

  // Ignore duplicate-save races (unique constraint violation)
  if (error && error.code !== '23505') {
    console.error('Error saving place:', error);
    throw error;
  }
}

export async function unsavePlace(placeId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const userId = await getUserId();
  if (!userId) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('saved_places')
    .delete()
    .eq('user_id', userId)
    .eq('place_id', placeId);

  if (error) {
    console.error('Error removing saved place:', error);
    throw error;
  }
}
