"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { acceptPlaceInvitation } from "@/app/(pro)/dashboard-pro/lib/api/vendor";
import Button from "@/components/ui/Button";

function InvitationInner() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !token || status !== "idle") return;
    setStatus("working");
    void acceptPlaceInvitation(token).then((result) => {
      if (result.ok && result.placeId) {
        setStatus("done");
        router.replace(`/dashboard-pro?cafe=${result.placeId}`);
        return;
      }
      setStatus("error");
      setMessage(result.error ?? "Impossible d’accepter l’invitation.");
    });
  }, [authLoading, isAuthenticated, router, status, token]);

  if (authLoading) {
    return (
      <p className="px-6 py-16 text-center text-sm text-ds-text2">Chargement…</p>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16 text-center">
        <h1 className="font-display m-0 text-xl font-extrabold text-ds-text">
          Invitation équipe
        </h1>
        <p className="m-0 text-sm text-ds-text2">
          Connecte-toi ou crée un compte client pour rejoindre ce café sur
          Dropspot.
        </p>
        <Link
          href={`/login?redirect=${encodeURIComponent(`/dashboard-pro/invitation/${token}`)}`}
          className="no-underline"
        >
          <Button variant="main" className="w-full">
            Continuer
          </Button>
        </Link>
      </div>
    );
  }

  if (status === "working" || status === "done") {
    return (
      <p className="px-6 py-16 text-center text-sm text-ds-text2">
        Invitation en cours…
      </p>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto flex max-w-md flex-col gap-4 px-6 py-16 text-center">
        <h1 className="font-display m-0 text-xl font-extrabold text-ds-text">
          Invitation
        </h1>
        <p className="m-0 text-sm text-ds-text2">{message}</p>
        <Link href="/dashboard-pro" className="text-sm font-bold text-ds-accent">
          Retour à l&apos;accueil pro
        </Link>
      </div>
    );
  }

  return null;
}

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <p className="px-6 py-16 text-center text-sm text-ds-text2">Chargement…</p>
      }
    >
      <InvitationInner />
    </Suspense>
  );
}
