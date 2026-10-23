import ClaimReviewPanel, {
  type PendingClaimRow,
} from "@/app/admin/(console)/revendications/ClaimReviewPanel";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export const metadata = {
  title: "Revendications · Admin DropSpot",
};

type ClaimQueryRow = {
  id: string;
  place_id: string;
  user_id: string;
  declared_role: string;
  proof_method: string;
  proof_path: string | null;
  created_at: string;
  places: { name: string } | { name: string }[] | null;
};

export default async function AdminRevendicationsPage() {
  const { supabase } = await requireAdmin("/admin/revendications");

  const { data: rows, error } = await supabase
    .from("place_claims")
    .select(
      `
      id,
      place_id,
      user_id,
      declared_role,
      proof_method,
      proof_path,
      created_at,
      places ( name )
    `
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-2xl font-extrabold text-ds-text">
          Revendications
        </h1>
        <p className="mt-4 text-ds-danger text-sm">
          Impossible de charger les demandes : {error.message}
        </p>
      </main>
    );
  }

  const claims: PendingClaimRow[] = ((rows ?? []) as ClaimQueryRow[]).map(
    (row) => {
      const placesRaw = row.places;
      const placeName = Array.isArray(placesRaw)
        ? placesRaw[0]?.name
        : placesRaw?.name;

      return {
        id: row.id,
        place_id: row.place_id,
        user_id: row.user_id,
        declared_role: row.declared_role,
        proof_method: row.proof_method,
        proof_path: row.proof_path,
        created_at: row.created_at,
        place_name: placeName ?? null,
        claimant_email: null,
      };
    }
  );

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 pb-16">
      <header className="mb-8">
        <p className="text-xs font-bold uppercase tracking-wider text-ds-text2">
          Administration
        </p>
        <h1 className="font-display text-[28px] font-extrabold text-ds-text mt-1">
          Revendications en attente
        </h1>
        <p className="text-sm text-ds-text2 mt-2">
          Approuver crée le propriétaire et vérifie l&apos;établissement.
        </p>
      </header>
      <ClaimReviewPanel claims={claims} />
    </main>
  );
}
