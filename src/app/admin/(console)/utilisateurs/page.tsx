import Link from "next/link";
import AdminPageHeader from "@/app/admin/(console)/components/AdminPageHeader";
import AdminSearch from "@/app/admin/(console)/components/AdminSearch";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { formatAdminDay, isSuspended } from "@/lib/admin/format";

export const metadata = {
  title: "Utilisateurs · Admin DropSpot",
};

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  grains_balance: number;
  is_admin: boolean;
  places_count: number;
  plan: string | null;
};

function Pill({ tone, children }: { tone: "admin" | "pro" | "danger" | "muted"; children: React.ReactNode }) {
  const tones = {
    admin: "bg-ds-adminsoft text-ds-admintext",
    pro: "bg-ds-oksoft text-ds-ok",
    danger: "bg-ds-dangersoft text-ds-danger",
    muted: "bg-ds-surface2 text-ds-text2",
  };
  return (
    <span className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { supabase } = await requireAdmin("/admin/utilisateurs");
  const { data, error } = await supabase.rpc("admin_search_users", {
    p_query: q.trim() || null,
    p_limit: 100,
  });
  const users = (data ?? []) as UserRow[];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <AdminPageHeader title="Utilisateurs" subtitle="Les comptes les plus récents d'abord.">
        <AdminSearch action="/admin/utilisateurs" query={q} placeholder="E-mail, nom ou pseudo" />
      </AdminPageHeader>

      {error ? (
        <p className="text-sm text-ds-danger">Impossible de charger les comptes : {error.message}</p>
      ) : users.length === 0 ? (
        <p className="rounded-2xl border border-ds-line bg-ds-surface px-4 py-6 text-sm text-ds-text2">
          Aucun compte ne correspond à cette recherche.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
          {users.map((user) => {
            const name = user.full_name?.trim() || user.username?.trim() || "Sans nom";
            return (
              <li key={user.id} className="border-b border-ds-line last:border-b-0">
                <Link
                  href={`/admin/utilisateurs/${user.id}`}
                  className="flex flex-col gap-1 px-4 py-3 no-underline hover:bg-ds-surface2/60 sm:flex-row sm:items-center sm:gap-3"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-ds-text">{name}</span>
                      {user.is_admin ? <Pill tone="admin">Admin</Pill> : null}
                      {user.plan === "pro" ? <Pill tone="pro">Pro</Pill> : null}
                      {user.places_count > 0 ? <Pill tone="muted">Café</Pill> : null}
                      {isSuspended(user.banned_until) ? <Pill tone="danger">Suspendu</Pill> : null}
                    </span>
                    <span className="block truncate text-[13px] text-ds-text2">{user.email}</span>
                  </span>
                  <span className="text-[12.5px] text-ds-text2 tabular-nums sm:text-right">
                    {user.grains_balance} Grains · inscrit le {formatAdminDay(user.created_at)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
