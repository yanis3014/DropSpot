import Link from "next/link";
import { notFound } from "next/navigation";
import UserAdminActions from "@/app/admin/(console)/utilisateurs/[id]/UserAdminActions";
import PlanControl from "@/app/admin/(console)/abonnements/PlanControl";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { ACTION_LABEL, formatAdminDate, formatAdminDay, isSuspended } from "@/lib/admin/format";

export const metadata = {
  title: "Compte · Admin DropSpot",
};

type UserDetail = {
  id: string;
  email: string | null;
  created_at: string | null;
  last_sign_in_at: string | null;
  banned_until: string | null;
  full_name: string | null;
  username: string | null;
  grains_balance: number;
  is_admin: boolean;
  plan: { plan: string; pro_until: string | null; has_pro: boolean } | null;
  places: { id: string; name: string; role: string }[];
  check_ins_count: number;
  suggested_count: number;
  grains: { amount: number; reason: string; created_at: string }[];
  actions: { action: string; note: string | null; created_at: string }[];
};

const ROLE_LABEL: Record<string, string> = {
  owner: "gérant",
  manager: "responsable",
  staff: "équipier",
};

const GRAINS_REASON: Record<string, string> = {
  welcome: "Bienvenue",
  check_in: "Check-in",
  flash_drop: "Drop",
  endorsement: "Contribution",
  adjustment: "Ajustement",
};

export default async function AdminUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user: me } = await requireAdmin(`/admin/utilisateurs/${id}`);
  const { data, error } = await supabase.rpc("admin_user_detail", { p_user: id });
  if (error || !data) notFound();
  const user = data as UserDetail;

  const name = user.full_name?.trim() || user.username?.trim() || "Sans nom";
  const suspended = isSuspended(user.banned_until);
  const ownsCafe = user.places.some((p) => p.role === "owner");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 lg:px-8 lg:py-8">
      <Link href="/admin/utilisateurs" className="w-fit text-[13px] font-semibold text-ds-text2 no-underline">
        ← Utilisateurs
      </Link>

      <section className="flex flex-col gap-4 rounded-2xl border border-ds-line bg-ds-surface p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ds-accentsoft font-display text-lg font-extrabold text-ds-accenttext">
            {name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <h1 className="font-display text-[22px] font-extrabold text-ds-text">{name}</h1>
            <p className="truncate text-[13px] text-ds-text2">
              {user.email} · inscrit le {formatAdminDay(user.created_at)}
            </p>
          </div>
        </div>
        {suspended ? (
          <p className="rounded-xl bg-ds-dangersoft px-3 py-2 text-[13px] font-semibold text-ds-danger">
            Compte suspendu : il ne peut plus se connecter.
          </p>
        ) : null}
        <dl className="grid grid-cols-3 gap-2">
          {[
            { label: "Grains", value: user.grains_balance },
            { label: "check-ins", value: user.check_ins_count },
            { label: "cafés suggérés", value: user.suggested_count },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-ds-surface2 px-3 py-2">
              <dd className="font-display text-lg font-extrabold tabular-nums text-ds-text">{value}</dd>
              <dt className="text-[12px] text-ds-text2">{label}</dt>
            </div>
          ))}
        </dl>
        <p className="text-[12.5px] text-ds-text2">
          Dernière connexion : {formatAdminDate(user.last_sign_in_at)}
        </p>
      </section>

      {user.places.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-ds-text">Cafés</h2>
          <ul className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
            {user.places.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 border-b border-ds-line px-4 py-2.5 text-[14px] last:border-b-0">
                <Link href={`/place/${p.id}`} className="font-semibold text-ds-text no-underline">{p.name}</Link>
                <span className="text-ds-text2">{ROLE_LABEL[p.role] ?? p.role}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {ownsCafe || user.plan ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-ds-text">Offre</h2>
          <div className="rounded-2xl border border-ds-line bg-ds-surface p-4">
            <PlanControl
              userId={user.id}
              plan={user.plan?.plan === "pro" ? "pro" : "free"}
              proUntil={user.plan?.pro_until ?? null}
              hasPro={Boolean(user.plan?.has_pro)}
            />
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-2">
        <h2 className="text-[13px] font-bold text-ds-text">Derniers Grains</h2>
        {user.grains.length === 0 ? (
          <p className="text-[13px] text-ds-text2">Aucun mouvement.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-ds-line bg-ds-surface">
            {user.grains.map((g, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-ds-line px-4 py-2 text-[13.5px] last:border-b-0">
                <span className="text-ds-text">
                  {GRAINS_REASON[g.reason] ?? g.reason}
                  <span className="ml-2 text-ds-text2">{formatAdminDate(g.created_at)}</span>
                </span>
                <span className={`font-bold tabular-nums ${g.amount > 0 ? "text-ds-ok" : "text-ds-danger"}`}>
                  {g.amount > 0 ? `+${g.amount}` : g.amount}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.actions.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-[13px] font-bold text-ds-text">Décisions admin sur ce compte</h2>
          <ul className="flex flex-col gap-1 text-[13px] text-ds-text2">
            {user.actions.map((a, i) => (
              <li key={i}>
                {formatAdminDate(a.created_at)} · {ACTION_LABEL[a.action] ?? a.action} ce compte
                {a.note ? ` · « ${a.note} »` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {user.is_admin || user.id === me.id ? (
        <p className="text-[13px] text-ds-text2">Compte admin : il ne peut pas être suspendu d&apos;ici.</p>
      ) : (
        <UserAdminActions userId={user.id} suspended={suspended} />
      )}
    </div>
  );
}
