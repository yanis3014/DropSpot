/** Placeholder page body until the real planche is implemented. */
export default function ProPageStub({
  title,
  description = "Contenu à venir.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 flex-col px-4 py-6 lg:px-8 lg:py-8">
      <h1 className="font-display text-[28px] font-extrabold tracking-tight text-ds-text lg:text-[26px]">
        {title}
      </h1>
      <p className="mt-1 text-sm text-ds-text2">{description}</p>
    </div>
  );
}
