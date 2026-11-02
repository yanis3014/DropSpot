import AdminPageHeader from "@/app/admin/(console)/components/AdminPageHeader";
import FeatureGrid from "@/app/admin/(console)/offres/FeatureGrid";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { gridFromRows, PLAN_IDS, type PlanId } from "@/lib/pro/planFeatures";

export const metadata = {
  title: "Offres et fonctions · Admin DropSpot",
};

type GridPayload = {
  features?: { feature: string; plans: unknown; updated_at: string }[];
  accounts?: Partial<Record<PlanId, number>>;
} | null;

/**
 * Which offer unlocks which pro feature. The grid lives in plan_features and
 * every server-side gate reads it, so a change applies at once.
 */
export default async function AdminOffersPage() {
  const { supabase } = await requireAdmin("/admin/offres");
  const { data, error } = await supabase.rpc("admin_plan_features");
  const payload = data as GridPayload;
  const grid = gridFromRows(payload?.features);
  const accounts = Object.fromEntries(
    PLAN_IDS.map((p) => [p, Number(payload?.accounts?.[p] ?? 0)])
  ) as Record<PlanId, number>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Offres et fonctions"
        subtitle="Coche les offres qui donnent accès à chaque fonction de l'espace pro. Le changement s'applique tout de suite à tous les cafés, côté serveur."
      />
      {error ? (
        <p className="text-sm text-ds-danger">
          Impossible de charger la grille : {error.message}
        </p>
      ) : (
        <FeatureGrid initialGrid={grid} accounts={accounts} />
      )}
    </div>
  );
}
