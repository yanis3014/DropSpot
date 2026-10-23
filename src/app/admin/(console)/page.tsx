import Link from "next/link";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { fetchAdminOverview } from "@/lib/admin/overview";

export const metadata = {
  title: "À traiter · Admin DropSpot",
};

type PendingClaim = {
  id: string;
  declared_role: string;
  proof_method: string;
  created_at: string;
  places: { name: string } | { name: string }[] | null;
};

const ROLE_LABEL: Record<string, string> = {
  owner: "gérant",
  manager: "responsable",
};

const PROOF_LABEL: Record<string, string> = {
  document: "justificatif envoyé",
  phone: "appel au café",
};

function waitingSince(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "depuis hier";
  return `depuis ${days} jours`;
}

function placeName(places: PendingClaim["places"]): string {
  const row = Array.isArray(places) ? places[0] : places;
  return row?.name ?? "Café inconnu";
}

/** Admin home: what waits for a decision, oldest first, plus four counters. */
export default async function AdminTodoPage() {
  const { supabase } = await requireAdmin("/admin");

  const [overview, { data: claims, error }] = await Promise.all([
    fetchAdminOverview(supabase),
    supabase
      .from("place_claims")
      .select("id, declared_role, proof_method, created_at, places ( name )")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(20),
  ]);

  const pending = (claims ?? []) as PendingClaim[];
  const tiles = [
    { value: overview.pending_claims, label: "en attente", alert: overview.pending_claims > 0 },
    { value: overview.places_total, label: "cafés en base" },
    { value: overview.places_verified, label: "cafés vérifiés" },
    { value: overview.pros_active, label: "comptes Pro actifs" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-extrabold text-ds-text">À traiter</h1>
        <p className="text-sm text-ds-text2">Plus ancien d&apos;abord.</p>
      </header>

      <section aria-label="Chiffres du jour" className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map(({ value, label, alert }) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 rounded-2xl border border-ds-line bg-ds-surface p-3.5"
          >
            <span
              className={`font-display text-[26px] font-extrabold tabular-nums ${alert ? "text-ds-accent" : "text-ds-text"}`}
            >
              {value}
            </span>
            <span className="text-[13px] text-ds-text2">{label}</span>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
        <h2 className="border-b border-ds-line px-4 py-3 text-[13px] font-bold text-ds-text">
          Revendications
        </h2>
        {error ? (
          <p className="px-4 py-4 text-sm text-ds-danger">
            Impossible de charger les demandes : {error.message}
          </p>
        ) : pending.length === 0 ? (
          <p className="px-4 py-6 text-sm text-ds-text2">
            Rien à traiter. Les nouvelles revendications apparaîtront ici.
          </p>
        ) : (
          <ul>
            {pending.map((claim) => (
              <li
                key={claim.id}
                className="flex flex-col gap-2 border-b border-ds-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="w-fit rounded-md bg-ds-accentsoft px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ds-accenttext">
                  Revendication
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ds-text">
                    {placeName(claim.places)}
                  </span>
                  <span className="block text-[12.5px] text-ds-text2">
                    {ROLE_LABEL[claim.declared_role] ?? claim.declared_role} ·{" "}
                    {PROOF_LABEL[claim.proof_method] ?? claim.proof_method} ·{" "}
                    {waitingSince(claim.created_at)}
                  </span>
                </span>
                <Link
                  href={`/admin/revendications#claim-${claim.id}`}
                  className="w-fit rounded-[10px] bg-ds-admin px-3.5 py-2 text-[13px] font-bold text-ds-onadmin no-underline"
                >
                  Examiner
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[13px] text-ds-text2">
        Bientôt dans cette liste : cafés suggérés par les clients, passages Pro et signalements.
      </p>
    </div>
  );
}
