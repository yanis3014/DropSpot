import { supabase } from '@/lib/supabase/client';

export type VitrinePlaceHit = {
  id: string;
  name: string;
  area: string | null;
  free: boolean;
};

/**
 * Recherche publique de cafés pour la landing « Pour les cafés ».
 * La table `places` est lisible publiquement (politique « Anyone can read
 * places ») : lecture seule, jamais d'écriture, et aucune colonne sensible
 * (pas de vendor_id ni d'information sur le gérant). La page ne doit jamais
 * casser : toute erreur renvoie une liste vide.
 */
export async function searchPlacesPublic(
  query: string
): Promise<VitrinePlaceHit[]> {
  const q = query.trim();
  if (q.length < 2 || !supabase) return [];

  // Échappe les jokers ilike (% et _) et le caractère d'échappement lui-même.
  const pattern = `%${q.replace(/[%_\\]/g, (c) => '\\' + c)}%`;

  try {
    const { data, error } = await supabase
      .from('places')
      .select('id, name, address, city, verification_status')
      .ilike('name', pattern)
      .order('name')
      .limit(5);

    if (error) {
      console.error(error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      name: row.name as string,
      area:
        (row.address as string | null) ||
        (row.city as string | null) ||
        null,
      free: row.verification_status === 'unclaimed',
    }));
  } catch (err) {
    console.error(err);
    return [];
  }
}
