"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import DropForm from "@/app/(pro)/dashboard-pro/components/DropForm";
import {
  getFlashDropById,
  type FlashDrop,
} from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import {
  buildDefaultDropFormState,
  buildFormStateFromDrop,
  buildFormStateFromExample,
  formatCopiedFromBanner,
} from "@/app/(pro)/dashboard-pro/lib/proDrops/dropForm";
import { DROP_FORM_EXAMPLES } from "@/app/(pro)/dashboard-pro/lib/proDrops/examples";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import { useVendorPlan } from "@/hooks/useVendorPlan";

function NewDropPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const depuisId = searchParams.get("depuis");
  const exempleId = searchParams.get("exemple");
  const { activePlace, activeMemberRole, loading, withCafe } = useActivePlace();
  const { hasPro } = useVendorPlan();

  const exampleMatch = useMemo(
    () => DROP_FORM_EXAMPLES.find((e) => e.id === exempleId) ?? null,
    [exempleId]
  );

  const [sourceDropState, setSourceDropState] = useState<{
    requestedId: string;
    drop: FlashDrop | null;
  } | null>(null);

  const depuisLoading = Boolean(
    depuisId && !exampleMatch && sourceDropState?.requestedId !== depuisId
  );

  useEffect(() => {
    if (exampleMatch || !depuisId) return;
    let cancelled = false;
    void getFlashDropById(depuisId)
      .then((drop) => {
        if (!cancelled) {
          setSourceDropState({ requestedId: depuisId, drop });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSourceDropState({ requestedId: depuisId, drop: null });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [depuisId, exampleMatch]);

  const sourceDrop =
    sourceDropState?.requestedId === depuisId ? sourceDropState.drop : null;

  const initialState = useMemo(() => {
    if (exampleMatch) {
      return buildFormStateFromExample(exampleMatch);
    }
    if (sourceDrop && sourceDrop.id === depuisId) {
      return buildFormStateFromDrop(sourceDrop, { shiftToToday: true });
    }
    return buildDefaultDropFormState();
  }, [exampleMatch, sourceDrop, depuisId]);

  const copiedFromBanner = useMemo(() => {
    if (sourceDrop && sourceDrop.id === depuisId) {
      return formatCopiedFromBanner(sourceDrop);
    }
    return null;
  }, [sourceDrop, depuisId]);

  if (loading || depuisLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (!activePlace) {
    return (
      <p className="px-8 py-10 text-center text-sm text-ds-text2">
        Aucun établissement accessible.
      </p>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[600px] flex-col gap-4 px-4 py-6 lg:px-8">
      <Link
        href={withCafe("/dashboard-pro/drops")}
        className="inline-flex items-center gap-2 text-sm font-bold text-ds-text no-underline"
      >
        <ArrowLeft size={18} weight="bold" aria-hidden />
        Drops flash
      </Link>

      <DropForm
        key={`${activePlace.id}-${depuisId ?? ""}-${exempleId ?? ""}`}
        place={activePlace}
        mode="create"
        initialState={initialState}
        copiedFromBanner={copiedFromBanner}
        role={activeMemberRole}
        hasPro={hasPro}
        onCancel={() => router.push(withCafe("/dashboard-pro/drops"))}
        onSaved={() => router.push(withCafe("/dashboard-pro/drops"))}
        onUnlockPro={() => router.push(withCafe("/abonnement"))}
      />
    </div>
  );
}

export default function NewDropPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
        </div>
      }
    >
      <NewDropPageInner />
    </Suspense>
  );
}
