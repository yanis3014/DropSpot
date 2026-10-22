import { supabase } from '@/lib/supabase/client';
import { normalizePlace, Place } from '@/lib/api/places';
import {
  geocodeAddress,
  NICE_CENTER,
  placeLocationPayload,
  placeLocationWkt,
} from '@/lib/geocode';
import {
  normalizeNoiseLevel,
  normalizePlugsLevel,
  normalizeWifiSpeed,
} from '@/lib/placeAmenities';

export type VendorRole = 'user' | 'vendor' | 'owner';

export type PlaceMemberRole = 'owner' | 'manager' | 'staff';

export interface PlaceMembershipRow {
  place: Place;
  role: PlaceMemberRole;
}

export interface VendorProfile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: VendorRole;
  updated_at?: string;
}

export interface VendorProfilePatch {
  full_name?: string | null;
  avatar_url?: string | null;
}

function normalizeVendor(row: Record<string, unknown>): VendorProfile {
  const rawRole = typeof row.role === 'string' ? row.role : 'user';
  const role: VendorRole =
    rawRole === 'vendor' || rawRole === 'owner' ? rawRole : 'user';

  return {
    id: String(row.id),
    full_name: (row.full_name as string | null) ?? null,
    avatar_url: (row.avatar_url as string | null) ?? null,
    role,
    updated_at: row.updated_at as string | undefined,
  };
}

/** Profil connecté avec rôle — null si non auth / erreur. */
export async function getVendorProfile(): Promise<VendorProfile | null> {
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url, role, updated_at')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    if (error.code === '42703' || error.message?.includes('role')) {
      const fallback = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, updated_at')
        .eq('id', user.id)
        .maybeSingle();
      if (fallback.error || !fallback.data) {
        console.error('Error fetching vendor profile:', fallback.error ?? error);
        return null;
      }
      return normalizeVendor({ ...fallback.data, role: 'user' });
    }
    console.error('Error fetching vendor profile:', error);
    return null;
  }

  return data ? normalizeVendor(data as Record<string, unknown>) : null;
}

/** Accès B2B : au moins une ligne place_members (RPC is_pro). */
export async function fetchIsPro(): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('is_pro');
  if (error) {
    console.error('fetchIsPro:', error);
    return false;
  }
  return Boolean(data);
}

function normalizeMemberRole(raw: unknown): PlaceMemberRole | null {
  if (raw === 'owner' || raw === 'manager' || raw === 'staff') return raw;
  return null;
}

const PLACES_MEMBER_SELECT =
  'id, name, image_url, lat, lng, latitude, longitude, category, description, address, city, has_plugs, has_vegan, laptop_policy, noise_level, wifi_speed, opening_hours, plugs_level, vendor_id, verification_status, created_at';

/** Cafés + rôle membre pour l'utilisateur connecté. */
export async function listProPlaceMemberships(): Promise<PlaceMembershipRow[]> {
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: members, error: memberError } = await supabase
    .from('place_members')
    .select('place_id, role')
    .eq('user_id', user.id)
    .in('role', ['owner', 'manager', 'staff']);

  if (memberError) {
    console.error('Error fetching place_members:', memberError);
    throw memberError;
  }

  const roleByPlace = new Map<string, PlaceMemberRole>();
  for (const row of members ?? []) {
    const role = normalizeMemberRole(row.role);
    if (typeof row.place_id === 'string' && role) {
      roleByPlace.set(row.place_id, role);
    }
  }

  const ids = [...roleByPlace.keys()];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('places')
    .select(PLACES_MEMBER_SELECT)
    .in('id', ids)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching membership places:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[])
    .map((row) => {
      const id = String(row.id);
      const role = roleByPlace.get(id);
      if (!role) return null;
      return { place: normalizePlace(row), role };
    })
    .filter((row): row is PlaceMembershipRow => row !== null);
}

