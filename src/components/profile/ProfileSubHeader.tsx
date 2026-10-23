import Link from 'next/link';
import { CaretLeft } from '@phosphor-icons/react';

/** Title bar of a profile sub-page, with a way back to the profile summary. */
export default function ProfileSubHeader({ title }: { title: string }) {
  return (
    <div className="flex min-h-11 items-center gap-2.5">
      <Link
        href="/profile"
        aria-label="Retour au profil"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-ds-line bg-ds-surface text-ds-text no-underline"
      >
        <CaretLeft size={20} weight="bold" aria-hidden />
      </Link>
      <h1 className="font-display min-w-0 truncate text-[24px] font-extrabold leading-tight text-ds-text">
        {title}
      </h1>
    </div>
  );
}
