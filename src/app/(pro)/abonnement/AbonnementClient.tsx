"use client";

import PlanBadge from "@/components/pro/PlanBadge";
import { useVendorPlan } from "@/hooks/useVendorPlan";

export default function AbonnementClient() {
  const { plan, hasPro, proUntil, loading } = useVendorPlan();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <h1 className="font-display text-2xl font-extrabold text-ds-text">
        Abonnement
      </h1>
      <p className="text-sm text-ds-text2">
        Pour tous tes établissements. Pas de paiement in-app — le passage Pro
        est activé par l&apos;équipe DropSpot.
      </p>

      <section className="rounded-[18px] border border-ds-line bg-ds-surface p-5">
        <p className="text-xs font-bold uppercase tracking-wide text-ds-text2">
          Ton offre actuelle
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="font-display text-2xl font-extrabold text-ds-text">
            {loading ? "…" : hasPro ? "Pro" : "Gratuit"}
          </span>
          {!loading ? <PlanBadge plan={plan} /> : null}
        </div>
        {hasPro && proUntil ? (
          <p className="mt-2 text-sm text-ds-text2">
            Pro actif jusqu&apos;au{" "}
            {new Date(proUntil).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        ) : (
          <p className="mt-2 text-sm text-ds-text2">
            Fiche, drops ponctuels, validation au comptoir et équipiers. Les
            fonctions Pro restent visibles dans l&apos;app et sont contrôlées
            côté serveur.
          </p>
        )}
      </section>
    </div>
  );
}