const INVITATION_ERROR_FR: Record<string, string> = {
  not_authenticated: 'Connecte-toi pour accepter cette invitation.',
  invalid_token: 'Lien d’invitation invalide.',
  not_found: 'Invitation introuvable ou déjà utilisée.',
  already_accepted: 'Cette invitation a déjà été acceptée.',
  expired: 'Cette invitation a expiré. Demande-en une nouvelle au gérant.',
  email_mismatch:
    'Cette invitation est liée à une autre adresse email. Connecte-toi avec le compte invité.',
  no_email: 'Ton compte n’a pas d’email : impossible d’accepter cette invitation.',
};

export async function acceptPlaceInvitation(token: string): Promise<{
  ok: boolean;
  placeId?: string;
  error?: string;
}> {
  if (!supabase) return { ok: false, error: 'no_client' };
  const { data, error } = await supabase.rpc('accept_invitation', {
    p_token: token,
  });
  if (error) return { ok: false, error: error.message };
  const row = data as { ok?: boolean; error?: string; place_id?: string } | null;
  if (!row?.ok) {
    const code = row?.error ?? 'unknown';
    return {
      ok: false,
      error: INVITATION_ERROR_FR[code] ?? `Invitation refusée (${code}).`,
    };
  }
  return { ok: true, placeId: row.place_id };
}

export async function updateVendorProfile(
  patch: VendorProfilePatch
): Promise<VendorProfile> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select('id, full_name, avatar_url, role, updated_at')
    .single();

  if (error) {
    console.error('Error updating vendor profile:', error);
    throw error;
  }
  return normalizeVendor(data as Record<string, unknown>);
}

/**
 * Spots réellement gérés par le vendor (`places.vendor_id` = auth.uid()).
 * Pas de fallback sur tous les spots — compteur dashboard fidèle.
 */
export async function getVendorPlaces(vendorId?: string): Promise<Place[]> {
  if (!supabase) return [];

  let uid = vendorId;
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];
    uid = user.id;
  }

  const { data, error } = await supabase
    .from('places')
    .select(
      'id, name, image_url, lat, lng, latitude, longitude, category, description, address, city, has_plugs, has_vegan, laptop_policy, noise_level, wifi_speed, opening_hours, plugs_level, vendor_id, created_at'
    )
    .eq('vendor_id', uid)
    .order('name', { ascending: true });

  if (error) {
    // colonnes absentes → retry minimal
    if (error.code === '42703' || /opening_hours|plugs_level/.test(error.message ?? '')) {
      const fallback = await supabase
        .from('places')
        .select(
          'id, name, image_url, lat, lng, latitude, longitude, category, description, address, city, has_plugs, has_vegan, laptop_policy, noise_level, wifi_speed, vendor_id, created_at'
        )
        .eq('vendor_id', uid)
        .order('name', { ascending: true });
      if (fallback.error) {
        console.error('Error fetching vendor places:', fallback.error);
        throw fallback.error;
      }
      return ((fallback.data ?? []) as Record<string, unknown>[]).map(
        normalizePlace
      );
    }
    console.error('Error fetching vendor places:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizePlace);
}

/** Cafés où l'utilisateur est owner, manager ou staff (`place_members`). */
export async function getProAccessiblePlaces(): Promise<Place[]> {
  const rows = await listProPlaceMemberships();
  return rows.map((row) => row.place);
}

/** Nombre d'établissements accessibles via place_members. */
export async function countProPlaceMemberships(): Promise<number> {
  if (!supabase) return 0;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { count, error } = await supabase
    .from('place_members')
    .select('place_id', { count: 'exact', head: true })
    .eq('user_id', user.id);
  if (error) {
    console.error('countProPlaceMemberships:', error);
    return 0;
  }
  return count ?? 0;
}

export interface VendorPlacePatch {
  description?: string | null;
  image_url?: string | null;
  opening_hours?: string | null;
  wifi_speed?: string | null;
  noise_level?: string | null;
  laptop_policy?: string | null;
  has_plugs?: boolean;
  has_vegan?: boolean;
  plugs_level?: 'limited' | 'regular' | 'everywhere' | null;
}

/** Met à jour un spot appartenant au vendor connecté. */
export async function updateVendorPlace(
  placeId: string,
  patch: VendorPlacePatch
): Promise<Place> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const payload: Record<string, unknown> = { ...patch };
  if ('has_vegan' in patch) {
    payload.has_vegan = patch.has_vegan;
  }
  if ('wifi_speed' in patch) {
    payload.wifi_speed = normalizeWifiSpeed(patch.wifi_speed);
  }
  if ('noise_level' in patch) {
    payload.noise_level = normalizeNoiseLevel(patch.noise_level);
  }
  if ('plugs_level' in patch) {
    const plugs = normalizePlugsLevel(patch.plugs_level);
    payload.plugs_level = plugs;
    payload.has_plugs = plugs ? plugs !== 'limited' : false;
  }

  const { data, error } = await supabase
    .from('places')
    .update(payload)
    .eq('id', placeId)
    .eq('vendor_id', user.id)
    .select(
      'id, name, image_url, lat, lng, latitude, longitude, category, description, address, city, has_plugs, has_vegan, laptop_policy, noise_level, wifi_speed, opening_hours, plugs_level, vendor_id, created_at'
    )
    .single();

  if (error) {
    console.error('Error updating vendor place:', error);
    throw error;
  }

  invalidatePlacesCache();
  return normalizePlace(data as Record<string, unknown>);
}

