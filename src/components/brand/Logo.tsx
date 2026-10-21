import LogoMark from './LogoMark';

interface LogoProps {
  className?: string;
}

/** Horizontal lockup: mark + "dropspot" wordmark. Sized by font-size. */
export default function Logo({ className = '' }: LogoProps) {
  return (
    <span
      className={`inline-flex items-center gap-[0.3em] font-display font-extrabold leading-none tracking-[-0.04em] ${className}`}
    >
      <LogoMark className="h-[1.25em] w-[1.25em] shrink-0 text-ds-accent" />
      <span>dropspot</span>
    </span>
  );
}
