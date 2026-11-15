import type { SectionSub } from './types';
import { EVENTS_SUBS } from './events';
import { MARKET_SUBS } from './market';
import { GROUPS_SUBS } from './groups';
import { PHOTOGRAPHY_SUBS, CARS_SUBS, MEMBERS_SUBS } from './more';
import { PRO_SUBS } from './pro';

/**
 * Each home section's sub-screens, in header order after the section's own
 * tab. One file per section, so each can grow on its own. A section with none
 * shows just [home] [section].
 */
export const SECTION_SUBS: Record<string, SectionSub[]> = {
  // Pro members only — FeedScreen leaves PRO's row off for everyone else.
  pro: PRO_SUBS,
  events: EVENTS_SUBS,
  market: MARKET_SUBS,
  groups: GROUPS_SUBS,
  photography: PHOTOGRAPHY_SUBS,
  cars: CARS_SUBS,
  members: MEMBERS_SUBS,
};

export type { SectionSub, SectionScreenProps } from './types';
