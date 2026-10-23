"use client";

import { useState, useTransition } from "react";
import { setVendorPlanAction } from "@/app/admin/(console)/actions";
import { formatAdminDay } from "@/lib/admin/format";

function dayInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

/** Free / Pro switch with an optional end date (pilot: paid by e-mail). */
export default function PlanControl({
  userId,
  plan,
  proUntil,
  hasPro,
}: {
  userId: string;
  plan: "free" | "pro";
  proUntil: string | null;
  hasPro: boolean;
}) {
  const [until, setUntil] = useState(dayInput(proUntil));
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = (next: "free" | "pro") =>
    startTransition(async () => {
      const res = await setVendorPlanAction({ userId, plan: next, proUntil: next === "pro" ? until : "" });
      setMessage(
        res.ok
          ? { text: next === "pro" ? "Pro activé." : "Retour à l'offre Gratuite.", error: false }
          : { text: res.error, error: true }
      );
    });

  const status = hasPro
    ? proUntil
      ? `Pro jusqu'au ${formatAdminDay(proUntil)}`
      : "Pro sans date de fin"
    : plan === "pro"
      ? `Pro expiré le ${formatAdminDay(proUntil)}`
      : "Gratuit";

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] font-semibold text-ds-text">{status}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-semibold text-ds-text2">
          Fin du Pro (vide = sans fin)
          <input
            id={`pro-until-${userId}`}
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            className="h-10 rounded-xl border-[1.5px] border-ds-line bg-ds-bg px-3 text-[14px] text-ds-text outline-none focus:border-ds-admin"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => apply("pro")}
          className="h-10 rounded-xl bg-ds-admin px-4 text-[13px] font-bold text-ds-onadmin disabled:opacity-50"
        >
          {hasPro ? "Mettre à jour" : "Activer Pro"}
        </button>
        {plan === "pro" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => apply("free")}
            className="h-10 rounded-xl border border-ds-line bg-ds-surface px-4 text-[13px] font-bold text-ds-text disabled:opacity-50"
          >
            Repasser en Gratuit
          </button>
        ) : null}
      </div>
      {message ? (
        <p role="status" className={`text-[13px] font-semibold ${message.error ? "text-ds-danger" : "text-ds-ok"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
