"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/lib/hooks/useAuth";

type Enrollment = { factorId: string; qrCode: string; secret: string };

const FACTOR_NAME = "Dropspot admin";

/**
 * Supabase returns `data:image/svg+xml;utf-8,<svg…>` with the SVG unescaped;
 * re-encode it so every browser shows the QR code.
 */
function qrCodeSrc(raw: string): string {
  const comma = raw.indexOf(",");
  if (!raw.startsWith("data:") || comma === -1) return raw;
  const body = raw.slice(comma + 1);
  const svg = body.trimStart().startsWith("<") ? body : decodeURIComponent(body);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function cleanCode(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 6);
}

/**
 * Sets up (enroll) or checks (verify) the admin's TOTP factor, then reloads
 * the admin page so the server sees the upgraded aal2 session.
 */
export default function AdminCodeForm({
  mode,
  factorId,
  next,
}: {
  mode: "enroll" | "verify";
  factorId: string | null;
  next: string;
}) {
  const { signOut } = useAuth();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "enroll" || !supabase) return;
    const client = supabase;
    let cancelled = false;

    void (async () => {
      // A setup left half-way blocks a new one with the same name.
      const { data: list } = await client.auth.mfa.listFactors();
      for (const factor of list?.all ?? []) {
        if (factor.status !== "verified") {
          await client.auth.mfa.unenroll({ factorId: factor.id });
        }
      }

      const { data, error: enrollError } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: FACTOR_NAME,
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError(
          "Impossible de préparer le code. Recharge la page, et si ça recommence, vérifie que l'authentification à deux facteurs est activée dans Supabase."
        );
        return;
      }
      setEnrollment({
        factorId: data.id,
        qrCode: qrCodeSrc(data.totp.qr_code),
        secret: data.totp.secret,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const activeFactorId = mode === "enroll" ? enrollment?.factorId : factorId;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || !activeFactorId || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: activeFactorId,
      code,
    });
    if (verifyError) {
      setBusy(false);
      setCode("");
      setError("Code incorrect ou expiré. Tape le code affiché maintenant.");
      return;
    }
    // Full load: the server must read the new aal2 session cookie.
    window.location.replace(next);
  };

  return (
    <div className="flex flex-col gap-5">
      {mode === "enroll" ? (
        <section className="flex flex-col items-center gap-3 rounded-[22px] border border-ds-line bg-ds-surface p-5">
          {enrollment ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG data URL from Supabase */}
              <img
                src={enrollment.qrCode}
                alt="QR code à scanner avec ton appli d'authentification"
                width={184}
                height={184}
                className="rounded-xl bg-white p-2"
              />
              <p className="text-center text-sm text-ds-text2">
                Pas de scan possible ? Tape cette clé dans l&apos;appli&nbsp;:
              </p>
              <code className="select-all break-all rounded-lg bg-ds-surface2 px-3 py-2 text-center font-mono text-[13px] text-ds-text">
                {enrollment.secret}
              </code>
            </>
          ) : (
            <div className="flex h-[184px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-admin" />
            </div>
          )}
        </section>
      ) : null}

      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="admin-code" className="text-sm font-bold text-ds-text">
          Code à 6 chiffres
        </label>
        <input
          id="admin-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={mode === "verify"}
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          placeholder="123456"
          className="h-14 rounded-[14px] border-[1.5px] border-ds-line bg-ds-surface px-4 text-center font-mono text-2xl tracking-[0.3em] text-ds-text outline-none focus:border-ds-admin"
        />
        {error ? (
          <p role="alert" className="text-sm text-ds-danger">
            {error}
          </p>
        ) : null}
        <Button
          type="submit"
          disabled={busy || code.length !== 6 || !activeFactorId}
          className="w-full !bg-ds-admin !text-ds-onadmin disabled:opacity-50"
        >
          {busy ? "Vérification…" : mode === "enroll" ? "Activer et entrer" : "Entrer"}
        </Button>
      </form>

      <p className="text-center text-[13px] text-ds-text2">
        Téléphone perdu ? L&apos;autre admin peut supprimer ton code dans
        Supabase (Authentication › Users), puis tu en crées un nouveau ici.
      </p>
      <button
        type="button"
        onClick={() => void signOut()}
        className="min-h-11 text-[15px] font-semibold text-ds-text2"
      >
        Se déconnecter
      </button>
    </div>
  );
}
