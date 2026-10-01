import TrophyBadge from '@/components/places/TrophyBadge';
import type { PlaceTrophy } from '@/lib/api/endorsements';

/** @deprecated Prefer TrophyBadge — kept for existing imports. */
export default function EndorsementTrophyBadge({
  trophy,
  size = 'sm',
}: {
  trophy: PlaceTrophy;
  size?: 'sm' | 'md';
}) {
  return <TrophyBadge trophy={trophy} size={size} />;
}
