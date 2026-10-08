import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, Animated, Easing, InteractionManager, type FlatList, type ScrollView } from 'react-native';
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
import AppHeader, { useHeaderPad, TABS_STUCK_RISE, type HeaderTab } from '../../components/ui/AppHeader';
import { FAB_BOTTOM, FAB_RIGHT } from '../../components/ui/CreateFab';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll, showHeader, headerBottom } from '../../hooks/useHeaderScroll';
import { EventsView } from '../../components/society/EventsView';
import MarketplaceBrowse from '../../components/marketplace/MarketplaceBrowse';
import { GroupsView } from '../groups/GroupsScreen';
import { CarsView } from '../cars/CarsScreen';
import { MembersView } from '../society/MembersScreen';
import { Home, Calendar, ShoppingBag, Users, Camera, Car, User } from 'lucide-react-native';
import { PhotographyScreen as KitPhotographyScreen } from '@ors/kit/src/photography';
import { useGetPhotoSpotQuery } from '@ors/kit';
import SpotActions from '../../components/photography/SpotActions';
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
import { recordFeedTab } from '../../utils/screenViews';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const FEED_TABS: HeaderTab[] = [
  { key: 'feed',        label: 'Feed',        Icon: Home },
  { key: 'events',      label: 'Events',      Icon: Calendar },
  { key: 'market',      label: 'Marketplace', Icon: ShoppingBag },
  { key: 'groups',      label: 'Groups',      Icon: Users },
  { key: 'photography', label: 'Photography', Icon: Camera },
  { key: 'cars',        label: 'Cars',        Icon: Car },
  { key: 'members',     label: 'Members',     Icon: User },
];
type FeedTab = 'feed' | 'events' | 'market' | 'groups' | 'photography' | 'cars' | 'members';
/** How far below its place an arriving tab's content starts, in points. */
const TAB_ENTER_RISE = 16;

/** Taken off the header's clearance on the Feed tab, to tuck its first item up under the tabs. */
const FEED_TOP_TRIM = 8;

/**
 * The panes, memoised: a tab switch re-renders this screen, and without
 * this it re-rendered every mounted pane with it — seven lists, a map —
 * for a change that only concerns which one is showing. Their props are
 * kept stable below for the same reason.
 */
