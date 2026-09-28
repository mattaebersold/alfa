import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Easing, type FlatList, type ScrollView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FeedList from '../../components/feed/FeedList';
import StoriesRow from '../../components/stories/StoriesRow';
import SuggestedMembersRow from '../../components/feed/SuggestedMembersRow';
import SuggestedCarsRow from '../../components/feed/SuggestedCarsRow';
// import HomeFeatureBanner from '../../components/feed/HomeFeatureBanner';
import HideSuggestionsDialog from '../../components/feed/HideSuggestionsDialog';
import { useFeedPreferences, type SuggestionRow } from '../../hooks/useFeedPreferences';
import AppHeader, { useHeaderPad, type HeaderTab } from '../../components/ui/AppHeader';
import { FAB_BOTTOM, FAB_RIGHT } from '../../components/ui/CreateFab';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll, showHeader } from '../../hooks/useHeaderScroll';
import { EventsView } from '../../components/society/EventsView';
import MarketplaceBrowse from '../../components/marketplace/MarketplaceBrowse';
import { GroupsView } from '../groups/GroupsScreen';
import { PhotographyScreen as KitPhotographyScreen } from '@ors/kit/src/photography';
import { useGetPhotoSpotQuery } from '@ors/kit';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { Listing } from '../../types/api';
import { useGetBlockedUsersQuery } from '../../api/apiService';
import { useAppDispatch } from '../../store/store';
import { setBlockedUsers } from '../../store/moderationSlice';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import type { AppStackParamList, FeedStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { GUTTER } from '../../constants/config';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const FEED_TABS: HeaderTab[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'events', label: 'Events' },
  { key: 'market', label: 'Marketplace' },
  { key: 'groups', label: 'Groups' },
  { key: 'photography', label: 'Photography' },
  { key: 'cars', label: 'Cars' },
  { key: 'members', label: 'Members' },
];
type FeedTab = 'feed' | 'events' | 'market' | 'groups' | 'photography';
/** How far below its place an arriving tab's content starts, in points. */
const TAB_ENTER_RISE = 60;

/** Taken off the header's clearance on the Feed tab, to tuck its first item up under the tabs. */
const FEED_TOP_TRIM = 8;

function FeedHeader() {
  const colors = useColors();
  const isPro = useIsPro();
  const { isRowHidden, hideRow } = useFeedPreferences();
  // One dialog, told which row's ✕ opened it — closing a row closes that row
  // and leaves the other where it is.
  const [hiding, setHiding] = useState<SuggestionRow | null>(null);

  return (
    <View>
      {/* {isPro && <StoriesRow />} */}
      {/* Feature banner parked for now — <HomeFeatureBanner /> */}
      {!isRowHidden('members') && <SuggestedMembersRow onRequestHide={() => setHiding('members')} />}
      {!isRowHidden('cars') && <SuggestedCarsRow onRequestHide={() => setHiding('cars')} />}
      <HideSuggestionsDialog
        visible={hiding !== null}
        rowTitle={hiding === 'cars' ? 'Suggested Cars' : 'Suggested Members'}
        onClose={() => setHiding(null)}
        onChoose={(mode) => hiding && hideRow(hiding, mode)}
      />
    </View>
  );
}

