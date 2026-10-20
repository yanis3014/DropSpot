import { supabase } from '@/lib/supabase/client';

export interface ValidateFlashDropResult {
  ok: boolean;
  error?: string;
  redemption_id?: string;
  flash_drop_id?: string;
  title?: string;
  grains_awarded?: number;
  current_uses?: number;
  user_credited?: boolean;
}

export interface VendorTodayStats {
  validations_today: number;
  grains_awarded_today: number;
}

/** Normalise un scan QR / saisie libre vers un code PIN. */
export function extractValidationCode(raw: string): string {
  let code = raw.trim();
  if (/dropspot[:/-]/i.test(code)) {
    code = code.replace(/.*dropspot[:/-]/i, '');
  }
  if (code.startsWith('{')) {
    try {
      const parsed = JSON.parse(code) as { code?: string };
      if (parsed.code) code = parsed.code;
    } catch {
      // ignore
    }
  }
  return code.replace(/[^0-9A-Za-z]/g, '').slice(0, 8);
}

/** Appelle la RPC Supabase de validation en caisse. */
export async function validateFlashDropCode(
  rawCode: string,
  userId?: string | null
): Promise<ValidateFlashDropResult> {
  if (!supabase) throw new Error('Supabase client not initialized');

  const code = extractValidationCode(rawCode);
  if (code.length < 4) {
    return { ok: false, error: 'invalid_code' };
  }

  const { data, error } = await supabase.rpc('validate_flash_drop_code', {
    p_code: code,
    p_user_id: userId ?? null,
  });

  if (error) {
    console.error('validate_flash_drop_code error:', error);
    return { ok: false, error: error.message };
  }

  return (data ?? { ok: false, error: 'unknown' }) as ValidateFlashDropResult;
}

export function validateErrorMessage(error?: string): string {
  switch (error) {
    case 'invalid_code':
      return 'Code invalide — saisis 4 chiffres.';
    case 'code_not_found':
      return 'Aucun Flash Drop actif avec ce code.';
    case 'sold_out':
      return 'Quota atteint pour cette offre.';
    case 'not_authenticated':
      return 'Session expirée — reconnecte-toi.';
    default:
      return error || 'Validation impossible.';
  }
}

export async function getVendorTodayStats(): Promise<VendorTodayStats> {
  if (!supabase) return { validations_today: 0, grains_awarded_today: 0 };

  const { data, error } = await supabase.rpc('vendor_today_stats');
  if (error) {
    console.error('vendor_today_stats error:', error);
    return { validations_today: 0, grains_awarded_today: 0 };
  }

  const row = data as {
    ok?: boolean;
    validations_today?: number;
    grains_awarded_today?: number;
  } | null;

  return {
    validations_today: row?.validations_today ?? 0,
    grains_awarded_today: row?.grains_awarded_today ?? 0,
  };
}