const MemoFeedList = React.memo(FeedList);
const MemoEventsView = React.memo(EventsView);
const MemoMarketplaceBrowse = React.memo(MarketplaceBrowse);
const MemoGroupsView = React.memo(GroupsView);
const MemoCarsView = React.memo(CarsView);
const MemoMembersView = React.memo(MembersView);
const MemoPhotography = React.memo(KitPhotographyScreen);
const FEED_EXCLUDE_TYPES = ['story'];

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
  const onCarsScroll = useHeaderScroll(headerPad);
  const onMembersScroll = useHeaderScroll(headerPad);
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
  /** Bumped by the logo on the feed tab — FeedList refreshes on each change. */
  const [feedRefresh, setFeedRefresh] = useState(0);
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
    cars: new Animated.Value(1),
    members: new Animated.Value(1),
  }).current;
  /**
   * Each pane's entry animation, built once. A hidden pane is kept in the
   * native tree at opacity 0 — not `display: 'none'`, which on iOS tears
   * down every native view in the pane (every cell, every image, the whole
   * map) and rebuilds them all on the next tap. That rebuild was the two
   * seconds between a tap on a tab and anything changing.
   */
  const paneAnim = useRef(
    (Object.keys(enter) as FeedTab[]).reduce((acc, pane) => {
      acc[pane] = {
        opacity: enter[pane],
        transform: [{ translateY: enter[pane].interpolate({ inputRange: [0, 1], outputRange: [TAB_ENTER_RISE, 0] }) }],
      };
      return acc;
    }, {} as Record<FeedTab, { opacity: Animated.Value; transform: { translateY: Animated.AnimatedInterpolation<number> }[] }>),
  ).current;
  const paneBg = useMemo(() => ({ backgroundColor: colors.cream }), [colors.cream]);
  /** The showing pane's wrapper, and a hidden one's. */
  const paneShown = useMemo(() => [styles.pane, paneBg], [paneBg]);
  const paneHidden = useMemo(() => [styles.pane, paneBg, styles.hidden], [paneBg]);
  /** Which tab is showing, readable from a handler without re-creating it. */
  const tabRef = useRef(tab);
  tabRef.current = tab;
  const switched = useRef(false);
  useEffect(() => {
    if (!switched.current) return;
    // Now it's showing: a hidden list can ignore a scroll on Android.
    scrollToTop(tab);
    Animated.timing(enter[tab], {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, enter]);
  /**
   * The panes a tap is likeliest to ask for, mounted while nothing else is
   * going on. A pane's first visit used to mount the whole thing on the tap
   * — the marketplace, the groups list — and the fade couldn't start until
   * that was done, so the first tap on each tab was the slow one.
   */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const task = InteractionManager.runAfterInteractions(() => {
      timer = setTimeout(() => {
        setMounted((m) => {
          if (m.has('events') && m.has('market') && m.has('groups')) return m;
          return new Set([...m, 'events', 'market', 'groups']);
        });
      }, 1500);
    });
    return () => { task.cancel(); if (timer) clearTimeout(timer); };
  }, []);
  /** A pane back to its first item. One that's never been opened has no list yet — it'll start there anyway. */
  const scrollToTop = (pane: FeedTab) => {
    if (pane === 'events') eventsScrollRef.current?.scrollTo({ y: 0, animated: false });
    else if (pane === 'market') marketScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'groups') groupsScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'cars') carsScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'members') membersScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
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
    recordFeedTab(next);
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
  /**
   * Only the showing pane moves the header: a list still coasting when you
   * switch away keeps sending scrolls, and they'd hide the header again just
   * after the tap brought it back. Gated inside a stable handler rather than
   * by swapping the prop, so a switch doesn't re-render every list.
   */
  type ScrollHandler = (e: any) => void;
  const gated = useMemo(() => {
    const gate = (pane: FeedTab, fn: ScrollHandler): ScrollHandler => (e) => { if (tabRef.current === pane) fn(e); };
    return {
      feed: gate('feed', onScroll), events: gate('events', onEventsScroll), market: gate('market', onMarketScroll),
      groups: gate('groups', onGroupsScroll), cars: gate('cars', onCarsScroll), members: gate('members', onMembersScroll),
    };
  }, [onScroll, onEventsScroll, onMarketScroll, onGroupsScroll, onCarsScroll, onMembersScroll]);
  const marketContentStyle = useMemo(() => ({ paddingTop: headerPad, paddingBottom: 88 + insets.bottom + 32 }), [headerPad, insets.bottom]);
  // The market's switch and search pin under the header, following it as it hides.
  // The tab row stays when the header hides, so the bar stops under it.
  const marketStickyTop = useMemo(() => headerBottom(headerPad, insets.top, TABS_STUCK_RISE), [headerPad, insets.top]);
  const photoHeader = useMemo(() => <View style={{ height: headerPad }} />, [headerPad]);
  const photoZoom = useMemo(() => ({ bottom: insets.bottom + FAB_BOTTOM, left: FAB_RIGHT }), [insets.bottom]);
  const onDropPin = useCallback((point: { lat: number; lng: number; name?: string; address?: string }) => (navigation as any).navigate('PhotoSpotCreate', {
    lat: point.lat, lng: point.lng, name: point.name, address: point.address,
  }), [navigation]);
  const renderSpotActions = useCallback((spotId: string) => <SpotActions spotId={spotId} />, []);
  const onEditSpot = useCallback((spotId: string) => (navigation as any).navigate('PhotoSpotCreate', { spotId }), [navigation]);
  const eventsScrollRef = useRef<ScrollView>(null);
  const marketScrollRef = useRef<FlatList<Listing>>(null);
  const groupsScrollRef = useRef<FlatList<any>>(null);
  const carsScrollRef = useRef<FlatList<any>>(null);
  const membersScrollRef = useRef<FlatList<any>>(null);
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
      <AppHeader
        tabs={FEED_TABS}
        activeTab={tab}
        onTabPress={selectTab}
        // Already home: the logo has nowhere to go, so it does what a pull
        // does — back to the top, header showing, and a fresh page with the
        // spinner turning. On another tab it brings you back to the feed.
        onLogoPress={tab === 'feed' ? () => { selectTab('feed'); setFeedRefresh((n) => n + 1); } : undefined}
      />
      <View style={ss.fill}>
      <View style={tab === 'feed' ? paneShown : paneHidden} pointerEvents={tab === 'feed' ? 'auto' : 'none'}>
      <Animated.View style={[ss.fill, paneAnim.feed]}>
        {/* No `onPostPress`: a tap on a card opens its own text in place rather
            than pushing the post's own screen. The card carries everything
            that screen showed — the full body, the comment thread behind the
            comment button, a summary panel for whoever liked it — so the push
            only ever arrived at the same content one level deeper. */}
        <MemoFeedList
          listRef={scrollRef}
          excludeTypes={FEED_EXCLUDE_TYPES}
          includeGarageAdditions
          ListHeaderComponent={FeedHeader}
          paddingTop={headerPad - FEED_TOP_TRIM}
          onScroll={gated.feed}
          refreshSignal={feedRefresh}
        />
      </Animated.View>
      </View>
      {mounted.has('events') && (
        <View style={tab === 'events' ? paneShown : paneHidden} pointerEvents={tab === 'events' ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.events]}>
          <MemoEventsView headerPad={headerPad} onScroll={gated.events} scrollRef={eventsScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('market') && (
        <View style={tab === 'market' ? paneShown : paneHidden} pointerEvents={tab === 'market' ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.market]}>
          {/* The same browse the group Market sections use. The bottom pad
              clears the floating tab bar, as the Marketplace screen's did. */}
          <MemoMarketplaceBrowse
            listRef={marketScrollRef}
            onScroll={gated.market}
            contentContainerStyle={marketContentStyle}
            stickyTop={marketStickyTop}
          />
        </Animated.View>
        </View>
      )}
      {mounted.has('groups') && (
        <View style={tab === 'groups' ? paneShown : paneHidden} pointerEvents={tab === 'groups' ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.groups]}>
          <MemoGroupsView headerPad={headerPad} onScroll={gated.groups} scrollRef={groupsScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('cars') && (
        <View style={tab === 'cars' ? paneShown : paneHidden} pointerEvents={tab === 'cars' ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.cars]}>
          <MemoCarsView headerPad={headerPad} onScroll={gated.cars} scrollRef={carsScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('members') && (
        <View style={tab === 'members' ? paneShown : paneHidden} pointerEvents={tab === 'members' ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.members]}>
          <MemoMembersView headerPad={headerPad} onScroll={gated.members} scrollRef={membersScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('photography') && (
        <View style={tab === 'photography' ? paneShown : paneHidden} pointerEvents={tab === 'photography' ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.photography]}>
          {/* @ors/kit's map, shared with the photo app (see its README). The
              header floats over the top, so the kit's `header` slot is just
              the space it takes. A map doesn't scroll, so the header stays
              put here rather than hiding. */}
          <MemoPhotography
            header={photoHeader}
            safeTop={false}
            // The header's tab already says "Photography" — a line on what
            // the map is for, instead of the heading repeating it.
            intro="Find where other members take their photos, or add your own"
            gutter={GUTTER}
            bottomInset={tabBarHeight}
            // Down at the bottom, mirroring the corner buttons on the right —
            // the tab bar is an invisible strip, so the space above it is
            // just map.
            zoomPosition={photoZoom}
            focus={photoFocus}
            onDropPin={onDropPin}
            onEditSpot={onEditSpot}
            // A like and the comments, under the spot's photos.
            renderSpotContext={renderSpotActions}
          />
        </Animated.View>
        </View>
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Every pane fills the space under the header; the showing one is on top.
  pane: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // A pane whose tab isn't showing: still in the native tree, so a return to
  // it is a prop change rather than a rebuild. See paneAnim.
  hidden: { opacity: 0 },
});
