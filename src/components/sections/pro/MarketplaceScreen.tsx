import React, { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MarketplaceBrowse from '../../marketplace/MarketplaceBrowse';
import { TABS_STUCK_RISE } from '../../ui/AppHeader';
import { headerBottom } from '../../../hooks/useHeaderScroll';
import type { SectionScreenProps } from '../types';
import ProSubTabs from '../ProSubTabs';

/**
 * PRO › Marketplace — the marketplace lives under PRO now, not in the
 * header's main row or the menu. The whole browse in one pane: its own
 * For sale / Want ads switch, and the "Your Listings" card that leads to
 * managing yours. Hosted as the market's own sub-screens are
 * (sections/market/MarketBrowseScreens): clear of the floating header, the
 * search pinned under its live bottom edge.
 */
export default function MarketplaceScreen({ headerPad, onScroll, bottomPad }: SectionScreenProps) {
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
      onScroll={onScroll}
      contentContainerStyle={contentStyle}
      stickyTop={stickyTop}
      // PRO's options, scrolling away with the page.
      top={<ProSubTabs />}
    />
  );
}