function invalidatePlacesCache() {
  // Lazy import pour éviter cycles
  void import('@/lib/cache/clientCache').then(({ invalidateCache }) => {
    invalidateCache('places:');
  });
}

/** Nombre de spots gérés (requête count légère). */
export async function countVendorPlaces(vendorId: string): Promise<number> {
  if (!supabase || !vendorId) return 0;

  const { count, error } = await supabase
    .from('places')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', vendorId);

  if (error) {
    console.error('Error counting vendor places:', error);
    return 0;
  }
  return count ?? 0;
}

const PLACE_SELECT =
  'id, name, image_url, lat, lng, latitude, longitude, category, description, address, city, has_plugs, has_vegan, laptop_policy, noise_level, wifi_speed, opening_hours, plugs_level, vendor_id, created_at';

/** Cafés sans propriétaire — candidats à la revendication. */
export async function listUnclaimedPlaces(): Promise<Place[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('places')
    .select(PLACE_SELECT)
    .is('vendor_id', null)
    .order('name', { ascending: true })
    .limit(300);

  if (error) {
    console.error('Error listing unclaimed places:', error);
    throw error;
  }

  return ((data ?? []) as Record<string, unknown>[]).map(normalizePlace);
}

export interface CreateVendorPlaceInput {
  name: string;
  address?: string | null;
  city?: string | null;
  description?: string | null;
  wifi_speed?: string | null;
  noise_level?: string | null;
  plugs_level?: 'limited' | 'regular' | 'everywhere' | null;
  image_url?: string | null;
  opening_hours?: string | null;
  has_vegan?: boolean;
  lat?: number;
  lng?: number;
  category?: string | null;
}

