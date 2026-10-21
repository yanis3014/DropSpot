"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Backspace,
  Check,
  CloudSlash,
  Keyboard,
  Lightning,
  Package,
  Repeat,
  ShieldWarning,
  X,
} from "@phosphor-icons/react";
import ProEmptyState from "@/components/pro/ProEmptyState";
import { useActivePlace } from "@/app/(pro)/hooks/useActivePlace";
import {
  addDropPlaces,
  cancelDropRedemption,
  fetchDropContextByCode,
  fetchFlashDropRemaining,
  redeemDropCode,
} from "@/app/(pro)/dashboard-pro/lib/api/dropCodeValidate";
import PlaceMemberRoleLoader from "@/app/(pro)/dashboard-pro/components/PlaceMemberRoleLoader";
import {
  appendDigitToCode,
  backspaceCode,
  formatDropCodeDisplay,
  isCompleteDropCode,
  normalizeDropCodeRaw,
} from "@/app/(pro)/dashboard-pro/lib/counterValidate/formatCode";
import {
  buildVerdictViewModel,
  formatParisTime,
  redeemStatusFromResult,
  type RedeemDropCodeResult,
  type VerdictViewModel,
} from "@/app/(pro)/dashboard-pro/lib/counterValidate/verdict";
import { cn } from "@/lib/cn";

const QrScannerPane = dynamic(() => import("./QrScannerPane"), { ssr: false });

type Mode = "scanner" | "keyboard" | "verdict";

const SCAN_DEBOUNCE_MS = 3000;

function CafePill({
  initials,
  name,
}: {
  initials: string;
  name: string;
}) {
  return (
    <span className="inline-flex h-10 max-w-[200px] items-center gap-2 rounded-[20px] border-[1.5px] border-ds-accent bg-ds-accentsoft px-1.5 pl-1.5 pr-3 text-sm font-bold text-ds-text">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ds-accent font-display text-xs font-extrabold text-ds-onaccent">
        {initials}
      </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

function fixCodeBoxes(code: string) {
  const n = normalizeDropCodeRaw(code);
  const slots = [0, 1, 2, 3, 4, 5].map((i) => n[i] ?? "");
  return (
    <div
      className="flex items-center gap-1.5"
      aria-label={`Code saisi : ${formatDropCodeDisplay(code) || "vide"}`}
    >
      {[0, 1].map((i) => (
        <span
          key={i}
          className="flex h-14 w-[42px] items-center justify-center rounded-xl border-[1.5px] border-ds-line bg-ds-surface text-2xl font-bold"
        >
          {slots[i]}
        </span>
      ))}
      <span className="text-2xl font-bold text-ds-text2">-</span>
      {[2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn(
            "flex h-14 w-[42px] items-center justify-center rounded-xl border-[1.5px] bg-ds-surface text-2xl font-bold",
            i === n.length && n.length >= 2 ? "border-ds-accent" : "border-ds-line"
          )}
        >
          {slots[i]}
        </span>
      ))}
    </div>
  );
}

function VerdictIcon({ band }: { band: VerdictViewModel["band"] }) {
  const cls = "h-14 w-14 stroke-[2.2]";
  switch (band) {
    case "ok":
      return <Check className={cls} weight="bold" aria-hidden />;
    case "warn":
      return <Repeat className={cls} weight="bold" aria-hidden />;
    case "danger":
      return <Package className={cls} weight="bold" aria-hidden />;
    default:
      return <CloudSlash className={cls} weight="bold" aria-hidden />;
  }
}

