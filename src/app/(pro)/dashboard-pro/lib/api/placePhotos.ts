import { supabase } from '@/lib/supabase/client';

const BUCKET = 'place-photos';
/** Pro — aligns with product maquette. */
export const MAX_PHOTOS_PER_CATEGORY = 8;
/** Free plan — must match `enforce_place_media_pro` in migrations. */
export const FREE_VENUE_PHOTO_MAX = 3;

export type PlaceMediaCategory = 'venue' | 'food' | 'menu';

export interface PlaceMedia {
  id: string;
  place_id: string;
  category: PlaceMediaCategory;
  url: string;
  storage_path: string | null;
  sort_order: number;
  created_at: string;
}

async function requireUserId(): Promise<string> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return user.id;
}

/** Synchronise places.image_url avec la 1re photo venue (cover B2C). */
async function syncPlaceCover(placeId: string): Promise<string | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('place_media')
    .select('url')
    .eq('place_id', placeId)
    .eq('category', 'venue')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error reading venue cover:', error);
    return null;
  }

  const coverUrl = data?.[0]?.url ?? null;
  const { error: updateError } = await supabase
    .from('places')
    .update({ image_url: coverUrl })
    .eq('id', placeId);

  if (updateError) {
    console.error('Error syncing place cover:', updateError);
  }
  return coverUrl;
}

function normalizeMedia(row: Record<string, unknown>): PlaceMedia {
  return {
    id: String(row.id),
    place_id: String(row.place_id),
    category: row.category as PlaceMediaCategory,
    url: String(row.url),
    storage_path:
      typeof row.storage_path === 'string' ? row.storage_path : null,
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at ?? ''),
  };
}

export async function listPlaceMedia(placeId: string): Promise<PlaceMedia[]> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const { data, error } = await supabase
    .from('place_media')
    .select('id, place_id, category, url, storage_path, sort_order, created_at')
    .eq('place_id', placeId)
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error listing place media:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizeMedia);
}

export async function uploadPlaceMedia(
  placeId: string,
  file: File,
  category: PlaceMediaCategory
): Promise<PlaceMedia> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const userId = await requireUserId();

  const existing = await listPlaceMedia(placeId);
  const inCategory = existing.filter((m) => m.category === category);
  if (inCategory.length >= MAX_PHOTOS_PER_CATEGORY) {
    throw new Error(
      `Maximum ${MAX_PHOTOS_PER_CATEGORY} photos pour cette catégorie.`
    );
  }

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${placeId}/${category}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    console.error('Upload place media error:', uploadError);
    throw uploadError;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!urlData?.publicUrl) throw new Error('URL publique indisponible');

  const nextOrder =
    inCategory.reduce((max, m) => Math.max(max, m.sort_order), -1) + 1;

  const { data, error } = await supabase
    .from('place_media')
    .insert({
      place_id: placeId,
      category,
      url: urlData.publicUrl,
      storage_path: path,
      sort_order: nextOrder,
    })
    .select('id, place_id, category, url, storage_path, sort_order, created_at')
    .single();

  if (error) {
    console.error('Insert place_media error:', error);
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    throw error;
  }

  if (category === 'venue') {
    await syncPlaceCover(placeId);
  }

  return normalizeMedia(data as Record<string, unknown>);
}

export async function deletePlaceMedia(mediaId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  await requireUserId();

  const { data: row, error: fetchError } = await supabase
    .from('place_media')
    .select('id, place_id, category, storage_path')
    .eq('id', mediaId)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching place media:', fetchError);
    throw fetchError;
  }
  if (!row) throw new Error('Photo introuvable');

  const placeId = String(row.place_id);
  const category = row.category as PlaceMediaCategory;
  const storagePath =
    typeof row.storage_path === 'string' ? row.storage_path : null;

  const { error: deleteError } = await supabase
    .from('place_media')
    .delete()
    .eq('id', mediaId);

  if (deleteError) {
    console.error('Error deleting place media:', deleteError);
    throw deleteError;
  }

  if (storagePath) {
    await supabase.storage.from(BUCKET).remove([storagePath]).catch((err) => {
      console.warn('Storage remove failed (row already deleted):', err);
    });
  }

  if (category === 'venue') {
    await syncPlaceCover(placeId);
  }
}

/**
 * Upload couverture (onboarding / legacy).
 * Enregistre aussi une entrée `venue` dans place_media quand la table existe.
 */
export async function uploadPlacePhoto(
  placeId: string,
  file: File
): Promise<string> {
  try {
    const media = await uploadPlaceMedia(placeId, file, 'venue');
    return media.url;
  } catch (err) {
    // Fallback si place_media n’est pas encore migrée
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : '';
    const message =
      err instanceof Error ? err.message : String(err ?? '');
    if (
      code !== 'PGRST205' &&
      code !== '42P01' &&
      !/place_media|does not exist|schema cache/i.test(message)
    ) {
      throw err;
    }
  }

  if (!supabase) throw new Error('Supabase client not initialized');
  const userId = await requireUserId();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${placeId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type || 'image/jpeg',
    });

  if (uploadError) {
    console.error('Upload place photo error:', uploadError);
    throw uploadError;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) throw new Error('URL publique indisponible');

  await supabase
    .from('places')
    .update({ image_url: data.publicUrl })
    .eq('id', placeId);

  return data.publicUrl;
}
