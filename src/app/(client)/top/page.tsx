"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CaretRight, Coffee, Trophy } from "@phosphor-icons/react";
import Chip from "@/components/ui/Chip";
import EmptyState from "@/components/ui/EmptyState";
import { SPEC_ICONS } from "@/components/places/specIcons";
import { getSpecRankings, type SpecRankingRow } from "@/lib/api/rankings";
import { cn } from "@/lib/cn";
import { ordinal, rankChange, RANKING_SPECS } from "@/lib/placeRanking";
import type { SpecId } from "@/lib/specs";

type TabState = { rows: SpecRankingRow[] } | { error: true };

const TREND_CLASS = {
  new: "bg-ds-accentsoft text-ds-accenttext",
  up: "bg-ds-oksoft text-ds-ok",
  down: "bg-ds-surface2 text-ds-text2",
} as const;

export default function TopPage() {
  const router = useRouter();
  const [tab, setTab] = useState<SpecId>(RANKING_SPECS[0].id);
  const [byTab, setByTab] = useState<Partial<Record<SpecId, TabState>>>({});
  const current = byTab[tab];

  useEffect(() => {
    if (byTab[tab]) return;
    let cancelled = false;
    getSpecRankings(tab)
      .then((rows) => {
        if (!cancelled) setByTab((prev) => ({ ...prev, [tab]: { rows } }));
      })
      .catch(() => {
        if (!cancelled) setByTab((prev) => ({ ...prev, [tab]: { error: true } }));
      });
    return () => {
      cancelled = true;
    };
  }, [tab, byTab]);

  const label = RANKING_SPECS.find((s) => s.id === tab)?.label ?? "";

  return (
    <main className="flex flex-1 flex-col bg-ds-bg pb-28">
      <div className="flex items-center gap-2 px-3 pt-6">
        <Link
          href="/list"
          aria-label="Retour à la liste"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ds-text"
        >
          <ArrowLeft size={22} weight="bold" aria-hidden />
        </Link>
      </div>
      <div className="px-5 pb-3">
        <h1 className="font-display m-0 text-[34px] font-extrabold leading-tight text-ds-text">
          Top de Nice
        </h1>
        <p className="m-0 mt-1 text-[15px] text-ds-text2">
          Classé par les avis donnés sur place ces 30 derniers jours.
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 pb-1 pt-2">
        {RANKING_SPECS.map(({ id, label: tabLabel }) => {
          const Icon = SPEC_ICONS[id];
          return (
            <Chip
              key={id}
              active={tab === id}
              icon={<Icon size={16} weight="regular" aria-hidden />}
              onClick={() => setTab(id)}
            >
              {tabLabel}
            </Chip>
          );
        })}
        <div className="w-2 shrink-0" aria-hidden />
      </div>

      <div className="flex flex-col gap-2.5 px-4 pt-3">
        {!current ? (
          <p className="py-10 text-center text-sm text-ds-text2">Chargement du classement…</p>
        ) : "error" in current ? (
          <p role="alert" className="py-10 text-center text-sm text-ds-text2">
            Impossible de charger le classement. Réessaie dans un instant.
          </p>
        ) : current.rows.length === 0 ? (
          <EmptyState
            icon={<Trophy weight="regular" />}
            title="Pas encore de classement"
            description={`Aucun café n’est encore confirmé pour « ${label} ». Dis « Je suis ici » dans un café et réponds aux questions pour le faire monter.`}
            actionLabel="Voir les cafés"
            onAction={() => router.push("/list")}
            className="px-4 pt-16"
          />
        ) : (
          current.rows.map((row) => {
            const change = rankChange(row.rank, row.previous_rank);
            return (
              <Link
                key={row.place_id}
                href={`/place/${row.place_id}?from=top`}
                className="flex items-center gap-3 rounded-[20px] border border-ds-line bg-ds-surface p-3 no-underline active:scale-[0.99]"
              >
                <span
                  className={cn(
                    "font-display w-9 flex-none text-center text-[22px] font-extrabold tabular-nums",
                    row.rank <= 3 ? "text-ds-accent" : "text-ds-text2"
                  )}
                >
                  {ordinal(row.rank)}
                </span>
                <span className="relative h-14 w-14 flex-none overflow-hidden rounded-2xl bg-ds-surface2">
                  {row.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- arbitrary place CDN URLs
                    <img
                      src={row.image_url}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <Coffee
                      size={22}
                      className="absolute inset-0 m-auto text-ds-text2"
                      aria-hidden
                    />
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-display truncate text-[17px] font-bold text-ds-text">
                    {row.name}
                  </span>
                  <span className="text-sm text-ds-text2">
                    {row.yes_votes > 0
                      ? `${row.yes_votes} confirmation${row.yes_votes > 1 ? "s" : ""} sur place`
                      : tab === "events"
                        ? "Événements récents"
                        : "Annoncé par le café"}
                  </span>
                </span>
                {change ? (
                  <span
                    className={cn(
                      "flex-none rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
                      TREND_CLASS[change.trend]
                    )}
                    title="Évolution sur 7 jours"
                  >
                    {change.label}
                  </span>
                ) : null}
                <CaretRight size={16} className="flex-none text-ds-text2" aria-hidden />
              </Link>
            );
          })
        )}
      </div>
    </main>
  );
}
