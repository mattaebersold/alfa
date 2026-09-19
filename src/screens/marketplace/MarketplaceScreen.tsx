import React, { useRef } from 'react';
import { View, FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppHeader, { useHeaderPad } from '../../components/ui/AppHeader';
import MarketplaceBrowse from '../../components/marketplace/MarketplaceBrowse';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll } from '../../hooks/useHeaderScroll';
import { useColors } from '../../hooks/useColors';
import { ss } from '../../styles/shared';
import type { Listing } from '../../types/api';

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
  const colors = useColors();
  const headerPad = useHeaderPad();
  const onScroll = useHeaderScroll(headerPad);
  const insets = useSafeAreaInsets();
  // Clears the floating tab bar (matching MainTabNavigator's height) without
  // useBottomTabBarHeight, which throws if the screen renders outside the tabs.
  const tabBarHeight = 88 + insets.bottom;

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader />
      <View style={[ss.fill, { backgroundColor: colors.cream }]}>
        <MarketplaceBrowse
          heading="Marketplace"
          listRef={scrollRef}
          onScroll={onScroll}
          contentContainerStyle={{ paddingTop: headerPad, paddingBottom: tabBarHeight + 32 }}
        />
      </View>
    </SafeAreaView>
  );
}
