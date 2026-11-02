const BARS = [
  { hour: "8 h", height: 62 },
  { hour: "10 h", height: 48 },
  { hour: "12 h", height: 92 },
  { hour: "14 h", height: 40 },
  // Colonne « drop » : barre accent + bloc pointillé, hauteur gérée à part.
  { hour: "15 h", height: null },
  { hour: "17 h", height: 52 },
  { hour: "19 h", height: 70 },
] as const;

const DROP_BAR_HEIGHT = 22;
/** 7 barres × 40 ms + 600 ms : le bloc « drop » fondu une fois les barres montées. */
const DROP_BLOCK_DELAY_MS = 850;

/**
 * « Une journée de café » : le creux de 15 h illustré en CSS pur.
 * Animation au chargement en motion-safe seulement ; l'état final est le
 * rendu par défaut, donc tout est visible sans JS et sans mouvement.
 */
export default function DayCurve() {
  return (
    <section className="py-16 sm:py-20">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
        <div>
          <p className="m-0 text-[12px] font-bold uppercase tracking-[0.16em] text-ds-accenttext">
            L’heure creuse
          </p>
          <h2 className="font-display m-0 mt-3 text-[32px] font-extrabold leading-[1.08] tracking-tight text-balance text-ds-text sm:text-[40px]">
            {"Il est 15 h. Vos tables attendent quelqu’un."}
          </h2>
        </div>

        <div className="w-full max-w-xl rounded-[24px] border border-ds-line bg-ds-surface p-5 sm:p-7">
          <p className="m-0 flex items-baseline justify-between gap-4">
            <span className="font-display text-[17px] font-extrabold text-ds-text">
              Une journée de café
            </span>
            <span className="text-[12px] text-ds-text2">illustration</span>
          </p>

          <div
            role="img"
            aria-label="Illustration : un café se vide vers 15 h ; un drop remplit ce creux."
            className="mt-5"
          >
            <div aria-hidden={true}>
              <div className="grid h-[150px] grid-cols-7 gap-2 sm:h-[180px]">
                {BARS.map((bar, i) => (
                  <div key={bar.hour} className="flex h-full flex-col justify-end">
                    {bar.height !== null ? (
                      <div
                        className="w-full origin-bottom rounded-t-lg bg-ds-line motion-safe:animate-bar-grow motion-reduce:animate-none"
                        style={{
                          height: `${bar.height}%`,
                          animationDelay: `${i * 40}ms`,
                        }}
                      />
                    ) : (
                      <>
                        <div
                          className="flex flex-1 flex-col rounded-t-lg border-2 border-b-0 border-dashed border-ds-accent bg-ds-accentsoft motion-safe:animate-drop-fade motion-reduce:animate-none"
                          style={{ animationDelay: `${DROP_BLOCK_DELAY_MS}ms` }}
                        >
                          <span className="pt-1 text-center text-[11px] font-bold text-ds-accenttext">
                            drop
                          </span>
                        </div>
                        <div
                          className="w-full origin-bottom bg-ds-accent motion-safe:animate-bar-grow motion-reduce:animate-none"
                          style={{
                            height: `${DROP_BAR_HEIGHT}%`,
                            animationDelay: `${i * 40}ms`,
                          }}
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-7 gap-2">
                {BARS.map((bar) => (
                  <span
                    key={bar.hour}
                    className={
                      bar.height === null
                        ? "text-center text-[12px] font-bold tabular-nums text-ds-accenttext"
                        : "text-center text-[12px] tabular-nums text-ds-text2"
                    }
                  >
                    {bar.hour}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <p className="m-0 mt-5 border-t border-ds-line pt-4 text-[15px] leading-relaxed text-ds-text2">
            Un atelier, une dégustation, un run le samedi : publiez-le en deux
            minutes, il apparaît sur la carte quand c’est calme chez vous.
          </p>
        </div>
      </div>
    </section>
  );
}
