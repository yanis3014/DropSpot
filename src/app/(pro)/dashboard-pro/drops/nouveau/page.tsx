"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import FlashDropForm from "@/app/(pro)/dashboard-pro/components/FlashDropForm";
import { getFlashDropById } from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import { DROP_FORM_EXAMPLES } from "@/app/(pro)/dashboard-pro/lib/proDrops/examples";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";

function NewDropPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const depuisId = searchParams.get("depuis");
  const exempleId = searchParams.get("exemple");
  const { places, activePlace, loading, withCafe } = useActivePlace();

  const examplePrefill = useMemo(() => {
    const ex = DROP_FORM_EXAMPLES.find((e) => e.id === exempleId);
    if (!ex) return null;
    return { title: ex.title, description: ex.description ?? "" };
  }, [exempleId]);

  const [depuisPrefill, setDepuisPrefill] = useState<{
    id: string;
    title: string;
    description: string;
  } | null>(null);

  const depuisLoading = Boolean(
    depuisId && !examplePrefill && depuisPrefill?.id !== depuisId
  );

  useEffect(() => {
    if (examplePrefill || !depuisId) return;
    let cancelled = false;
    void getFlashDropById(depuisId).then((drop) => {
      if (cancelled || !drop) return;
      setDepuisPrefill({
        id: depuisId,
        title: drop.title,
        description: drop.description ?? "",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [depuisId, examplePrefill]);

  const prefillTitle =
    examplePrefill?.title ??
    (depuisPrefill?.id === depuisId ? depuisPrefill.title : "");
  const prefillDescription =
    examplePrefill?.description ??
    (depuisPrefill?.id === depuisId ? depuisPrefill.description : "");

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
        {depuisId ? "Dupliquer un drop" : "Créer un drop"}
      </h1>
      {loading || depuisLoading ? (
        <p className="text-sm text-ds-text2">Chargement…</p>
      ) : places.length === 0 ? (
        <p className="text-sm text-ds-text2">Aucun établissement.</p>
      ) : (
        <FlashDropForm
          places={activePlace ? [activePlace] : places}
          initialTitle={prefillTitle}
          initialDescription={prefillDescription}
          onCreated={() => router.push(withCafe("/dashboard-pro"))}
        />
      )}
    </div>
  );
}

export default function NewDropPage() {
  return (
    <Suspense fallback={<p className="px-4 py-6 text-sm text-ds-text2">Chargement…</p>}>
      <NewDropPageInner />
    </Suspense>
  );
}
