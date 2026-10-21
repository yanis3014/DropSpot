import { redirect } from "next/navigation";

/** Legacy URL → `/etablissement`, keeps `?cafe=`. */
export default async function SettingsRedirectPage(
  props: PageProps<"/dashboard-pro/settings">
) {
  const searchParams = await props.searchParams;
  const cafe = searchParams.cafe;
  const cafeId = typeof cafe === "string" ? cafe : Array.isArray(cafe) ? cafe[0] : undefined;
  redirect(
    cafeId ? `/etablissement?cafe=${encodeURIComponent(cafeId)}` : "/etablissement"
  );
}
