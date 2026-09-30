import { supabase } from '@/lib/supabase/client';

export interface Place {
  id: string;
  name: string;
  image_url?: string;
  lat: number;
  lng: number;
  has_plugs?: boolean;
  wifi_speed?: string;
  noise_level?: string;
  laptop_policy?: string;
  has_terrace?: boolean;
  is_vegan?: boolean;
  description?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  created_at?: string;
  updated_at?: string;
}

export async function getPlaces(): Promise<Place[]> {
  try {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return [];
    }

    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching places:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getPlaces:', error);
    throw error;
  }
}

export async function getPlaceById(id: string): Promise<Place | null> {
  try {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return null;
    }

    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching place:', error);
      throw error;
    }

    return data;
  } catch (error) {
    console.error('Error in getPlaceById:', error);
    throw error;
  }
}
