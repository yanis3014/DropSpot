import {
  PLACE_MEDIA_TABS,
  type PlaceMedia,
  type PlaceMediaCategory,
} from '@/lib/api/placeMedia';

export interface GalleryPhoto {
  url: string;
  category: PlaceMediaCategory;
}

export interface GallerySection {
  category: PlaceMediaCategory;
  label: string;
  /** Index of the section's first photo in the flat gallery. */
  firstIndex: number;
  count: number;
}

export interface PlaceGallery {
  photos: GalleryPhoto[];
  sections: GallerySection[];
}

/**
 * Flat, ordered gallery for the place page carousel:
 * Le lieu → À la carte → Le menu, then the legacy cover (`places.image_url`)
 * first in "Le lieu" when it is not already one of the uploaded photos.
 */
export function buildPlaceGallery(
  media: PlaceMedia[],
  coverUrl?: string | null
): PlaceGallery {
  const seen = new Set<string>();
  const photos: GalleryPhoto[] = [];
  const sections: GallerySection[] = [];

  const cover = coverUrl?.trim();
  const coverInMedia = !!cover && media.some((m) => m.url === cover);

  for (const tab of PLACE_MEDIA_TABS) {
    const firstIndex = photos.length;
    if (tab.category === 'venue' && cover && !coverInMedia) {
      seen.add(cover);
      photos.push({ url: cover, category: 'venue' });
    }
    const items = media
      .filter((m) => m.category === tab.category)
      .sort((a, b) => a.sort_order - b.sort_order);
    for (const item of items) {
      if (!item.url || seen.has(item.url)) continue;
      seen.add(item.url);
      photos.push({ url: item.url, category: tab.category });
    }
    const count = photos.length - firstIndex;
    if (count > 0) {
      sections.push({
        category: tab.category,
        label: tab.label,
        firstIndex,
        count,
      });
    }
  }

  return { photos, sections };
}

export function sectionForIndex(
  gallery: PlaceGallery,
  index: number
): GallerySection | undefined {
  return gallery.sections.find(
    (s) => index >= s.firstIndex && index < s.firstIndex + s.count
  );
}