function CounterValidateInner({
  activePlace,
  placeRole,
  initials,
  withCafe,
}: {
  activePlace: NonNullable<ReturnType<typeof useActivePlace>["activePlace"]>;
  placeRole: string;
  initials: string;
  withCafe: (href: string) => string;
}) {
  const [mode, setMode] = useState<Mode>("scanner");
  const [keyboardCode, setKeyboardCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verdict, setVerdict] = useState<VerdictViewModel | null>(null);
  const [lastCode, setLastCode] = useState("");
  const [pendingOfflineCode, setPendingOfflineCode] = useState<string | null>(
    null
  );
  const [cameraHint, setCameraHint] = useState<string | null>(null);

  const lastScanRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const buildMetaOk = useCallback(
    async (result: RedeemDropCodeResult, rawCode: string) => {
      const time = formatParisTime(new Date().toISOString());
      const display =
        result.code_display ?? formatDropCodeDisplay(rawCode);
      if (result.flash_drop_id) {
        const { remaining } = await fetchFlashDropRemaining(
          result.flash_drop_id
        );
        if (remaining != null) {
          return `Code ${display} · ${time} · reste ${remaining} place${remaining === 1 ? "" : "s"}`;
        }
      }
      return display ? `Code ${display} · ${time}` : undefined;
    },
    []
  );

  async function submitCode(raw: string) {
      if (!activePlace?.id || submitting) return;
      const normalized = normalizeDropCodeRaw(raw);
      if (normalized.length !== 6) return;

      if (!navigator.onLine) {
        setPendingOfflineCode(normalized);
        setLastCode(normalized);
        setVerdict(
          buildVerdictViewModel({
            status: "offline",
            codeTapped: normalized,
          })
        );
        setMode("verdict");
        return;
      }

      setSubmitting(true);
      setLastCode(normalized);

      const { result, networkError } = await redeemDropCode(
        activePlace.id,
        normalized
      );

      if (networkError || !navigator.onLine) {
        setPendingOfflineCode(normalized);
        setSubmitting(false);
        setVerdict(
          buildVerdictViewModel({
            status: "offline",
            codeTapped: normalized,
          })
        );
        setMode("verdict");
        return;
      }

      setPendingOfflineCode(null);
      const status = redeemStatusFromResult(result, false);
      const ctx = await fetchDropContextByCode(activePlace.id, normalized);

      let endedAtLabel: string | null = null;
      if (ctx?.stoppedAt) endedAtLabel = formatParisTime(ctx.stoppedAt);
      else if (ctx?.endsAt && status === "ended") {
        endedAtLabel = formatParisTime(ctx.endsAt);
      }

      let soldOutLabel: string | null = null;
      if (
        status === "sold_out" &&
        ctx?.maxUses != null &&
        ctx.currentUses != null
      ) {
        soldOutLabel = `Les ${ctx.maxUses} places de ce drop sont toutes utilisées.`;
      }

      const metaLine =
        status === "ok" ? await buildMetaOk(result, normalized) : undefined;

      const vm = buildVerdictViewModel({
        status,
        result: {
          ...result,
          flash_drop_id: result.flash_drop_id ?? ctx?.flashDropId ?? undefined,
        },
        dropTitle: result.title ?? ctx?.dropTitle ?? null,
        metaLine,
        endedAtLabel,
        soldOutLabel,
        codeTapped: normalized,
        placeRole,
      });

      setVerdict(vm);
      setMode("verdict");
      setSubmitting(false);

      if (status === "ok" && typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(80);
      }
  }

  useEffect(() => {
    if (!pendingOfflineCode || !activePlace?.id) return;
    const onOnline = () => {
      void submitCode(pendingOfflineCode);
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
    // submitCode is recreated each render with fresh closure
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [pendingOfflineCode, activePlace?.id]);

  function handleScan(raw: string) {
    const normalized = normalizeDropCodeRaw(raw);
    if (normalized.length !== 6) return;
    const now = Date.now();
    if (
      lastScanRef.current.code === normalized &&
      now - lastScanRef.current.at < SCAN_DEBOUNCE_MS
    ) {
      return;
    }
    lastScanRef.current = { code: normalized, at: now };
    void submitCode(normalized);
  }

  const resetToScanner = () => {
    setVerdict(null);
    setMode("scanner");
    setKeyboardCode("");
    setCameraHint(null);
  };

  const onCameraUnavailable = useCallback(() => {
    setCameraHint("Caméra indisponible — saisis le code manuellement.");
    setMode("keyboard");
  }, []);

  const phoneShell = cn(
    "relative flex min-h-dvh w-full flex-col overflow-hidden bg-ds-bg text-ds-text",
    "lg:my-6 lg:min-h-[844px] lg:max-h-[844px] lg:rounded-[46px] lg:shadow-[0_24px_60px_rgba(40,25,15,0.16)] lg:ring-1 lg:ring-black/10"
  );

  return (
    <div className="flex min-h-dvh w-full justify-center bg-ds-bg lg:bg-[#ECE8E2] dark:lg:bg-ds-bg">
      <div className="w-full max-w-[390px]">
        {mode === "scanner" && (
          <div className={cn(phoneShell, "bg-[#0E0B09] text-white")}>
            <QrScannerPane
              active={mode === "scanner"}
              onScan={handleScan}
              onCameraUnavailable={onCameraUnavailable}
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[#1E1813]/40"
              aria-hidden
            />
            <div className="absolute left-4 right-4 top-[max(3rem,env(safe-area-inset-top))] z-10 flex items-center justify-between gap-2">
              <Link
                href={withCafe("/dashboard-pro")}
                aria-label="Fermer"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white"
              >
                <X size={20} weight="bold" />
              </Link>
              <CafePill initials={initials} name={activePlace.name} />
              <span className="h-11 w-11" aria-hidden />
            </div>
            <div
              className="pointer-events-none absolute left-[65px] top-[240px] h-[260px] w-[260px]"
              aria-hidden
            >
              <div className="absolute left-0 top-0 h-[46px] w-[46px] rounded-tl-[18px] border-l-[5px] border-t-[5px] border-white" />
              <div className="absolute right-0 top-0 h-[46px] w-[46px] rounded-tr-[18px] border-r-[5px] border-t-[5px] border-white" />
              <div className="absolute bottom-0 left-0 h-[46px] w-[46px] rounded-bl-[18px] border-b-[5px] border-l-[5px] border-white" />
              <div className="absolute bottom-0 right-0 h-[46px] w-[46px] rounded-br-[18px] border-b-[5px] border-r-[5px] border-white" />
              <div className="absolute left-5 right-5 top-32 h-0.5 rounded bg-ds-accent" />
            </div>
            <p className="absolute left-6 right-6 top-[530px] z-10 text-center text-lg font-bold">
              Vise le QR code du client
            </p>
            <p className="absolute left-6 right-6 top-[562px] z-10 text-center text-[15px] text-[#D9CFC5]">
              La validation est automatique.
            </p>
            {cameraHint ? (
              <p className="absolute left-6 right-6 top-[600px] z-10 text-center text-sm text-[#D9CFC5]">
                {cameraHint}
              </p>
            ) : null}
            <div className="absolute bottom-11 left-4 right-4 z-10">
              <button
                type="button"
                onClick={() => setMode("keyboard")}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[17px] font-bold text-[#231915]"
              >
                <Keyboard size={20} weight="bold" aria-hidden />
                Taper le code
              </button>
            </div>
          </div>
        )}

        {mode === "keyboard" && (
          <div className={phoneShell}>
            <div className="flex flex-col gap-5 px-4 pt-[max(3.25rem,env(safe-area-inset-top))]">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setMode("scanner")}
                  className="flex h-12 items-center gap-1 px-2 text-base font-semibold text-ds-text"
                >
                  <ArrowLeft size={20} weight="bold" aria-hidden />
                  Scanner
                </button>
                <CafePill initials={initials} name={activePlace.name} />
              </div>
              <h1 className="font-display m-0 text-[28px] font-extrabold leading-tight">
                Tape le code du client
              </h1>
              <button
                type="button"
                className="text-left"
                onClick={() => hiddenInputRef.current?.focus()}
              >
                {fixCodeBoxes(keyboardCode)}
              </button>
              <input
                ref={hiddenInputRef}
                type="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={6}
                value={normalizeDropCodeRaw(keyboardCode)}
                onChange={(e) =>
                  setKeyboardCode(normalizeDropCodeRaw(e.target.value))
                }
                className="sr-only"
                aria-label="Code client complet"
              />
              <p className="text-sm text-ds-text2">
                6 caractères, affichés sous le QR dans l&apos;app du client.
              </p>
            </div>
            <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-2 bg-ds-surface2 p-3 pb-10">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  className="flex h-14 items-center justify-center rounded-[14px] bg-ds-surface text-2xl font-semibold"
                  onClick={() =>
                    setKeyboardCode((c) => appendDigitToCode(c, d))
                  }
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                aria-label="Effacer"
                className="flex h-14 items-center justify-center rounded-[14px] bg-ds-surface"
                onClick={() => setKeyboardCode((c) => backspaceCode(c))}
              >
                <Backspace size={24} weight="bold" />
              </button>
              <button
                type="button"
                className="flex h-14 items-center justify-center rounded-[14px] bg-ds-surface text-2xl font-semibold"
                onClick={() =>
                  setKeyboardCode((c) => appendDigitToCode(c, "0"))
                }
              >
                0
              </button>
              <button
                type="button"
                disabled={!isCompleteDropCode(keyboardCode) || submitting}
                className="flex h-14 items-center justify-center rounded-[14px] bg-ds-accent text-[17px] font-bold text-ds-onaccent disabled:opacity-50"
                onClick={() => void submitCode(keyboardCode)}
              >
                Vérifier
              </button>
            </div>
          </div>
        )}

        {mode === "verdict" && verdict && (
          <div className={phoneShell}>
            <div
              className={cn(
                "flex h-[330px] flex-col items-center justify-end gap-4 pb-7",
                verdict.band === "ok" && "bg-ds-oksoft text-ds-ok",
                verdict.band === "warn" && "bg-ds-warnsoft text-ds-warn",
                verdict.band === "danger" && "bg-ds-dangersoft text-ds-danger",
                verdict.band === "neutral" && "bg-ds-surface2 text-ds-text"
              )}
              role="status"
            >
              <span className="flex h-28 w-28 items-center justify-center rounded-full bg-ds-surface">
                <VerdictIcon band={verdict.band} />
              </span>
              <h2 className="font-display m-0 px-4 text-center text-[34px] font-extrabold leading-tight">
                {verdict.title}
              </h2>
            </div>
            <div className="flex flex-col gap-3.5 px-4 pt-5">
              <p className="m-0 text-center text-[17px] leading-snug">
                {verdict.body}
              </p>
              {(verdict.dropTitle || verdict.meta) && (
                <div className="flex flex-col gap-1 rounded-[18px] border border-ds-line bg-ds-surface p-3.5">
                  {verdict.dropTitle ? (
                    <span className="text-base font-bold">{verdict.dropTitle}</span>
                  ) : null}
                  {verdict.meta ? (
                    <span className="text-sm text-ds-text2">{verdict.meta}</span>
                  ) : null}
                </div>
              )}
            </div>
            <div className="absolute bottom-10 left-4 right-4 flex flex-col gap-1.5">
              {verdict.kind === "ok" ? (
                <>
                  <button
                    type="button"
                    className="flex h-14 items-center justify-center rounded-2xl bg-ds-accent text-[17px] font-bold text-ds-onaccent"
                    onClick={resetToScanner}
                  >
                    Scanner le suivant
                  </button>
                  <button
                    type="button"
                    className="flex h-12 items-center justify-center text-base font-semibold text-ds-text"
                    onClick={() =>
                      void cancelDropRedemption(activePlace.id, lastCode).then(
                        resetToScanner
                      )
                    }
                  >
                    Annuler cette validation
                  </button>
                </>
              ) : null}
              {verdict.kind === "already_used" ? (
                <>
                  <button
                    type="button"
                    className="flex h-14 items-center justify-center rounded-2xl bg-ds-accent text-[17px] font-bold text-ds-onaccent"
                    onClick={resetToScanner}
                  >
                    Scanner un autre code
                  </button>
                  <Link
                    href={withCafe("/dashboard-pro")}
                    className="flex h-12 items-center justify-center text-base font-semibold text-ds-text no-underline"
                  >
                    Voir l&apos;historique du jour
                  </Link>
                </>
              ) : null}
              {verdict.kind === "ended" || verdict.kind === "not_found" ? (
                <>
                  <button
                    type="button"
                    className="flex h-14 items-center justify-center rounded-2xl bg-ds-accent text-[17px] font-bold text-ds-onaccent"
                    onClick={resetToScanner}
                  >
                    Scanner un autre code
                  </button>
                  {verdict.kind === "ended" ? (
                    <Link
                      href={withCafe("/dashboard-pro/drops")}
                      className="flex h-12 items-center justify-center gap-2 text-base font-semibold text-ds-text no-underline"
                    >
                      <Lightning size={18} weight="bold" aria-hidden />
                      Créer un drop rapide
                    </Link>
                  ) : null}
                </>
              ) : null}
              {verdict.kind === "sold_out" ? (
                <>
                  {verdict.showAddFivePlaces && verdict.flashDropId ? (
                    <button
                      type="button"
                      disabled={submitting}
                      className="flex h-14 items-center justify-center rounded-2xl bg-ds-accentsoft text-[17px] font-bold text-ds-accenttext disabled:opacity-50"
                      onClick={() => {
                        void (async () => {
                          setSubmitting(true);
                          await addDropPlaces(verdict.flashDropId!, 5);
                          await submitCode(lastCode);
                        })();
                      }}
                    >
                      Ajouter 5 places et valider
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="flex h-12 items-center justify-center text-base font-semibold text-ds-text"
                    onClick={resetToScanner}
                  >
                    {verdict.showAddFivePlaces
                      ? "Refuser poliment"
                      : "Refuser poliment"}
                  </button>
                </>
              ) : null}
              {verdict.kind === "offline" ? (
                <>
                  <button
                    type="button"
                    className="flex h-14 items-center justify-center rounded-2xl bg-ds-accent text-[17px] font-bold text-ds-onaccent"
                    onClick={() => void submitCode(lastCode)}
                    disabled={submitting}
                  >
                    Réessayer
                  </button>
                  <button
                    type="button"
                    className="flex h-12 items-center justify-center text-base font-semibold text-ds-text"
                    onClick={() => {
                      setPendingOfflineCode(lastCode);
                      resetToScanner();
                    }}
                  >
                    Garder le code pour plus tard
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {submitting && mode !== "verdict" ? (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-black/20">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-white" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function CounterValidateClient() {
  const router = useRouter();
  const { activePlace, loading, initialsFor, withCafe } = useActivePlace();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-ds-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
      </div>
    );
  }

  if (!activePlace) {
    return (
      <ProEmptyState
        icon={<ShieldWarning weight="duotone" />}
        title="Aucun établissement"
        description="Revendique ou rejoins un café pour valider des codes au comptoir."
        actionLabel="Retour à l'accueil"
        onAction={() => router.push(withCafe("/dashboard-pro"))}
        className="min-h-dvh justify-center"
      />
    );
  }

  return (
    <PlaceMemberRoleLoader key={activePlace.id} placeId={activePlace.id}>
      {(role, roleLoading) => {
        if (roleLoading) {
          return (
            <div className="flex min-h-dvh items-center justify-center bg-ds-bg">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
            </div>
          );
        }
        if (!role) {
          return (
            <ProEmptyState
              tone="danger"
              icon={<ShieldWarning weight="duotone" />}
              title="Tu n'as pas accès à ce café"
              description={`${activePlace.name} ne fait pas partie de tes établissements. Si tu le gères, revendique-le.`}
              actionLabel="Revenir à l'accueil"
              secondaryLabel="Revendiquer ce café"
              onAction={() => router.push(withCafe("/dashboard-pro"))}
              onSecondary={() => router.push("/dashboard-pro/onboarding")}
              className="min-h-dvh justify-center"
            />
          );
        }
        return (
          <CounterValidateInner
            activePlace={activePlace}
            placeRole={role}
            initials={initialsFor(activePlace.name)}
            withCafe={withCafe}
          />
        );
      }}
    </PlaceMemberRoleLoader>
  );
}
