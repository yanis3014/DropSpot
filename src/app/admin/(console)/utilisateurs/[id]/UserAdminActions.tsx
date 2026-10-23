"use client";

import { useState, useTransition } from "react";
import { setUserSuspendedAction } from "@/app/admin/(console)/actions";

/** Suspend (with a reason) or reactivate an account. Two steps: no confirm() in a PWA. */
export default function UserAdminActions({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const res = await setUserSuspendedAction({ userId, suspended: !suspended, note });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setNote("");
    });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`h-11 w-full rounded-xl border-[1.5px] text-[14px] font-bold sm:w-fit sm:px-5 ${
          suspended
            ? "border-ds-line bg-ds-surface text-ds-text"
            : "border-ds-dangersoft bg-ds-surface text-ds-danger"
        }`}
      >
        {suspended ? "Réactiver ce compte…" : "Suspendre ce compte…"}
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-ds-line bg-ds-surface p-4">
      <h2 className="font-display text-lg font-extrabold text-ds-text">
        {suspended ? "Réactiver ce compte" : "Suspendre ce compte"}
      </h2>
      <p className="text-[13px] text-ds-text2">
        {suspended
          ? "La personne pourra de nouveau se connecter."
          : "La personne ne pourra plus se connecter. Une session déjà ouverte peut durer jusqu'à une heure. Ses données restent en place."}
      </p>
      <label htmlFor="suspend-note" className="text-[12px] font-semibold text-ds-text2">
        {suspended ? "Note (optionnelle)" : "Motif (obligatoire, visible dans le journal)"}
      </label>
      <input
        id="suspend-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={suspended ? "" : "Spam, faux café, triche aux Grains…"}
        className="h-11 rounded-xl border-[1.5px] border-ds-line bg-ds-bg px-3 text-[14px] text-ds-text outline-none focus:border-ds-admin"
      />
      {error ? <p role="alert" className="text-[13px] text-ds-danger">{error}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-xl border border-ds-line bg-ds-surface text-[14px] font-bold text-ds-text sm:flex-none sm:px-5"
        >
          Annuler
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className={`h-11 flex-1 rounded-xl text-[14px] font-bold disabled:opacity-50 sm:flex-none sm:px-5 ${
            suspended ? "bg-ds-admin text-ds-onadmin" : "bg-ds-danger text-ds-surface"
          }`}
        >
          {pending ? "…" : suspended ? "Réactiver" : "Suspendre"}
        </button>
      </div>
    </section>
  );
}
