import { Place } from '@/lib/api/places';

type DirectionsTarget = Pick<Place, 'name' | 'address' | 'city' | 'lat' | 'lng'>;

export function formatAddress(place: Pick<Place, 'address' | 'postal_code' | 'city'>): string {
  const locality = [place.postal_code, place.city].filter(Boolean).join(' ');
  return [place.address, locality].filter(Boolean).join(', ');
}

function isAppleDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  // iPadOS reports itself as "Macintosh" but has touch support
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
  );
}

export function getDirectionsUrl(place: DirectionsTarget): string {
  const query = [place.name, place.address, place.city].filter(Boolean).join(' ');
  const hasCoords = Number.isFinite(place.lat) && Number.isFinite(place.lng);

  if (isAppleDevice()) {
    const params = new URLSearchParams({ q: place.name });
    if (hasCoords) params.set('daddr', `${place.lat},${place.lng}`);
    else params.set('daddr', query);
    return `https://maps.apple.com/?${params.toString()}`;
  }

  const destination = place.address ? query : hasCoords ? `${place.lat},${place.lng}` : query;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function openDirections(place: DirectionsTarget): void {
  window.open(getDirectionsUrl(place), '_blank', 'noopener,noreferrer');
}
