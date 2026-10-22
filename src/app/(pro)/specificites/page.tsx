'use client';

import { Suspense } from 'react';
import SpecificitesClient from '@/app/(pro)/specificites/SpecificitesClient';

function SpecificitesFallback() {
  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
    </div>
  );
}

export default function SpecificitesPage() {
  return (
    <Suspense fallback={<SpecificitesFallback />}>
      <SpecificitesClient />
    </Suspense>
  );
}
