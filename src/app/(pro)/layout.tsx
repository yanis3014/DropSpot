import ProShell from "@/app/(pro)/components/ProShell";

/** Shared B2B chrome for `/dashboard-pro/*` and French pro routes. */
export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full w-full flex-col bg-ds-bg">
      <ProShell>{children}</ProShell>
    </div>
  );
}
