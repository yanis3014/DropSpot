"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";

/** Stub édition programmé — formulaire complet à brancher (6b). */
export default function EditDropPage() {
  const params = useParams();
  const dropId = typeof params.id === "string" ? params.id : "";
  const { withCafe } = useActivePlace();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6 lg:px-8">
      <Link
        href={withCafe("/dashboard-pro/drops")}
        className="inline-flex items-center gap-2 text-sm font-bold text-ds-text no-underline"
      >
        <ArrowLeft size={18} weight="bold" aria-hidden />
        Drops flash
      </Link>
      <h1 className="font-display m-0 text-2xl font-extrabold text-ds-text">
        Modifier le drop
      </h1>
      <p className="m-0 text-sm text-ds-text2">
        Édition du drop{" "}
        <span className="font-mono text-xs">{dropId || "…"}</span> — formulaire
        à venir.
      </p>
    </div>
  );
}
