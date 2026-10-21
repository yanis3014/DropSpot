import { Suspense } from "react";
import DashboardProDropsClient from "@/app/(pro)/dashboard-pro/components/DashboardProDropsClient";

export default function DashboardProDropsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-ds-accent" />
        </div>
      }
    >
      <DashboardProDropsClient />
    </Suspense>
  );
}
