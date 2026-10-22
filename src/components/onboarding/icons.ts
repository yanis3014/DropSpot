import {
  CalendarStar,
  Coffee,
  CoffeeBean,
  ForkKnife,
  Laptop,
  Leaf,
  Moon,
  PersonSimpleRun,
  Plug,
  Sun,
  UsersThree,
  WifiHigh,
  type Icon,
} from '@phosphor-icons/react';
import type { EnvieId, NeedId } from '@/lib/onboarding';

export const ENVIE_ICONS: Record<EnvieId, Icon> = {
  work: Laptop,
  chill: Coffee,
  friends: UsersThree,
  brunch: ForkKnife,
  specialty: CoffeeBean,
  matcha: Leaf,
  terrace: Sun,
  sport: PersonSimpleRun,
  events: CalendarStar,
};

export const NEED_ICONS: Record<NeedId, Icon> = {
  wifi: WifiHigh,
  plugs: Plug,
  calm: Moon,
  laptop: Laptop,
  terrace: Sun,
  matcha: Leaf,
};
