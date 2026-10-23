import AdminShell from "@/app/admin/(console)/AdminShell";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { fetchAdminOverview } from "@/lib/admin/overview";

/** Admin console: admins with their 6-digit code only (checked again in the database). */
export default async function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase } = await requireAdmin();
  const overview = await fetchAdminOverview(supabase);

  return (
    <div className="flex min-h-full w-full flex-col bg-ds-bg">
      <AdminShell
        pendingClaims={overview.pending_claims}
        placesToReview={overview.places_to_review}
      >{children}</AdminShell>
    </div>
  );
}
