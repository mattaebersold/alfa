import React, { useMemo, useRef } from 'react';
import { COLOR_GRAY_26 } from '../../constants/config';
import { View, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import MarketplaceBrowse from '../../components/marketplace/MarketplaceBrowse';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll, headerBottom } from '../../hooks/useHeaderScroll';
import { ss } from '../../styles/shared';
import type { Listing } from '../../types/api';

/** The marketplace's ground — see the screen's note. */
const MARKET_GROUND = COLOR_GRAY_26;

/**
 * The marketplace tab.
 *
 * The browse itself — for sale, want ads, the filter row and the cards — is
 * MarketplaceBrowse, which a group's Market section renders too with a
 * `groupId`. This screen is the chrome around it: the app header, the heading,
 * and the padding that keeps the list clear of both.
 */
export default function MarketplaceScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<Listing>>(null);
  useScrollTopOnBack(scrollRef);
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const insets = useSafeAreaInsets();
  // Clears the floating tab bar (matching MainTabNavigator's height) without
  // useBottomTabBarHeight, which throws if the screen renders outside the tabs.
  const tabBarHeight = 88 + insets.bottom;
  const stickyTop = useMemo(() => headerBottom(headerPad, insets.top), [headerPad, insets.top]);

  return (
    // A step lighter than the app's black, so the sub tabs' dark tracks have
    // an edge against it — the listing cards are lighter still.
    <SafeAreaView style={[ss.fill, { backgroundColor: MARKET_GROUND }]} edges={[]}>
      <AppHeader />
      <View style={[ss.fill, { backgroundColor: MARKET_GROUND }]}>
        <MarketplaceBrowse
          ground={MARKET_GROUND}
          heading="Marketplace"
          listRef={scrollRef}
          onScroll={onScroll}
          contentContainerStyle={{ paddingTop: headerPad, paddingBottom: tabBarHeight + 32 }}
          // The switch and search pin under the header, following it as it hides.
          stickyTop={stickyTop}
        />
      </View>
    </SafeAreaView>
  );
}
