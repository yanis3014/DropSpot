"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import {
  CalendarPlus,
  CaretLeft,
  CheckCircle,
  Clock,
  NavigationArrow,
  QrCode,
  ShareNetwork,
  Spinner,
  Tag,
  UsersThree,
} from "@phosphor-icons/react";
import Button from "@/components/ui/Button";
import DropCodePanel from "@/components/drops/DropCodePanel";
import {
  EVENT_CATEGORY_ICONS,
  formatHourRange,
  formatRemainingLabel,
  participantsLabel,
  reservedHint,
} from "@/components/drops/DropCard";
import { useAuth } from "@/lib/hooks/useAuth";
import { useDropParticipation } from "@/lib/hooks/useDropParticipation";
import {
  EVENT_CATEGORY_LABELS,
  buildIcs,
  formatStartLabel,
  getDropById,
  getDropTiming,
  googleCalendarUrl,
  type Drop,
} from "@/lib/api/drops";
import { claimDrop } from "@/lib/api/dropCodes";
import { claimDropErrorMessage } from "@/lib/dropCodes/errors";
import type { DropCodeStatus } from "@/lib/dropCodes/screen";
import { openDirections } from "@/lib/utils/directions";

type CodeView = {
  dropCodeId: string;
  code: string;
  status: DropCodeStatus;
};

function isAppleDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

