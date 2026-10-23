import {
  CalendarBlank,
  Coffee,
  Cookie,
  Laptop,
  Leaf,
  Moon,
  Plugs,
  SunDim,
  WifiHigh,
  type Icon,
} from '@phosphor-icons/react';
import type { SpecId } from '@/lib/specs';

export const SPEC_ICONS: Record<SpecId, Icon> = {
  wifi: WifiHigh,
  plugs: Plugs,
  calm: Moon,
  laptop: Laptop,
  terrace: SunDim,
  matcha: Leaf,
  specialty: Coffee,
  brunch: Cookie,
  events: CalendarBlank,
};
