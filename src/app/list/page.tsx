import { Suspense } from "react";
import NearbyList from "@/components/list/NearbyList";

function ListFallback() {
  return (
    <main className="flex flex-1 flex-col bg-ds-bg px-5 pb-28 pt-8">
      <h1 className="font-display text-[34px] font-extrabold leading-tight text-ds-text">
        À proximité
      </h1>
      <p className="mt-6 text-sm text-ds-text2">Chargement…</p>
    </main>
  );
}

export default function ListPage() {
  return (
    <Suspense fallback={<ListFallback />}>
      <NearbyList />
    </Suspense>
  );
}
