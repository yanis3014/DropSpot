"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import DropForm from "@/app/(pro)/dashboard-pro/components/DropForm";
import {
  getFlashDropById,
  type FlashDrop,
} from "@/app/(pro)/dashboard-pro/lib/api/flashDrops";
import {
  buildFormStateFromDrop,
  isDropEditable,
} from "@/app/(pro)/dashboard-pro/lib/proDrops/dropForm";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import { useVendorPlan } from "@/hooks/useVendorPlan";

export default function EditDropPage() {
  const params = useParams();
  const router = useRouter();
  const dropId = typeof params.id === "string" ? params.id : "";
  const { activePlace, activeMemberRole, loading: placeLoading, withCafe } =
    useActivePlace();
  const { hasPro } = useVendorPlan();

  const [loadedState, setLoadedState] = useState<{
    requestedId: string;
    drop: FlashDrop | null;
  } | null>(null);

  const dropLoading = Boolean(dropId && loadedState?.requestedId !== dropId);
  const drop = loadedState?.requestedId === dropId ? loadedState.drop : null;

  useEffect(() => {
    if (!dropId) return;
    let cancelled = false;
    void getFlashDropById(dropId)
      .then((fetched) => {
        if (cancelled) return;
        if (!fetched || !isDropEditable(fetched)) {
          router.replace(withCafe("/dashboard-pro/drops"));
          return;
        }
        setLoadedState({ requestedId: dropId, drop: fetched });
      })
      .catch(() => {
        if (!cancelled) {
          router.replace(withCafe("/dashboard-pro/drops"));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dropId, router, withCafe]);

  const initialState = useMemo(() => {
    if (!drop) return undefined;
    return buildFormStateFromDrop(drop, { shiftToToday: false });
  }, [drop]);

  if (placeLoading || dropLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (!activePlace || !drop || !initialState) {
    return null;
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
        key={drop.id}
        place={activePlace}
        mode="edit"
        dropId={drop.id}
        initialState={initialState}
        role={activeMemberRole}
        hasPro={hasPro}
        onCancel={() => router.push(withCafe("/dashboard-pro/drops"))}
        onSaved={() => router.push(withCafe("/dashboard-pro/drops"))}
        onUnlockPro={() => router.push(withCafe("/abonnement"))}
      />
    </div>
  );
}
