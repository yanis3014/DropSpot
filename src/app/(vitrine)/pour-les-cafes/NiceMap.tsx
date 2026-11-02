/**
 * Carte stylisée de Nice pour le bandeau « Pour les cafés ».
 * Purement décorative : tout le bloc est aria-hidden.
 * Couleurs exclusivement via les jetons CSS (--night, --sea…), valides
 * en thème clair comme sombre puisque le bandeau est toujours « nuit ».
 */

const STREETS = [
  "M-10 90 L400 60",
  "M-10 150 L400 128",
  "M-10 205 L400 190",
  "M40 0 L70 330",
  "M120 0 L135 320",
  "M205 0 L210 300",
  "M290 0 L280 300",
  "M0 250 Q120 236 250 250",
] as const;

const NEIGHBORHOODS = [
  { name: "Libération", left: 38, top: 21 },
  { name: "Carré d’or", left: 18, top: 46 },
  { name: "Vieux-Nice", left: 60, top: 57 },
  { name: "Port", left: 86, top: 46 },
] as const;

const QUIET_DOTS = [
  { left: 46, top: 39 },
  { left: 28, top: 30 },
  { left: 67, top: 35 },
  { left: 8, top: 61 },
] as const;

const HALO_SHADOW =
  "0 0 0 6px color-mix(in srgb, var(--nightaccent) 18%, transparent), 0 0 22px color-mix(in srgb, var(--nightaccent) 70%, transparent)";

export default function NiceMap() {
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[390/430] w-full overflow-hidden lg:aspect-auto lg:h-[520px] lg:rounded-[28px]"
    >
      <svg
        viewBox="0 0 390 430"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <rect width="390" height="430" fill="var(--night2)" />
        <g stroke="var(--street)" strokeWidth={1.2} fill="none">
          {STREETS.map((d) => (
            <path key={d} d={d} />
          ))}
        </g>
        <path
          d="M150 0 L170 120 L230 140"
          stroke="var(--boulevard)"
          strokeWidth={5}
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M-10 330 Q120 300 250 296 Q285 296 298 278 L312 262 L330 300 Q360 318 400 312 L400 430 L-10 430 Z"
          fill="var(--sea)"
        />
        <path
          d="M-10 330 Q120 300 250 296 Q285 296 298 278"
          stroke="var(--nightaccent)"
          strokeOpacity={0.35}
          strokeWidth={2}
          fill="none"
        />
        <ellipse cx={300} cy={244} rx={26} ry={18} fill="var(--park)" />
        <path d="M318 232 L346 236 L344 286 L322 282 Z" fill="var(--sea)" />
      </svg>

      {/* Libellés de lieux */}
      <span
        className="absolute text-[11px] tracking-[0.2em] uppercase"
        style={{ left: "6%", top: "86%", color: "var(--sealabel)" }}
      >
        Baie des Anges
      </span>
      <span
        className="absolute text-[10px] tracking-[0.2em] uppercase text-ds-onnight2/70"
        style={{ left: "71%", top: "49%" }}
      >
        Château
      </span>

      {/* Quartiers avec café Dropspot */}
      {NEIGHBORHOODS.map(({ name, left, top }, index) => (
        <span
          key={name}
          className="absolute"
          style={{ left: `${left}%`, top: `${top}%` }}
        >
          <span className="absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2">
            <span
              className="absolute inset-0 rounded-full motion-safe:animate-pulse-glow"
              style={{
                boxShadow: HALO_SHADOW,
                animationDelay: `${index * 0.4}s`,
              }}
            />
            <span className="absolute inset-0 rounded-full bg-ds-nightaccent" />
          </span>
          <span className="absolute top-[13px] left-0 -translate-x-1/2 text-[11px] font-semibold whitespace-nowrap text-ds-onnight2">
            {name}
          </span>
        </span>
      ))}

      {/* Points plus discrets, sans nom */}
      {QUIET_DOTS.map(({ left, top }) => (
        <span
          key={`${left}-${top}`}
          className="absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ds-nightaccent/75"
          style={{ left: `${left}%`, top: `${top}%` }}
        />
      ))}

      {/* Pastille d'appel à l'action, fixe */}
      <span
        className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border-[1.5px] border-dashed border-ds-nightaccenttext px-3 py-1.5 text-[13px] font-bold whitespace-nowrap text-ds-nightaccenttext"
        style={{
          left: "48%",
          top: "11%",
          backgroundColor:
            "color-mix(in srgb, var(--night) 85%, transparent)",
        }}
      >
        <span className="block h-5 w-5 rounded-full border-[1.5px] border-dashed border-ds-nightaccenttext" />
        Votre café&nbsp;?
      </span>
    </div>
  );
}
