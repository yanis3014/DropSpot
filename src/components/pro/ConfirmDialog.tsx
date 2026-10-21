"use client";

import { useEffect, useId } from "react";
import Button from "@/components/ui/Button";
import PlanBadge from "@/components/pro/PlanBadge";
import { cn } from "@/lib/cn";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  /** Optional bullet benefits (Pro upsell). */
  benefits?: string[];
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  /** Shows the Pro plan badge in the header. */
  proReserved?: boolean;
  /** Destructive confirm (e.g. Arrêter un drop). */
  danger?: boolean;
  /** Filled danger CTA (maquette btn-dangerf). */
  dangerFilled?: boolean;
  className?: string;
}

/** Modal confirm / Pro-gated dialog (scrim + centered card). */
export default function ConfirmDialog({
  open,
  title,
  description,
  benefits,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  onConfirm,
  onCancel,
  proReserved = false,
  danger = false,
  dangerFilled = false,
  className,
}: ConfirmDialogProps) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/45"
        aria-label="Fermer"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative z-[71] flex w-full max-w-[520px] flex-col gap-3.5 rounded-[22px] bg-ds-surface p-7 shadow-ds",
          className
        )}
      >
        {proReserved ? (
          <div className="flex items-center gap-2.5">
            <PlanBadge plan="pro" />
            <span className="text-[13px] font-bold text-ds-text2">
              Fonction réservée
            </span>
          </div>
        ) : null}

        <h2
          id={titleId}
          className="font-display m-0 text-2xl font-extrabold text-ds-text"
        >
          {title}
        </h2>

        {description ? (
          <p className="m-0 text-[15px] leading-relaxed text-ds-text2">
            {description}
          </p>
        ) : null}

        {benefits && benefits.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-[15px] text-ds-text">
            {benefits.map((b) => (
              <li key={b} className="flex items-center gap-2">
                <span className="text-ds-ok" aria-hidden>
                  ✓
                </span>
                {b}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex justify-end gap-2.5 pt-1.5">
          <Button
            variant="outline"
            onClick={onCancel}
            className="h-11 rounded-xl border-transparent bg-transparent px-[18px] text-[15px] shadow-none"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "outline" : "main"}
            onClick={onConfirm}
            className={cn(
              "h-11 rounded-xl px-[18px] text-[15px]",
              danger &&
                !dangerFilled &&
                "border-transparent bg-ds-dangersoft text-ds-danger hover:opacity-90",
              danger &&
                dangerFilled &&
                "border-transparent bg-ds-danger text-ds-bg hover:opacity-90"
            )}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