function downloadIcs(drop: Drop) {
  const blob = new Blob([buildIcs(drop)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dropspot-evenement.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shareable page of one drop: event (« Je participe ») or offer (code). */
export default function DropPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = typeof params?.id === "string" ? params.id : "";
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [drop, setDrop] = useState<Drop | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [codeView, setCodeView] = useState<CodeView | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (id ? getDropById(id) : Promise.resolve(null))
      .then((row) => {
        if (!cancelled) setDrop(row);
      })
      .catch((err) => console.error(err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const eventIds = useMemo(
    () => (drop?.family === "event" ? [drop.id] : []),
    [drop]
  );
  const participation = useDropParticipation(eventIds, isAuthenticated);

  const redirectToLogin = useCallback(() => {
    router.push(`/login?redirect=${encodeURIComponent(pathname || "/drops")}`);
  }, [pathname, router]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleShare = async () => {
    if (!drop) return;
    const url = window.location.href;
    const text = `${drop.title} · ${drop.places?.name ?? "Dropspot"}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: drop.title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      showToast("Lien copié");
    } catch {
      // Share sheet closed by the user.
    }
  };

  const handleObtainCode = async () => {
    if (!drop) return;
    if (!isAuthenticated) {
      redirectToLogin();
      return;
    }
    setClaimBusy(true);
    setClaimError(null);
    try {
      const result = await claimDrop(drop.id);
      if (!result.ok) {
        setClaimError(claimDropErrorMessage(result.error, drop));
        return;
      }
      setCodeView({
        dropCodeId: result.dropCodeId,
        code: result.code,
        status: result.status,
      });
    } catch (err) {
      console.error(err);
      setClaimError("Impossible d’obtenir un code. Réessaie.");
    } finally {
      setClaimBusy(false);
    }
  };

  const handleToggleJoin = async () => {
    if (!drop) return;
    const allowed = await participation.toggle(drop.id);
    if (!allowed) redirectToLogin();
  };

  if (loading || authLoading) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 bg-ds-bg">
        <Spinner size={28} className="animate-spin text-ds-ok" />
        <p className="text-sm text-ds-text2">Chargement…</p>
      </div>
    );
  }

  if (!drop) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-ds-bg px-6 text-center">
        <p className="text-base font-bold text-ds-text">Ce drop est introuvable.</p>
        <Button className="h-12 px-6" onClick={() => router.push("/drops")}>
          Voir les drops
        </Button>
      </div>
    );
  }

  const timing = getDropTiming(drop, now);
  const ended = timing === "ended" || drop.stopped === true;
  const live = timing === "live" && !ended;
  const isEvent = drop.family === "event";
  const category = drop.event_category ?? "other";
  const CategoryIcon = EVENT_CATEGORY_ICONS[category];
  const participants = participation.participants(drop.id);
  const joined = participation.isJoined(drop.id);
  const full =
    isEvent && typeof drop.capacity === "number" && participants >= drop.capacity;
  const cafe = drop.places?.name ?? "Café";
  const whenLabel = live
    ? isEvent
      ? `En ce moment · jusqu’à ${formatHourRange(drop).split(" – ")[1]}`
      : formatRemainingLabel(drop.end_time, now)
    : `${formatStartLabel(drop.start_time, now)} – ${formatHourRange(drop).split(" – ")[1]}`;

  return (
    <div className="flex flex-1 flex-col bg-ds-bg pb-40 text-ds-text">
      <div className="relative h-[220px] w-full overflow-hidden bg-ds-accentsoft">
        {drop.places?.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={drop.places.image_url}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ds-accenttext">
            {isEvent ? (
              <CategoryIcon size={72} weight="duotone" aria-hidden />
            ) : (
              <Tag size={72} weight="duotone" aria-hidden />
            )}
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/drops"))}
            aria-label="Retour"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ds-surface/90 shadow-sm backdrop-blur"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            type="button"
            onClick={() => void handleShare()}
            aria-label="Partager"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ds-surface/90 shadow-sm backdrop-blur"
          >
            <ShareNetwork size={20} weight="bold" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-5">
        <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ds-accenttext">
          {isEvent ? (
            <>
              <CategoryIcon size={16} weight="bold" aria-hidden />
              {EVENT_CATEGORY_LABELS[category]}
            </>
          ) : (
            <>
              <Tag size={16} weight="bold" aria-hidden />
              Offre
            </>
          )}
        </span>
        <h1 className="font-display m-0 -mt-2 text-[28px] font-extrabold leading-tight">
          {drop.title}
        </h1>

        <div className="flex flex-col gap-2 rounded-[18px] border border-ds-line bg-ds-surface p-4">
          <p className="m-0 flex items-center gap-2 text-[15px] font-semibold">
            <Clock size={18} weight="bold" className="text-ds-text2" aria-hidden />
            {ended ? "Terminé" : whenLabel}
          </p>
          <Link
            href={`/place/${drop.place_id}?from=drop`}
            className="flex items-center gap-2 text-[15px] font-semibold text-ds-text no-underline"
          >
            <NavigationArrow size={18} weight="bold" className="text-ds-text2" aria-hidden />
            <span className="underline decoration-ds-line underline-offset-4">{cafe}</span>
            {drop.places?.address ? (
              <span className="truncate font-normal text-ds-text2">
                · {drop.places.address}
              </span>
            ) : null}
          </Link>
          {isEvent ? (
            <p className="m-0 flex items-center gap-2 text-[15px] font-semibold">
              <UsersThree size={18} weight="bold" className="text-ds-text2" aria-hidden />
              {participantsLabel(drop, participants)}
            </p>
          ) : null}
          {!ended && reservedHint(drop, now) ? (
            <p className="m-0 text-[13px] font-medium text-ds-text2">
              {reservedHint(drop, now)}
            </p>
          ) : null}
        </div>

        {drop.description ? (
          <p className="m-0 whitespace-pre-line text-[15px] leading-relaxed text-ds-text/90">
            {drop.description}
          </p>
        ) : null}
        {drop.conditions ? (
          <p className="m-0 text-sm text-ds-text2">{drop.conditions}</p>
        ) : null}

        {isEvent && !ended ? (
          <div className="flex gap-2.5">
            <a
              href={googleCalendarUrl(drop)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (isAppleDevice()) {
                  e.preventDefault();
                  downloadIcs(drop);
                }
              }}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-ds-line bg-ds-surface text-[15px] font-bold text-ds-text no-underline"
            >
              <CalendarPlus size={18} weight="bold" aria-hidden />
              Calendrier
            </a>
            <button
              type="button"
              onClick={() =>
                openDirections({
                  name: cafe,
                  address: drop.places?.address,
                  city: drop.places?.city,
                  lat: drop.places?.lat ?? Number.NaN,
                  lng: drop.places?.lng ?? Number.NaN,
                })
              }
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-ds-line bg-ds-surface text-[15px] font-bold text-ds-text"
            >
              <NavigationArrow size={18} weight="bold" aria-hidden />
              Itinéraire
            </button>
          </div>
        ) : null}
      </div>

      <div className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 mx-auto w-full max-w-md px-4 pb-2">
        <div className="flex flex-col gap-2 rounded-2xl border border-ds-line bg-ds-surface/95 p-3 shadow-xl backdrop-blur-md">
          {ended ? (
            <Button
              variant="tonal"
              className="h-12 w-full"
              onClick={() => router.push(`/place/${drop.place_id}?from=drop`)}
            >
              Voir le café
            </Button>
          ) : isEvent ? (
            <Button
              variant={joined ? "tonal" : "main"}
              className="h-12 w-full"
              disabled={participation.busyId === drop.id || (full && !joined)}
              onClick={() => void handleToggleJoin()}
            >
              {joined ? (
                <>
                  <CheckCircle size={18} weight="fill" aria-hidden />
                  Inscrit · se désinscrire
                </>
              ) : full ? (
                "Complet"
              ) : (
                "Je participe"
              )}
            </Button>
          ) : (
            <Button
              className="h-12 w-full"
              disabled={claimBusy || !live}
              onClick={() => void handleObtainCode()}
            >
              <QrCode size={18} weight="regular" aria-hidden />
              {live
                ? "Obtenir mon code"
                : `Disponible ${formatStartLabel(drop.start_time, now).toLowerCase()}`}
            </Button>
          )}
          {participation.error || claimError ? (
            <p role="alert" className="m-0 text-center text-sm font-semibold text-ds-danger">
              {participation.error?.message ?? claimError}
            </p>
          ) : null}
        </div>
      </div>

      {toast ? (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-ds-text px-4 py-2 text-sm font-bold text-ds-bg shadow-lg">
          {toast}
        </div>
      ) : null}

      {codeView ? (
        <DropCodePanel
          dropCodeId={codeView.dropCodeId}
          code={codeView.code}
          title={drop.title}
          cafeName={cafe}
          endsAt={drop.end_time}
          initialStatus={codeView.status}
          onClose={() => setCodeView(null)}
        />
      ) : null}
    </div>
  );
}
