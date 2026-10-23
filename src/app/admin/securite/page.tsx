import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth/redirect";
import { ADMIN_HOME, requireAdminMember } from "@/lib/admin/requireAdmin";
import AdminCodeForm from "@/app/admin/securite/AdminCodeForm";

export const metadata = {
  title: "Code admin · DropSpot",
};

/** Admin pages need the 6-digit code: set it up once, then type it each session. */
export default async function AdminSecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: rawRedirect } = await searchParams;
  const target = safeRedirectPath(rawRedirect);
  const next = target.startsWith(ADMIN_HOME) ? target : ADMIN_HOME;

  const { supabase } = await requireAdminMember(next);

  const [{ data: aal }, { data: factors }] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);

  if (aal?.currentLevel === "aal2") {
    redirect(next);
  }

  const verifiedFactor = factors?.totp?.[0] ?? null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-5 py-10">
      <header className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center rounded-md bg-ds-admin px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] text-ds-onadmin">
          ADMIN
        </span>
        <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
          {verifiedFactor ? "Ton code à 6 chiffres" : "Protège ton accès admin"}
        </h1>
        <p className="text-[15px] text-ds-text2">
          {verifiedFactor
            ? "Ouvre ton appli d'authentification et tape le code affiché pour Dropspot."
            : "Une seule fois : ajoute Dropspot à une appli d'authentification (Google Authenticator, 1Password, Authy…). Ensuite, elle te donnera un code à chaque connexion."}
        </p>
      </header>
      <AdminCodeForm
        mode={verifiedFactor ? "verify" : "enroll"}
        factorId={verifiedFactor?.id ?? null}
        next={next}
      />
    </main>
  );
}
