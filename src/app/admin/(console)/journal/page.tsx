import Link from "next/link";
import AdminPageHeader from "@/app/admin/(console)/components/AdminPageHeader";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { ACTION_LABEL, formatAdminDate, formatAdminDay } from "@/lib/admin/format";

export const metadata = {
  title: "Journal · Admin DropSpot",
};

type ActionRow = {
  id: string;
  admin_name: string;
  action: string;
  target_type: string;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  note: string | null;
  created_at: string;
};

function targetHref(row: ActionRow): string | null {
  if (!row.target_id) return null;
  if (row.target_type === "user" || row.target_type === "plan") {
    return `/admin/utilisateurs/${row.target_id}`;
  }
  if (row.target_type === "place") return `/place/${row.target_id}`;
  const placeId = row.details?.place_id;
  return typeof placeId === "string" ? `/place/${placeId}` : null;
}

function planDetail(row: ActionRow): string | null {
  if (row.action !== "set_plan") return null;
  const plan = row.details?.plan === "pro" ? "Pro" : "Gratuit";
  const until = row.details?.pro_until;
  return typeof until === "string" ? `${plan} jusqu'au ${formatAdminDay(until)}` : plan;
}

/** Every admin decision, newest first. */
export default async function AdminLogPage({
  searchParams,
}: {
  searchParams: Promise<{ avant?: string }>;
}) {
  const { avant } = await searchParams;
  const { supabase } = await requireAdmin("/admin/journal");
  const before = avant && !Number.isNaN(Date.parse(avant)) ? avant : null;
  const { data, error } = await supabase.rpc("admin_list_actions", {
    p_limit: 100,
    p_before: before,
  });
  const rows = (data ?? []) as ActionRow[];
  const last = rows.at(-1);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader title="Journal" subtitle="Toutes les décisions admin, les plus récentes d'abord." />
      {error ? (
        <p className="text-sm text-ds-danger">Impossible de charger le journal : {error.message}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-ds-line bg-ds-surface px-4 py-6 text-sm text-ds-text2">
          Rien pour l&apos;instant. Chaque approbation, changement d&apos;offre, correction ou suspension apparaîtra ici.
        </p>
      ) : (
        <ol className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
          {rows.map((row) => {
            const href = targetHref(row);
            const label = row.target_label || "un élément";
            const extra = planDetail(row);
            return (
              <li key={row.id} className="flex flex-col gap-0.5 border-b border-ds-line px-4 py-3 last:border-b-0">
                <p className="text-[14px] text-ds-text">
                  <span className="font-semibold">{row.admin_name}</span>{" "}
                  {ACTION_LABEL[row.action] ?? row.action}{" "}
                  {href ? (
                    <Link href={href} className="font-semibold text-ds-text">{label}</Link>
                  ) : (
                    <span className="font-semibold">{label}</span>
                  )}
                  {extra ? <span className="text-ds-text2"> · {extra}</span> : null}
                </p>
                <p className="text-[12.5px] text-ds-text2">
                  {formatAdminDate(row.created_at)}
                  {row.note ? ` · « ${row.note} »` : ""}
                </p>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length === 100 && last ? (
        <Link
          href={`/admin/journal?avant=${encodeURIComponent(last.created_at)}`}
          className="w-fit rounded-xl border border-ds-line bg-ds-surface px-4 py-2 text-[13px] font-bold text-ds-text no-underline"
        >
          Plus ancien →
        </Link>
      ) : null}
    </div>
  );
}
