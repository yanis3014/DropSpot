"use client";

import { useState, useTransition } from "react";
import {
  approveClaimAction,
  getClaimProofSignedUrlAction,
  rejectClaimAction,
} from "@/app/admin/revendications/actions";

export type PendingClaimRow = {
  id: string;
  place_id: string;
  user_id: string;
  declared_role: string;
  proof_method: string;
  proof_path: string | null;
  created_at: string;
  place_name: string | null;
  claimant_email: string | null;
};

export default function ClaimReviewPanel({ claims }: { claims: PendingClaimRow[] }) {
  if (claims.length === 0) {
    return (
      <p className="text-ds-text2 text-sm">
        Aucune revendication en attente.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {claims.map((claim) => (
        <ClaimRow key={claim.id} claim={claim} />
      ))}
    </ul>
  );
}

function ClaimRow({ claim }: { claim: PendingClaimRow }) {
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const onViewProof = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await getClaimProofSignedUrlAction(claim.id);
      if (!res.ok || !("url" in res)) {
        setMessage(res.error ?? "Impossible d’ouvrir le justificatif.");
        return;
      }
      window.open(res.url, "_blank", "noopener,noreferrer");
    });
  };

  const onApprove = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await approveClaimAction(claim.id, note);
      if (!res.ok) {
        setMessage(res.error ?? "Échec de l’approbation.");
        return;
      }
      setMessage("Revendication approuvée.");
    });
  };

  const onReject = () => {
    startTransition(async () => {
      setMessage(null);
      const res = await rejectClaimAction(claim.id, note);
      if (!res.ok) {
        setMessage(res.error ?? "Échec du refus.");
        return;
      }
      setMessage("Revendication refusée.");
    });
  };

  return (
    <li className="rounded-[18px] border border-ds-line bg-ds-surface p-4 flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ds-text m-0">
          {claim.place_name ?? "Établissement"}
        </h2>
        <p className="text-sm text-ds-text2 mt-1">
          Demandeur : {claim.claimant_email ?? claim.user_id} · rôle déclaré :{" "}
          {claim.declared_role} · preuve : {claim.proof_method}
        </p>
        <p className="text-xs text-ds-text2">
          Déposée le{" "}
          {new Date(claim.created_at).toLocaleString("fr-FR", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-semibold text-ds-text">Note interne (optionnel)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-10 rounded-xl border border-ds-line bg-ds-bg px-3 text-ds-text"
          placeholder="Motif de refus, commentaire…"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {claim.proof_path ? (
          <button
            type="button"
            disabled={pending}
            onClick={onViewProof}
            className="h-9 rounded-[10px] border border-ds-line bg-ds-surface px-3 text-sm font-bold text-ds-text"
          >
            Voir le justificatif
          </button>
        ) : null}
        <button
          type="button"
          disabled={pending}
          onClick={onApprove}
          className="h-9 rounded-[10px] bg-ds-accent px-3 text-sm font-bold text-ds-onaccent"
        >
          Approuver
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onReject}
          className="h-9 rounded-[10px] bg-ds-dangersoft px-3 text-sm font-bold text-ds-danger"
        >
          Refuser
        </button>
      </div>

      {message ? (
        <p className="text-sm font-semibold text-ds-text2">{message}</p>
      ) : null}
    </li>
  );
}
