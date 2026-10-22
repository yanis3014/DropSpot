"use client";

import Link from "next/link";
import { Storefront } from "@phosphor-icons/react";
import Button from "@/components/ui/Button";

export default function ProLandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-5 py-12">
      <div className="flex flex-col gap-3 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-ds-accentsoft text-ds-accent">
          <Storefront size={32} weight="duotone" aria-hidden />
        </span>
        <h1 className="font-display m-0 text-[28px] font-extrabold text-ds-text">
          Je suis un café
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-ds-text2">
          Dropspot aide les cafés à lancer des drops flash, valider les codes au
          comptoir et faire revenir les habitués du quartier. Une seule
          connexion avec l&apos;app client : tu deviens gérant quand ta
          revendication est approuvée ou quand tu acceptes une invitation
          d&apos;équipe.
        </p>
      </div>
      {/* No prefetch: signed out, the proxy answers with a redirect to /login
          that the router would keep and replay after sign-in. */}
      <Link
        href="/dashboard-pro/onboarding"
        prefetch={false}
        className="no-underline"
      >
        <Button variant="main" className="w-full">
          Revendiquer mon café
        </Button>
      </Link>
      <p className="text-center text-sm text-ds-text2">
        Déjà membre d&apos;un café ?{" "}
        <Link
          href="/login?redirect=/dashboard-pro&espace=pro"
          prefetch={false}
          className="font-bold text-ds-accent"
        >
          Se connecter
        </Link>
      </p>
      <Link
        href="/map"
        className="text-center text-sm font-semibold text-ds-text2 underline decoration-ds-line underline-offset-2"
      >
        Retour à l&apos;app client
      </Link>
    </main>
  );
}
