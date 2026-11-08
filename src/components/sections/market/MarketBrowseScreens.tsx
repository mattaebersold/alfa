import React, { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MarketplaceBrowse from '../../marketplace/MarketplaceBrowse';
import { TABS_STUCK_RISE } from '../../ui/AppHeader';
import { headerBottom } from '../../../hooks/useHeaderScroll';
import type { ListingKind } from '../../../types/api';
import type { SectionScreenProps } from '../types';

/**
 * One half of the market as a screen of its own — the landing's browse, fixed
 * to for sale or wanted. Hosted the way FeedScreen hosts the landing: the list
 * clears the floating header, and the search pins under the header's live
 * bottom edge as it hides.
 *
 * No "Your Listings" card: My Listings is the tab beside this one.
 */
function KindBrowse({ kind, headerPad, onScroll, bottomPad }: SectionScreenProps & { kind: ListingKind }) {
  const insets = useSafeAreaInsets();
  const contentStyle = useMemo(
    () => ({ paddingTop: headerPad, paddingBottom: bottomPad }),
    [headerPad, bottomPad],
  );
  const stickyTop = useMemo(
    () => headerBottom(headerPad, insets.top, TABS_STUCK_RISE),
    [headerPad, insets.top],
  );

  return (
    <MarketplaceBrowse
      lockKind={kind}
      hideManageEntry
      onScroll={onScroll}
      contentContainerStyle={contentStyle}
      stickyTop={stickyTop}
    />
  );
}

/** Marketplace › Listings — what's for sale. */
export function ListingsScreen(props: SectionScreenProps) {
  return <KindBrowse kind="sale" {...props} />;
}

/** Marketplace › Want Ads — what people are looking for. */
export function WantAdsScreen(props: SectionScreenProps) {
  return <KindBrowse kind="want" {...props} />;
}
