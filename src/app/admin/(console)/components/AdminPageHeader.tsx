/** Title block shared by the console pages. */
export default function AdminPageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[28px] font-extrabold text-ds-text">{title}</h1>
        {subtitle ? <p className="text-sm text-ds-text2">{subtitle}</p> : null}
      </div>
      {children}
    </header>
  );
}
