import Link from "next/link";
import AdminPageHeader from "@/app/admin/(console)/components/AdminPageHeader";
import PlanControl from "@/app/admin/(console)/abonnements/PlanControl";
import { requireAdmin } from "@/lib/admin/requireAdmin";

export const metadata = {
  title: "Abonnements Pro · Admin DropSpot",
};

type VendorRow = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  places: string | null;
  plan: string;
  pro_until: string | null;
  has_pro: boolean;
};

/** Pilot: Pro is paid by e-mail and switched on here by hand. */
export default async function AdminPlansPage() {
  const { supabase } = await requireAdmin("/admin/abonnements");
  const { data, error } = await supabase.rpc("admin_list_vendors");
  const vendors = (data ?? []) as VendorRow[];
  const proCount = vendors.filter((v) => v.has_pro).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader
        title="Abonnements Pro"
        subtitle={`Pendant le pilote, le Pro s'active ici à la main. ${proCount} compte(s) Pro actif(s).`}
      />
      {error ? (
        <p className="text-sm text-ds-danger">Impossible de charger les comptes café : {error.message}</p>
      ) : vendors.length === 0 ? (
        <p className="rounded-2xl border border-ds-line bg-ds-surface px-4 py-6 text-sm text-ds-text2">
          Aucun compte café pour l&apos;instant. Ils apparaissent ici dès qu&apos;une revendication est approuvée.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
          {vendors.map((v) => (
            <li key={v.user_id} className="flex flex-col gap-3 border-b border-ds-line px-4 py-4 last:border-b-0 md:flex-row md:items-start md:gap-6">
              <div className="min-w-0 md:w-[38%]">
                <Link
                  href={`/admin/utilisateurs/${v.user_id}`}
                  className="font-semibold text-ds-text no-underline hover:underline"
                >
                  {v.places || "Aucun café"}
                </Link>
                <p className="truncate text-[13px] text-ds-text2">
                  {v.full_name ? `${v.full_name} · ` : ""}
                  {v.email}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <PlanControl
                  userId={v.user_id}
                  plan={v.plan === "pro" ? "pro" : "free"}
                  proUntil={v.pro_until}
                  hasPro={v.has_pro}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