/** Crée un nouveau spot lié au vendor connecté. */
export async function createVendorPlace(
  input: CreateVendorPlaceInput
): Promise<Place> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const name = input.name.trim();
  if (!name) throw new Error('Le nom de l’établissement est requis.');

  // Canonicaliser les enums FR → EN (CHECK constraints Supabase)
  const plugs = normalizePlugsLevel(input.plugs_level);
  const wifi = normalizeWifiSpeed(input.wifi_speed);
  const noise = normalizeNoiseLevel(input.noise_level);

  // Coords fournies, sinon géocodage adresse → fallback centre Nice
  let coords =
    Number.isFinite(input.lat) && Number.isFinite(input.lng)
      ? { lat: input.lat as number, lng: input.lng as number }
      : await geocodeAddress(input.address ?? '', input.city);

  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    coords = { ...NICE_CENTER };
  }

  const baseRow = {
    name,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    description: input.description?.trim() || null,
    wifi_speed: wifi,
    noise_level: noise,
    plugs_level: plugs,
    has_plugs: plugs ? plugs !== 'limited' : false,
    // Aligné sur les lignes seed (`always`) — évite un CHECK sans NULL
    laptop_policy: 'always',
    has_vegan: Boolean(input.has_vegan),
    image_url: input.image_url || null,
    opening_hours: input.opening_hours || null,
    category: input.category || 'Specialty',
    vendor_id: user.id,
  };

  // Essai 1 : GeoJSON location + lat/lng + latitude/longitude
  let { data, error } = await supabase
    .from('places')
    .insert({ ...baseRow, ...placeLocationPayload(coords) })
    .select(PLACE_SELECT)
    .single();

  // Essai 2 : location en WKT (certains schémas PostGIS)
  if (error && (error.code === '22P02' || /location|geo/i.test(error.message ?? ''))) {
    const retry = await supabase
      .from('places')
      .insert({
        ...baseRow,
        lat: coords.lat,
        lng: coords.lng,
        latitude: coords.lat,
        longitude: coords.lng,
        location: placeLocationWkt(coords),
      })
      .select(PLACE_SELECT)
      .single();
    data = retry.data;
    error = retry.error;
  }

  // Essai 3 : colonnes absentes → garder uniquement location (NOT NULL) + lat/lng
  if (
    error &&
    (error.code === '42703' ||
      /column .* does not exist/i.test(error.message ?? ''))
  ) {
    const retry = await supabase
      .from('places')
      .insert({
        ...baseRow,
        location: placeLocationWkt(coords),
        lat: coords.lat,
        lng: coords.lng,
      })
      .select(PLACE_SELECT)
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error('Error creating vendor place:', error);
    if (error.code === '23514') {
      throw new Error(
        `Contrainte base refusée sur places (${error.message}). Les équipements doivent être des enums DB (ex. ambient / average / everywhere), pas les libellés FR.`
      );
    }
    throw error;
  }

  invalidatePlacesCache();
  return normalizePlace(data as Record<string, unknown>);
}

export interface ClaimVendorPlaceInput extends CreateVendorPlaceInput {
  placeId: string;
}

/** Revendique un spot libre (vendor_id IS NULL) et met à jour la fiche. */
/** Demande de revendication (approve_claim côté admin → place_members). */
export async function requestPlaceClaim(placeId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const { data, error } = await supabase.rpc('request_claim', {
    p_place_id: placeId,
    p_declared_role: 'owner',
    p_proof_method: 'phone',
    p_proof_path: null,
  });
  if (error) throw error;
  const row = data as { ok?: boolean; error?: string } | null;
  if (!row?.ok) {
    throw new Error(row?.error ?? 'Revendication refusée');
  }
}

export async function claimVendorPlace(
  input: ClaimVendorPlaceInput
): Promise<Place> {
  if (!supabase) throw new Error('Supabase client not initialized');
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const plugs = normalizePlugsLevel(input.plugs_level);
  const payload: Record<string, unknown> = {
    vendor_id: user.id,
    name: input.name.trim() || undefined,
    address: input.address?.trim() || null,
    city: input.city?.trim() || null,
    description: input.description?.trim() || null,
    wifi_speed: normalizeWifiSpeed(input.wifi_speed),
    noise_level: normalizeNoiseLevel(input.noise_level),
    plugs_level: plugs,
    has_plugs: plugs ? plugs !== 'limited' : false,
    has_vegan: Boolean(input.has_vegan),
    opening_hours: input.opening_hours || null,
  };
  if (input.image_url) payload.image_url = input.image_url;
  if (Number.isFinite(input.lat)) payload.lat = input.lat;
  if (Number.isFinite(input.lng)) payload.lng = input.lng;

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k];
  });

  const { data, error } = await supabase
    .from('places')
    .update(payload)
    .eq('id', input.placeId)
    .is('vendor_id', null)
    .select(PLACE_SELECT)
    .maybeSingle();

  if (error) {
    console.error('Error claiming vendor place:', error);
    throw error;
  }
  if (!data) {
    throw new Error(
      'Ce café n’est plus disponible (déjà revendiqué ou introuvable).'
    );
  }

  invalidatePlacesCache();
  return normalizePlace(data as Record<string, unknown>);
}

// Ré-exports pour le dashboard (API flash drops)
export {
  insertFlashDrop,
  updateFlashDrop,
  getVendorFlashDrops,
  countActiveVendorFlashDrops,
  type FlashDrop,
} from '@/app/(pro)/dashboard-pro/lib/api/flashDrops';
