import AdminPageHeader from "@/app/admin/(console)/components/AdminPageHeader";
import AdminSearch from "@/app/admin/(console)/components/AdminSearch";
import PlaceRow, { type AdminPlaceRow } from "@/app/admin/(console)/cafes/PlaceRow";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { fetchAdminOverview } from "@/lib/admin/overview";

export const metadata = {
  title: "Cafés · Admin DropSpot",
};

const FILTERS = ["all", "to_review", "unclaimed", "verified"] as const;
type Filter = (typeof FILTERS)[number];

export default async function AdminPlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filtre?: string }>;
}) {
  const { q = "", filtre } = await searchParams;
  const filter: Filter = FILTERS.includes(filtre as Filter) ? (filtre as Filter) : "all";
  const { supabase } = await requireAdmin("/admin/cafes");

  const [overview, { data, error }] = await Promise.all([
    fetchAdminOverview(supabase),
    supabase.rpc("admin_list_places", {
      p_query: q.trim() || null,
      p_filter: filter,
      p_limit: 100,
    }),
  ]);
  const places = (data ?? []) as AdminPlaceRow[];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Cafés"
        subtitle="Corriger une fiche, valider les cafés suggérés par les clients."
      >
        <AdminSearch
          action="/admin/cafes"
          query={q}
          placeholder="Nom, adresse ou ville"
          activeFilter={filter}
          filters={[
            { value: "all", label: "Tous" },
            { value: "to_review", label: "Suggérés à valider", count: overview.places_to_review },
            { value: "unclaimed", label: "Libres" },
            { value: "verified", label: "Vérifiés" },
          ]}
        />
      </AdminPageHeader>

      {error ? (
        <p className="text-sm text-ds-danger">Impossible de charger les cafés : {error.message}</p>
      ) : places.length === 0 ? (
        <p className="rounded-2xl border border-ds-line bg-ds-surface px-4 py-6 text-sm text-ds-text2">
          {filter === "to_review"
            ? "Aucun café suggéré à valider."
            : "Aucun café ne correspond à cette recherche."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
          {places.map((place) => (
            <PlaceRow key={place.id} place={place} />
          ))}
        </ul>
      )}
      {places.length === 100 ? (
        <p className="text-[13px] text-ds-text2">100 premiers résultats : affine la recherche.</p>
      ) : null}
    </div>
  );
}
