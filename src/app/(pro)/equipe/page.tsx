'use client';

import { Suspense } from 'react';
import EquipeClient from '@/app/(pro)/equipe/EquipeClient';

function EquipeFallback() {
  return (
    <div className="flex min-h-[40vh] flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
    </div>
  );
}

export default function EquipePage() {
  return (
    <Suspense fallback={<EquipeFallback />}>
      <EquipeClient />
    </Suspense>
  );
}
