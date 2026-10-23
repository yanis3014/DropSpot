import Link from "next/link";
import { cn } from "@/lib/cn";

/** GET search form + filter chips; state lives in the URL. */
export default function AdminSearch({
  action,
  query,
  placeholder,
  filters,
  activeFilter,
}: {
  action: string;
  query: string;
  placeholder: string;
  filters?: { value: string; label: string; count?: number }[];
  activeFilter?: string;
}) {
  const hrefFor = (value: string) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (value !== "all") params.set("filtre", value);
    const qs = params.toString();
    return qs ? `${action}?${qs}` : action;
  };

  return (
    <div className="flex flex-col gap-2.5">
      <form action={action} className="flex gap-2">
        {activeFilter && activeFilter !== "all" ? (
          <input type="hidden" name="filtre" value={activeFilter} />
        ) : null}
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder={placeholder}
          className="h-11 min-w-0 flex-1 rounded-xl border-[1.5px] border-ds-line bg-ds-surface px-3.5 text-[15px] text-ds-text outline-none focus:border-ds-admin"
        />
        <button
          type="submit"
          className="h-11 rounded-xl bg-ds-admin px-4 text-sm font-bold text-ds-onadmin"
        >
          Chercher
        </button>
      </form>
      {filters ? (
        <nav aria-label="Filtres" className="flex flex-wrap gap-1.5">
          {filters.map(({ value, label, count }) => {
            const active = (activeFilter ?? "all") === value;
            return (
              <Link
                key={value}
                href={hrefFor(value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[13px] font-semibold no-underline",
                  active
                    ? "border-ds-admin bg-ds-admin text-ds-onadmin"
                    : "border-ds-line bg-ds-surface text-ds-text"
                )}
              >
                {label}
                {count ? <span className="ml-1.5 tabular-nums opacity-70">{count}</span> : null}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
