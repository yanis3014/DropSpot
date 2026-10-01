'use client';

import Link from 'next/link';
import { ArrowRight } from '@phosphor-icons/react';

/** Ultra-minimal carousel end-card linking to /drops. */
export default function SeeMoreDropsCard() {
  return (
    <Link
      href="/drops"
      className="group flex h-[158px] w-[140px] flex-shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-2xl border border-brand-mocha/10 bg-brand-muted/40 transition-colors hover:border-brand-mocha/20 hover:bg-brand-muted/70 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-matcha/40 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-oat"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-brand-mocha/20 text-brand-espresso transition-transform duration-300 group-hover:translate-x-0.5 group-hover:border-brand-mocha/35">
        <ArrowRight size={18} weight="regular" />
      </span>
      <span className="text-sm font-semibold tracking-tight text-brand-espresso">
        Voir tout
      </span>
    </Link>
  );
}