export default function FeedScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<FlatList<any>>(null);
  useScrollTopOnBack(scrollRef);
  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const headerPad = useHeaderPad({ tabs: true });
  // One per pane: each tracks its own last position, so switching tabs doesn't
  // read the jump between two lists' offsets as a scroll.
  const onScroll = useHeaderScroll(headerPad);
  const onEventsScroll = useHeaderScroll(headerPad);
  const onMarketScroll = useHeaderScroll(headerPad);
  const onGroupsScroll = useHeaderScroll(headerPad);
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  /**
   * Which tab's content is showing. The tabs swap what's under the header
   * rather than navigating — Events, Marketplace and Groups here are those sections'
   * own views, not pushes to other screens.
   *
   * A pane is mounted the first time its tab is picked and then kept, hidden,
   * so going back to one finds it where you left it rather than reloaded at
   * the top — but a tap on a tab takes it back to its top (see selectTab).
   */
  const [tab, setTab] = useState<FeedTab>('feed');
  const [mounted, setMounted] = useState<ReadonlySet<FeedTab>>(() => new Set<FeedTab>(['feed']));
  /**
   * The pane arriving on a switch starts invisible and TAB_ENTER_RISE points
   * low, then fades up and rises into place. Only the incoming pane moves —
   * the outgoing one is simply hidden, so the two never overlap mid-change.
   *
   * One value per pane, bound to its view for good rather than attached on
   * arrival: a native animation started before its view is connected skips
   * the start and shows the pane already in place. For the same reason the
   * run starts after the switch has rendered, not in the tap handler.
   */
  const enter = useRef<Record<FeedTab, Animated.Value>>({
    feed: new Animated.Value(1),
    events: new Animated.Value(1),
    market: new Animated.Value(1),
    groups: new Animated.Value(1),
    photography: new Animated.Value(1),
  }).current;
  const paneStyle = (pane: FeedTab) => [
    styles.content,
    { backgroundColor: colors.cream },
    {
      opacity: enter[pane],
      transform: [{ translateY: enter[pane].interpolate({ inputRange: [0, 1], outputRange: [TAB_ENTER_RISE, 0] }) }],
    },
    tab !== pane && styles.hidden,
  ];
  const switched = useRef(false);
  useEffect(() => {
    if (!switched.current) return;
    // Now it's showing: a hidden list can ignore a scroll on Android.
    scrollToTop(tab);
    Animated.timing(enter[tab], {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, enter]);
  /** A pane back to its first item. One that's never been opened has no list yet — it'll start there anyway. */
  const scrollToTop = (pane: FeedTab) => {
    if (pane === 'events') eventsScrollRef.current?.scrollTo({ y: 0, animated: false });
    else if (pane === 'market') marketScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'groups') groupsScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    // The photography map doesn't scroll — nothing to reset.
    else if (pane === 'photography') return;
    else scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
  };

  /**
   * Picking a tab starts it fresh: at its top, with the header back in view —
   * a tab is a new place, not a continuation of wherever the last one was
   * scrolled. Picking the tab you're already on does the same, the usual
   * tap-to-top.
   */
  const selectTab = (key: string) => {
    // Cars and Members aren't panes here — they're links to their own pages.
    if (key === 'cars') {
      (navigation as any).navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Cars' } });
      return;
    }
    if (key === 'members') {
      (navigation as any).navigate('Members');
      return;
    }
    const next = key as FeedTab;
    // Slid back, not snapped — it's coming from wherever the last tab left it.
    showHeader();
    if (next === tab) {
      scrollToTop(next);
      return;
    }
    // Parked at the start while still hidden, so it's there when it shows.
    enter[next].setValue(0);
    switched.current = true;
    if (!mounted.has(next)) setMounted((m) => new Set(m).add(next));
    setTab(next);
  };

  /**
   * Arriving with a tab asked for — the menu's Events, Marketplace or Groups: that
   * tab, at its top, header showing. Keyed on `at` so asking again for the
   * tab you're already on still takes you back up it.
   */
  const route = useRoute<RouteProp<FeedStackParamList, 'Feed'>>();
  /**
   * The photography map's `focus`: where to move and which spot's summary to
   * open. A spot arrives as an id, and the map needs its coordinates, so it's
   * looked up first; the focus is a new object per spot, which is what tells
   * the map to move.
   */
  const [focusSpotId, setFocusSpotId] = useState<string | null>(null);
  const { data: focusSpot } = useGetPhotoSpotQuery(focusSpotId ?? '', { skip: !focusSpotId });
  const photoFocus = useMemo(
    () => (focusSpot && focusSpotId ? { lat: focusSpot.lat, lng: focusSpot.lng, spotId: focusSpotId } : null),
    [focusSpot, focusSpotId],
  );
  const tabBarHeight = useBottomTabBarHeight();
  const eventsScrollRef = useRef<ScrollView>(null);
  const marketScrollRef = useRef<FlatList<Listing>>(null);
  const groupsScrollRef = useRef<FlatList<any>>(null);
  useEffect(() => {
    const asked = route.params?.tab;
    if (!asked) return;
    selectTab(asked);
    // A photo spot to open on the map — a notification about one.
    if (asked === 'photography' && route.params?.spotId) setFocusSpotId(route.params.spotId);
    // Spent. Left in the params it would be saved with the navigation state
    // (see navPersistence) and replayed on the next launch — a reload after
    // the menu's Events would open on Events rather than on the feed.
    navigation.setParams({ tab: undefined, at: undefined, spotId: undefined } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.at]);

  // Keep the client-side blocked-users list in sync so blocked authors'
  // content stays hidden across sessions (Apple UGC requirement).
  const { data: blockedData } = useGetBlockedUsersQuery();
  useEffect(() => {
    if (blockedData?.entries) {
      dispatch(setBlockedUsers(blockedData.entries.map((u) => u.user_id).filter(Boolean)));
    }
  }, [blockedData, dispatch]);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={[]}>
      <AppHeader tabs={FEED_TABS} activeTab={tab} onTabPress={selectTab} />
      <Animated.View style={paneStyle('feed')}>
        {/* No `onPostPress`: a tap on a card opens its own text in place rather
            than pushing the post's own screen. The card carries everything
            that screen showed — the full body, the comment thread behind the
            comment button, a summary panel for whoever liked it — so the push
            only ever arrived at the same content one level deeper. */}
        <FeedList
          listRef={scrollRef}
          excludeTypes={['story']}
          includeGarageAdditions
          ListHeaderComponent={FeedHeader}
          paddingTop={headerPad - FEED_TOP_TRIM}
          // Only the showing pane moves the header: a list still coasting when
          // you switch away keeps sending scrolls, and they'd hide the header
          // again just after the tap brought it back.
          onScroll={tab === 'feed' ? onScroll : undefined}
        />
      </Animated.View>
      {mounted.has('events') && (
        <Animated.View style={paneStyle('events')}>
          <EventsView headerPad={headerPad} onScroll={tab === 'events' ? onEventsScroll : undefined} scrollRef={eventsScrollRef} />
        </Animated.View>
      )}
      {mounted.has('market') && (
        <Animated.View style={paneStyle('market')}>
          {/* The same browse the group Market sections use. The bottom pad
              clears the floating tab bar, as the Marketplace screen's did. */}
          <MarketplaceBrowse
            listRef={marketScrollRef}
            onScroll={tab === 'market' ? onMarketScroll : undefined}
            contentContainerStyle={{ paddingTop: headerPad, paddingBottom: 88 + insets.bottom + 32 }}
          />
        </Animated.View>
      )}
      {mounted.has('groups') && (
        <Animated.View style={paneStyle('groups')}>
          <GroupsView headerPad={headerPad} onScroll={tab === 'groups' ? onGroupsScroll : undefined} scrollRef={groupsScrollRef} />
        </Animated.View>
      )}
      {mounted.has('photography') && (
        <Animated.View style={paneStyle('photography')}>
          {/* @ors/kit's map, shared with the photo app (see its README). The
              header floats over the top, so the kit's `header` slot is just
              the space it takes. A map doesn't scroll, so the header stays
              put here rather than hiding. */}
          <KitPhotographyScreen
            header={<View style={{ height: headerPad }} />}
            safeTop={false}
            // The header's tab already says "Photography" — a line on what
            // the map is for, instead of the heading repeating it.
            intro="Find where other members take their photos, or add your own"
            gutter={GUTTER}
            bottomInset={tabBarHeight}
            // Down at the bottom, mirroring the corner buttons on the right —
            // the tab bar is an invisible strip, so the space above it is
            // just map.
            zoomPosition={{ bottom: insets.bottom + FAB_BOTTOM, left: FAB_RIGHT }}
            focus={photoFocus}
            onDropPin={(point) => (navigation as any).navigate('PhotoSpotCreate', {
              lat: point.lat, lng: point.lng, name: point.name, address: point.address,
            })}
            onEditSpot={(spotId) => (navigation as any).navigate('PhotoSpotCreate', { spotId })}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  // A pane whose tab isn't showing: still mounted, so it keeps its place.
  hidden: { display: 'none' },
});
