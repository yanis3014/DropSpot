'use client';

import type { ReactNode } from 'react';

interface StepLayoutProps {
  header?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}

/** Full-height step: fixed header, scrolling content, actions pinned at the bottom. */
export default function StepLayout({ header, footer, children }: StepLayoutProps) {
  return (
    <div className="mx-auto flex h-full w-full max-w-md flex-1 flex-col overflow-hidden px-5 pb-6 pt-4">
      {header}
      <div className="animate-step flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-hide pb-4">
        {children}
      </div>
      <div className="flex shrink-0 flex-col gap-1 pt-2">{footer}</div>
    </div>
  );
}

export function StepTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
      <h1 className="font-display text-[28px] font-extrabold leading-tight text-ds-text">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 text-[15px] leading-relaxed text-ds-text2">{subtitle}</p>
      ) : null}
    </div>
  );
}

/** Low-emphasis text action under the main button. */
export function GhostAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-11 w-full text-sm font-bold text-ds-accenttext hover:underline"
    >
      {children}
    </button>
  );
}
