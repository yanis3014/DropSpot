/** Full-width B2B shell: no BottomNav, no PWA install banners, no max-w-md. */
export default function VitrineLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-full bg-ds-bg text-ds-text">{children}</div>
  );
}
