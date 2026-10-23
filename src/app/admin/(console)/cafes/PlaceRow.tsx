"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  markPlaceReviewedAction,
  updatePlaceAction,
} from "@/app/admin/(console)/actions";
import { formatAdminDay, VERIFICATION_LABEL } from "@/lib/admin/format";
import { cn } from "@/lib/cn";

export type AdminPlaceRow = {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  verification_status: string;
  suggested_by_email: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  members_count: number;
};

const inputClass =
  "h-10 w-full rounded-xl border-[1.5px] border-ds-line bg-ds-bg px-3 text-[14px] text-ds-text outline-none focus:border-ds-admin";

/** One café: summary, quick « Valider » for suggestions, inline edit. */
export default function PlaceRow({ place }: { place: AdminPlaceRow }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(place.name);
  const [address, setAddress] = useState(place.address ?? "");
  const [city, setCity] = useState(place.city ?? "");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  const toReview = Boolean(place.suggested_by_email) && !place.reviewed_at;
  const verified = place.verification_status === "verified";

  const save = () =>
    startTransition(async () => {
      const res = await updatePlaceAction({ placeId: place.id, name, address, city });
      if (!res.ok) {
        setMessage({ text: res.error, error: true });
        return;
      }
      setEditing(false);
      setMessage({ text: "Fiche corrigée.", error: false });
    });

  const review = () =>
    startTransition(async () => {
      const res = await markPlaceReviewedAction(place.id);
      setMessage(
        res.ok
          ? { text: "Café validé.", error: false }
          : { text: res.error, error: true }
      );
    });

  return (
    <li className="flex flex-col gap-2.5 border-b border-ds-line px-4 py-3.5 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/place/${place.id}`}
              className="font-semibold text-ds-text no-underline hover:underline"
            >
              {place.name}
            </Link>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide",
                verified ? "bg-ds-oksoft text-ds-ok" : "bg-ds-surface2 text-ds-text2"
              )}
            >
              {VERIFICATION_LABEL[place.verification_status] ?? place.verification_status}
            </span>
            {toReview ? (
              <span className="rounded-md bg-ds-adminsoft px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-ds-admintext">
                Suggéré
              </span>
            ) : null}
          </div>
          <p className="text-[13px] text-ds-text2">
            {[place.address, place.city].filter(Boolean).join(" · ") || "Adresse manquante"}
          </p>
          <p className="text-[12px] text-ds-text2">
            Ajouté le {formatAdminDay(place.created_at)}
            {place.suggested_by_email ? ` par ${place.suggested_by_email}` : ""}
            {place.members_count > 0 ? ` · ${place.members_count} membre(s) d'équipe` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing((v) => !v);
              setMessage(null);
            }}
            className="h-9 rounded-[10px] border border-ds-line bg-ds-surface px-3 text-[13px] font-bold text-ds-text"
          >
            {editing ? "Annuler" : "Corriger"}
          </button>
          {toReview ? (
            <button
              type="button"
              disabled={pending}
              onClick={review}
              className="h-9 rounded-[10px] bg-ds-admin px-3 text-[13px] font-bold text-ds-onadmin disabled:opacity-50"
            >
              Valider
            </button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <form
          className="grid gap-2 rounded-xl bg-ds-surface2 p-3 sm:grid-cols-[1fr_1fr_160px_auto] sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ds-text2">
            Nom
            <input id={`name-${place.id}`} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ds-text2">
            Adresse
            <input id={`address-${place.id}`} className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-semibold text-ds-text2">
            Ville
            <input id={`city-${place.id}`} className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-10 rounded-xl bg-ds-admin px-4 text-[13px] font-bold text-ds-onadmin disabled:opacity-50"
          >
            Enregistrer
          </button>
        </form>
      ) : null}

      {message ? (
        <p role="status" className={cn("text-[13px] font-semibold", message.error ? "text-ds-danger" : "text-ds-ok")}>
          {message.text}
        </p>
      ) : null}
    </li>
  );
}
