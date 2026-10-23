/** Dates of the admin console, in Paris time. */
export function formatAdminDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatAdminDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", {
    timeZone: "Europe/Paris",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Supabase Auth keeps a ban as a future `banned_until`. */
export function isSuspended(bannedUntil: string | null | undefined): boolean {
  if (!bannedUntil) return false;
  return new Date(bannedUntil).getTime() > Date.now();
}

export const ACTION_LABEL: Record<string, string> = {
  approve_claim: "a approuvé la revendication de",
  reject_claim: "a refusé la revendication de",
  set_plan: "a changé l'offre de",
  update_place: "a corrigé la fiche de",
  review_place: "a validé le café suggéré",
  suspend_user: "a suspendu",
  unsuspend_user: "a réactivé",
};

export const VERIFICATION_LABEL: Record<string, string> = {
  verified: "Vérifié",
  unclaimed: "Libre",
  pending: "En attente",
};
