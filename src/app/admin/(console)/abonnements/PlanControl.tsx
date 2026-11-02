"use client";

import { useState, useTransition } from "react";
import { setVendorPlanAction } from "@/app/admin/(console)/actions";
import { formatAdminDay } from "@/lib/admin/format";
import { cn } from "@/lib/cn";
import { PLAN_IDS, PLAN_LABELS, type PlanId } from "@/lib/pro/planFeatures";

function dayInput(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Paris" });
}

/** Présence / Analytics / Premium with an optional end date (pilot: paid by e-mail). */
export default function PlanControl({
  userId,
  plan,
  proUntil,
  hasPro,
}: {
  userId: string;
  /** Stored offer (may have expired, see hasPro). */
  plan: PlanId;
  proUntil: string | null;
  /** Paid offer still running. */
  hasPro: boolean;
}) {
  const [choice, setChoice] = useState<PlanId>(plan);
  const [until, setUntil] = useState(dayInput(proUntil));
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const apply = () =>
    startTransition(async () => {
      const res = await setVendorPlanAction({
        userId,
        plan: choice,
        proUntil: choice === "presence" ? "" : until,
      });
      setMessage(
        res.ok
          ? { text: `Offre ${PLAN_LABELS[choice]} enregistrée.`, error: false }
          : { text: res.error, error: true }
      );
    });

  const status =
    plan === "presence"
      ? PLAN_LABELS.presence
      : hasPro
        ? proUntil
          ? `${PLAN_LABELS[plan]} jusqu'au ${formatAdminDay(proUntil)}`
          : `${PLAN_LABELS[plan]} sans date de fin`
        : `${PLAN_LABELS[plan]} terminé le ${formatAdminDay(proUntil)} (Présence en ce moment)`;

  const unchanged =
    choice === plan && (choice === "presence" || until === dayInput(proUntil));

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] font-semibold text-ds-text">{status}</p>
      <div className="flex flex-wrap items-end gap-2">
        <div
          role="radiogroup"
          aria-label="Offre"
          className="inline-flex rounded-xl border border-ds-line bg-ds-bg p-1"
        >
          {PLAN_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={choice === id}
              onClick={() => setChoice(id)}
              className={cn(
                "h-8 rounded-[9px] px-3 text-[13px] font-bold",
                choice === id ? "bg-ds-admin text-ds-onadmin" : "text-ds-text2"
              )}
            >
              {PLAN_LABELS[id]}
            </button>
          ))}
        </div>
        {choice !== "presence" ? (
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ds-text2">
            Fin de l&apos;offre (vide = sans fin)
            <input
              id={`pro-until-${userId}`}
              type="date"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
              className="h-10 rounded-xl border-[1.5px] border-ds-line bg-ds-bg px-3 text-[14px] text-ds-text outline-none focus:border-ds-admin"
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={pending || unchanged}
          onClick={apply}
          className="h-10 rounded-xl bg-ds-admin px-4 text-[13px] font-bold text-ds-onadmin disabled:opacity-50"
        >
          Enregistrer
        </button>
      </div>
      {message ? (
        <p role="status" className={`text-[13px] font-semibold ${message.error ? "text-ds-danger" : "text-ds-ok"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
