import { supabase } from '@/lib/supabase/client';

/** Free plan may only request this many days of place summary (SQL: FREE_STATS_MAX_DAYS). */
export const FREE_STATS_MAX_DAYS = 7;

/** Allowed `p_days` values for `pro_place_summary` / `pro_place_insights`. */
export const PLACE_SUMMARY_PERIODS = [7, 30, 90] as const;
export type PlaceSummaryDays = (typeof PLACE_SUMMARY_PERIODS)[number];

export type PlaceSummary = {
  from: string;
  until: string;
  days: number;
  views: number;
  directions: number;
  check_ins: number;
  unique_visitors: number;
  saves: number;
  codes_redeemed: number;
};

export type PlaceInsightsDrop = {
  id: string;
  title: string;
  kind: string;
  starts_at: string;
  ends_at: string;
  codes_issued: number;
  codes_redeemed: number;
  participants: number;
  present: number;
};

export type PlaceInsightsTeamMember = {
  first_name: string;
  codes_redeemed: number;
};

export type PlaceInsights = {
  current: PlaceSummary;
  previous: PlaceSummary;
  by_hour: number[];
  by_weekday: number[];
  returning_share: number | null;
  crowd: Record<string, number>;
  wifi: Record<string, number>;
  drops: PlaceInsightsDrop[];
  audience: Record<string, number> | null;
  team: PlaceInsightsTeamMember[] | null;
};

export type PlaceSummaryErrorCode =
  | 'forbidden'
  | 'pro_required'
  | 'invalid_period'
  | 'unknown';

export class PlaceSummaryError extends Error {
  readonly code: PlaceSummaryErrorCode;

  constructor(code: PlaceSummaryErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PlaceSummaryError';
    this.code = code;
  }
}

function translateSummaryError(message: string | undefined): PlaceSummaryErrorCode {
  const m = (message ?? '').toLowerCase();
  if (m.includes('forbidden')) return 'forbidden';
  if (m.includes('pro_required')) return 'pro_required';
  if (m.includes('invalid_period')) return 'invalid_period';
  return 'unknown';
}

function asNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asSummary(row: Record<string, unknown>, fallbackDays: number): PlaceSummary {
  return {
    from: String(row.from ?? ''),
    until: String(row.until ?? ''),
    days: asNumber(row.days) || fallbackDays,
    views: asNumber(row.views),
    directions: asNumber(row.directions),
    check_ins: asNumber(row.check_ins),
    unique_visitors: asNumber(row.unique_visitors),
    saves: asNumber(row.saves),
    codes_redeemed: asNumber(row.codes_redeemed),
  };
}

function asCountMap(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = asNumber(v);
  }
  return out;
}

function asIntArray(value: unknown, length: number): number[] {
  if (!Array.isArray(value)) return Array.from({ length }, () => 0);
  const arr = value.map((v) => asNumber(v));
  while (arr.length < length) arr.push(0);
  return arr.slice(0, length);
}

/** Calls `pro_place_summary` and maps Postgres errors to PlaceSummaryError. */
export async function getPlaceSummary(
  placeId: string,
  days: PlaceSummaryDays
): Promise<PlaceSummary> {
  if (!supabase) {
    throw new PlaceSummaryError('unknown', 'Supabase client not initialized');
  }
  if (!PLACE_SUMMARY_PERIODS.includes(days)) {
    throw new PlaceSummaryError('invalid_period');
  }

  const { data, error } = await supabase.rpc('pro_place_summary', {
    p_place: placeId,
    p_days: days,
  });

  if (error) {
    throw new PlaceSummaryError(
      translateSummaryError(error.message),
      error.message
    );
  }

  return asSummary((data ?? {}) as Record<string, unknown>, days);
}

/** Calls `pro_place_insights` (Pro only). No person ids in the payload. */
export async function getPlaceInsights(
  placeId: string,
  days: PlaceSummaryDays
): Promise<PlaceInsights> {
  if (!supabase) {
    throw new PlaceSummaryError('unknown', 'Supabase client not initialized');
  }
  if (!PLACE_SUMMARY_PERIODS.includes(days)) {
    throw new PlaceSummaryError('invalid_period');
  }

  const { data, error } = await supabase.rpc('pro_place_insights', {
    p_place: placeId,
    p_days: days,
  });

  if (error) {
    throw new PlaceSummaryError(
      translateSummaryError(error.message),
      error.message
    );
  }

  const row = (data ?? {}) as Record<string, unknown>;
  const current = asSummary(
    (row.current ?? {}) as Record<string, unknown>,
    days
  );
  const previous = asSummary(
    (row.previous ?? {}) as Record<string, unknown>,
    days
  );

  const audienceRaw = row.audience;
  let audience: Record<string, number> | null = null;
  if (audienceRaw != null && typeof audienceRaw === 'object') {
    audience = asCountMap(audienceRaw);
  }

  const teamRaw = row.team;
  let team: PlaceInsightsTeamMember[] | null = null;
  if (Array.isArray(teamRaw)) {
    team = teamRaw.map((item) => {
      const t = (item ?? {}) as Record<string, unknown>;
      return {
        first_name: String(t.first_name ?? 'Équipier'),
        codes_redeemed: asNumber(t.codes_redeemed),
      };
    });
  }

  const dropsRaw = Array.isArray(row.drops) ? row.drops : [];
  const drops: PlaceInsightsDrop[] = dropsRaw.map((item) => {
    const d = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(d.id ?? ''),
      title: String(d.title ?? ''),
      kind: String(d.kind ?? ''),
      starts_at: String(d.starts_at ?? ''),
      ends_at: String(d.ends_at ?? ''),
      codes_issued: asNumber(d.codes_issued),
      codes_redeemed: asNumber(d.codes_redeemed),
      participants: asNumber(d.participants),
      present: asNumber(d.present),
    };
  });

  const returning =
    row.returning_share == null || row.returning_share === ''
      ? null
      : asNumber(row.returning_share);

  return {
    current,
    previous,
    by_hour: asIntArray(row.by_hour, 24),
    by_weekday: asIntArray(row.by_weekday, 7),
    returning_share: returning,
    crowd: asCountMap(row.crowd),
    wifi: asCountMap(row.wifi),
    drops,
    audience,
    team,
  };
}
