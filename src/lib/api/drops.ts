import { supabase } from '@/lib/supabase/client';

export interface Drop {
  id: string;
  title: string;
  description?: string;
  drop_type: 'event' | 'sport' | 'promo';
  start_time: string;
  end_time: string;
  place_id: string;
  places?: {
    name: string;
    image_url?: string;
  };
  capacity?: number;
  current_participants?: number;
  created_at?: string;
  updated_at?: string;
}

export async function getActiveDrops(): Promise<Drop[]> {
  try {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return [];
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('drops')
      .select('*, places(name, image_url)')
      .gte('end_time', now)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching drops:', error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error('Error in getActiveDrops:', error);
    throw error;
  }
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isDropLive(drop: Drop): boolean {
  const now = Date.now();
  return (
    new Date(drop.start_time).getTime() <= now &&
    now <= new Date(drop.end_time).getTime()
  );
}

export function formatCountdown(endTime: string, now: number = Date.now()): string {
  const end = new Date(endTime).getTime();
  const diff = end - now;

  if (diff <= 0) return '00:00:00';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
