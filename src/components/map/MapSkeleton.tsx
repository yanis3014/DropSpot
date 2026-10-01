/** Full-viewport map placeholder while Mapbox chunks / data load. */
export default function MapSkeleton() {
  return (
    <div
      className="absolute inset-0 h-[100dvh] w-full overflow-hidden bg-brand-muted"
      aria-busy="true"
      aria-label="Chargement de la carte"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand-muted via-brand-surface to-brand-muted" />
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-oat/80 to-transparent p-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-9 w-20 flex-shrink-0 animate-pulse rounded-full bg-brand-mocha/10"
            />
          ))}
        </div>
      </div>
      <div className="absolute bottom-28 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-surface/80 px-4 py-2 shadow-sm backdrop-blur-sm">
        <span className="h-2 w-2 animate-pulse rounded-full bg-brand-matcha" />
        <span className="text-xs font-medium text-brand-mocha">Chargement de la carte…</span>
      </div>
    </div>
  );
}
