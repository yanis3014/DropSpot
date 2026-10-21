interface LogoMarkProps {
  className?: string;
  /** Accessible name; omit when the mark sits next to visible "dropspot" text. */
  title?: string;
}

/**
 * Grain-repère: a map pin whose head is a coffee bean.
 * The pin and the bean slit use currentColor; the bean stays cream.
 */
export default function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <path
        d="M32 61C26.5 52.5 11 40.5 11 26A21 21 0 0 1 53 26C53 40.5 37.5 52.5 32 61Z"
        fill="currentColor"
      />
      <g transform="rotate(28 32 26)">
        <ellipse cx="32" cy="26" rx="10.5" ry="14" fill="#FAF7F2" />
        <path
          d="M32 15C28.2 21 35.8 31 32 37"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
