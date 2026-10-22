import { supabase } from "@/lib/supabase/client";
import { formatDropCodeDisplay } from "@/lib/dropCodes/format";
import type { DropCodeStatus } from "@/lib/dropCodes/screen";

export type ClaimDropSuccess = {
  ok: true;
  dropCodeId: string;
  code: string;
  codeDisplay: string;
  status: DropCodeStatus;
  flashDropId: string;
};

export type ClaimDropFailure = {
  ok: false;
  error: string;
};

export type ClaimDropResult = ClaimDropSuccess | ClaimDropFailure;

export type MyDropCode = {
  id: string;
  code: string;
  codeDisplay: string;
  status: DropCodeStatus;
  flashDropId: string;
  issuedAt: string;
  title: string;
  cafeName: string;
  endsAt: string;
};

type ClaimRpcRow = {
  ok?: boolean;
  error?: string;
  drop_code_id?: string;
  code?: string;
  code_display?: string;
  status?: string;
  flash_drop_id?: string;
};

function asStatus(raw: unknown): DropCodeStatus {
  if (raw === "redeemed" || raw === "cancelled" || raw === "issued") return raw;
  return "issued";
}

/** RPC claim_drop — returns existing code or creates one. */
export async function claimDrop(flashDropId: string): Promise<ClaimDropResult> {
  if (!supabase) throw new Error("Supabase client not initialized");

  const { data, error } = await supabase.rpc("claim_drop", {
    p_drop: flashDropId,
  });

  if (error) throw error;

  const row = data as ClaimRpcRow | null;
  if (!row?.ok) {
    return { ok: false, error: row?.error ?? "drop_not_found" };
  }

  const code = String(row.code ?? "").trim();
  return {
    ok: true,
    dropCodeId: String(row.drop_code_id),
    code,
    codeDisplay:
      typeof row.code_display === "string" && row.code_display
        ? row.code_display
        : formatDropCodeDisplay(code),
    status: asStatus(row.status),
    flashDropId: String(row.flash_drop_id ?? flashDropId),
  };
}

/** Active (issued) codes for the signed-in user — RLS own rows. */
export async function listMyActiveDropCodes(): Promise<MyDropCode[]> {
  if (!supabase) return [];

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Filter on user_id: a café member can also read the codes of their
  // café's clients (RLS "Place members read drop codes").
  const { data, error } = await supabase
    .from("drop_codes")
    .select(
      "id, code, status, flash_drop_id, issued_at, flash_drops(title, ends_at, places(name))",
    )
    .eq("user_id", user.id)
    .eq("status", "issued")
    .order("issued_at", { ascending: false });

  if (error) {
    console.error("listMyActiveDropCodes error:", error);
    return [];
  }

  const now = Date.now();
  return ((data ?? []) as Record<string, unknown>[])
    .filter((row) => {
      const fd = row.flash_drops as Record<string, unknown> | null;
      const endsAt = Date.parse(String(fd?.ends_at ?? ""));
      // Hide codes of drops that are already over.
      return !Number.isFinite(endsAt) || endsAt > now;
    })
    .map((row) => {
      const code = String(row.code ?? "");
      const fd = row.flash_drops as Record<string, unknown> | null;
      const places = fd?.places as Record<string, unknown> | null | undefined;
      return {
        id: String(row.id),
        code,
        codeDisplay: formatDropCodeDisplay(code),
        status: asStatus(row.status),
        flashDropId: String(row.flash_drop_id),
        issuedAt: String(row.issued_at ?? ""),
        title: String(fd?.title ?? "Drop"),
        cafeName: String(places?.name ?? "Café"),
        endsAt: String(fd?.ends_at ?? ""),
      };
    });
}

/**
 * Grains credited for a redeemed drop_code (reason flash_drop, ref_id = code id).
 * Returns null when the row is missing or unreadable — never invent an amount.
 */
export async function fetchFlashDropGrainsAmount(
  dropCodeId: string,
): Promise<number | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("grains_transactions")
    .select("amount")
    .eq("reason", "flash_drop")
    .eq("ref_id", dropCodeId)
    // cancel_redemption adds a negative row with the same ref_id.
    .gt("amount", 0)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("fetchFlashDropGrainsAmount error:", error);
    return null;
  }

  const amount = (data as { amount?: unknown } | null)?.amount;
  return typeof amount === "number" && Number.isFinite(amount) ? amount : null;
}

export type LastShownDropCode = {
  id: string;
  code: string;
  title: string;
  cafeName: string;
  endsAt: string;
  status: DropCodeStatus;
};

const LAST_CODE_KEY = "dropspot_last_drop_code";

export function readLastShownDropCode(): LastShownDropCode | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LAST_CODE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LastShownDropCode;
    if (!parsed?.id || !parsed?.code) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeLastShownDropCode(row: LastShownDropCode): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAST_CODE_KEY, JSON.stringify(row));
  } catch {
    // ignore quota / private mode
  }
}
