import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, StyleSheet, Animated, Easing, ScrollView, type FlatList } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import FeedList from '../../components/feed/FeedList';
import SpotTodayRow from '../../components/feed/SpotTodayRow';
import LiveAuctionBanner from '../../components/feed/LiveAuctionBanner';
import AppUpdateBanner from '../../components/feed/AppUpdateBanner';
import { onPostUploadEvent } from '../../utils/postUpload';
import StoriesRow from '../../components/stories/StoriesRow';
import SuggestedMembersRow from '../../components/feed/SuggestedMembersRow';
import SuggestedCarsRow from '../../components/feed/SuggestedCarsRow';
import FeedPrefsBanner from '../../components/feed/FeedPrefsBanner';
// import HomeFeatureBanner from '../../components/feed/HomeFeatureBanner';
import HideSuggestionsDialog from '../../components/feed/HideSuggestionsDialog';
import { useFeedPreferences, type SuggestionRow } from '../../hooks/useFeedPreferences';
import AppHeader, { useHeaderPad, TABS_STUCK_RISE, type HeaderTab } from '../../components/ui/AppHeader';
import { useHomeMessageInset, homeMessageCollapse, HOME_MESSAGE_INSET } from '../../components/homeMessages/HomeMessageBanner';
import { FAB_BOTTOM, FAB_RIGHT } from '../../components/ui/CreateFab';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import { useHeaderScroll, showHeader, headerBottom } from '../../hooks/useHeaderScroll';
import { EventsView } from '../../components/society/EventsView';
import MarketplaceBrowse from '../../components/marketplace/MarketplaceBrowse';
import { GroupsView } from '../groups/GroupsScreen';
import { CarsView } from '../cars/CarsScreen';
import { MembersView } from '../society/MembersScreen';
import { Home, Calendar, Users, Camera, Car, User } from 'lucide-react-native';
import { PhotographyScreen } from '../../photography';
import { useGetPhotoSpotQuery } from '../../api/orsApi';
import SpotActions from '../../components/photography/SpotActions';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import type { Listing } from '../../types/api';
import { useGetBlockedUsersQuery } from '../../api/apiService';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { setBlockedUsers } from '../../store/moderationSlice';
import { useColors } from '../../hooks/useColors';
import { useIsPro } from '../../hooks/useBrandColor';
import { useWarmProHome } from '../../hooks/useWarmProHome';
import SteeringWheel from '../../components/ui/SteeringWheel';
import ProPage from '../../components/pro/ProPage';
import ProHomeScreen from '../../components/sections/pro/ProHomeScreen';
import { resumeProVideoUploads } from '../../utils/proVideoUpload';
import { colors } from '../../constants/colors';
import type { AppStackParamList, FeedStackParamList } from '../../navigation/types';
import { ss } from '../../styles/shared';
import { GUTTER } from '../../constants/config';
import { recordFeedTab } from '../../utils/screenViews';
import { SECTION_SUBS, type SectionSub } from '../../components/sections';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/**
 * Sections that show no options row under the main tabs. PRO has one only
 * for Pro members (Home, Videos, Games, Marketplace) — see `subTabs`.
 */
const NO_SUB_TABS: ReadonlySet<FeedTab> = new Set<FeedTab>(['groups']);
/** The sub-tab key for a section's own landing pane. */
const LANDING = '__landing';
/** What each section's landing is called in its row of options. */
const SECTION_LANDING_LABEL: Record<Exclude<FeedTab, 'feed'>, string> = {
  pro: 'Home',
  events: 'Upcoming',
  market: 'Browse',
  groups: 'All Groups',
  photography: 'Map',
  cars: 'Browse',
  members: 'Everyone',
};

/**
 * The header's tab row. Marketplace isn't in it any more, but its section
 * still is: the menu's Marketplace tile opens it here (tab 'market'), with
 * its Listings / Want Ads / My Listings / Watchlist options, and the row
 * shows no tab lit while it's open.
 */
const FEED_TABS: HeaderTab[] = [
  { key: 'feed',        label: 'Feed',        Icon: Home, iconOnly: true },
  // In the Pro red for everyone, with the wheel. Its pane is the Pro pitch
  // (ProPane), or, for a Pro member, Home with its options row (ProHomeScreen).
  { key: 'pro',         label: 'PRO',         Icon: SteeringWheel, color: colors.pro },
  { key: 'events',      label: 'Events',      Icon: Calendar },
  { key: 'groups',      label: 'Groups',      Icon: Users },
  { key: 'cars',        label: 'Cars',        Icon: Car },
  { key: 'members',     label: 'Members',     Icon: User },
  { key: 'photography', label: 'Photography', Icon: Camera },
];
type FeedTab = 'feed' | 'pro' | 'events' | 'market' | 'groups' | 'photography' | 'cars' | 'members';
/** How far below its place an arriving tab's content starts, in points. */
const TAB_ENTER_RISE = 16;

/**
 * Added to the header's clearance on the Feed tab. It used to be taken off, to
 * tuck the first item up under the tabs — but the tab row is tighter now, and
 * tucked, the first card touched them.
 */
const FEED_TOP_GAP = 8;

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
const MemoPhotography = React.memo(PhotographyScreen);
// Car Spotter results live in the "Played Today" row at the top now (see
// SpotTodayRow), today's only — not as cards down the feed.
const FEED_EXCLUDE_TYPES = ['story', 'spot_result'];

function FeedHeader() {
  const colors = useColors();
  const isPro = useIsPro();
  const { isRowHidden, hideRow } = useFeedPreferences();
  // One dialog, told which row's ✕ opened it — closing a row closes that row
  // and leaves the other where it is.
  const [hiding, setHiding] = useState<SuggestionRow | null>(null);

  return (
    // The bottom pad parts the suggestion cards from the first post.
    <View style={styles.feedHeader}>
      {/* The society's own auction while it's live — gone when it ends. */}
      <LiveAuctionBanner />
      {/* The store has a newer build than this one — dismissable for 30 days. */}
      <AppUpdateBanner />
      <SpotTodayRow />
      {/* {isPro && <StoriesRow />} */}
      {/* Feature banner parked for now — <HomeFeatureBanner /> */}
      {!isRowHidden('members') && <SuggestedMembersRow onRequestHide={() => setHiding('members')} />}
      {!isRowHidden('cars') && <SuggestedCarsRow onRequestHide={() => setHiding('cars')} />}
      {/* Last, so it sits right on the first card it governs. */}
      <FeedPrefsBanner />
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
  const headerPad = useHeaderPad({ tabs: true });
  /** A section's panes sit lower: its options open in a row under the tabs. */
  const sectionPad = useHeaderPad({ tabs: true, subTabs: true });
  /** PRO's panes sit lower still: its options are a contained track, taller than a section's. */
  const proPad = useHeaderPad({ tabs: true, proSubTabs: true });
  /**
   * The home message banner's room, when there's one to show: between the
   * header's buttons and its tabs, on the feed only, and only at its top —
   * the feed starts that much lower, and as it scrolls the banner collapses
   * (homeMessageCollapse) and the tabs close up under the buttons.
   */
  const messageInset = useHomeMessageInset();
  // One per pane: each tracks its own last position, so switching tabs doesn't
  // read the jump between two lists' offsets as a scroll.
  const onScroll = useHeaderScroll(headerPad);
  const onEventsScroll = useHeaderScroll(sectionPad);
  const onMarketScroll = useHeaderScroll(sectionPad);
  // Groups has no options row (see NO_SUB_TABS), so its pane sits where the feed's does.
  const onGroupsScroll = useHeaderScroll(headerPad);
  const onCarsScroll = useHeaderScroll(sectionPad);
  const onMembersScroll = useHeaderScroll(sectionPad);
  const onProScroll = useHeaderScroll(proPad);
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  /** Pro members' PRO tab is Home with its options row (Videos, Games, Marketplace); everyone else's is the sign-up. */
  const isPro = useIsPro();
  // PRO › Home's rows, fetched ahead so the tab opens with them.
  useWarmProHome(isPro);
  const myId = useAppSelector((s) => s.auth.userInfo?.user_id);
  // Pro video uploads left part-sent when the app was last closed carry on
  // from here — the home screen is the first thing mounted once signed in.
  useEffect(() => { if (isPro && myId) resumeProVideoUploads(myId); }, [isPro, myId]);

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
    pro: new Animated.Value(1),
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
  /** The showing pane's wrapper, and a hidden one's. */
  const paneShown = styles.pane;
  const paneHidden = useMemo(() => [styles.pane, styles.hidden], []);
  /**
   * Inside a section, which of its sub-screens is showing (SECTION_SUBS) —
   * null for the section's own landing pane. Always null on the feed.
   */
  const [sub, setSub] = useState<string | null>(null);
  /** Sub-screens opened so far, as "section:key" — mounted on first pick and kept, as the panes are. */
  const [mountedSubs, setMountedSubs] = useState<ReadonlySet<string>>(() => new Set<string>());
  const subRef = useRef(sub);
  subRef.current = sub;
  /** Whether a section's own landing pane is the one showing. */
  const landing = (pane: FeedTab) => tab === pane && sub === null;
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
    // After launch has settled, then when JS is next idle (requestIdleCallback
    // — InteractionManager is deprecated).
    let idle: number | null = null;
    const timer = setTimeout(() => {
      idle = requestIdleCallback(() => {
        setMounted((m) => {
          if (m.has('events') && m.has('market') && m.has('groups')) return m;
          return new Set([...m, 'events', 'market', 'groups']);
        });
      });
    }, 1500);
    return () => { clearTimeout(timer); if (idle != null) cancelIdleCallback(idle); };
  }, []);
  /** A pane back to its first item. One that's never been opened has no list yet — it'll start there anyway. */
  const scrollToTop = (pane: FeedTab) => {
    if (pane === 'events') eventsScrollRef.current?.scrollTo({ y: 0, animated: false });
    else if (pane === 'market') marketScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'groups') groupsScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'cars') carsScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'members') membersScrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    else if (pane === 'pro') proScrollRef.current?.scrollTo({ y: 0, animated: false });
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
    // A section is always entered at its landing, never part-way into it.
    if (sub !== null) {
      setSub(null);
      if (next === tab) {
        // Back to the landing from one of its sub-screens: it fades up as a
        // tab arriving does (see the effect on `sub`).
        enter[next].setValue(0);
        subSwitched.current = true;
        return;
      }
    }
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

  /** A sub-screen of the section you're in. Picking the one showing does nothing new — its own pane keeps its place. */
  const selectSub = (key: string) => {
    showHeader();
    if (key === sub) return;
    const id = `${tab}:${key}`;
    if (!mountedSubs.has(id)) setMountedSubs((m) => new Set(m).add(id));
    setSub(key);
    recordFeedTab(id);
  };
  // The landing fading back up after a sub-screen — run once it's rendered,
  // for the same reason the tab switch's is.
  const subSwitched = useRef(false);
  useEffect(() => {
    if (!subSwitched.current || sub !== null) return;
    subSwitched.current = false;
    scrollToTop(tab);
    Animated.timing(enter[tab], {
      toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sub]);

  /**
   * The header's rows. The main row is every section, always, and stays put.
   * Inside a section its options open in a smaller row beneath: its landing
   * first, then its sub-screens.
   */
  const subTabs = useMemo<HeaderTab[] | undefined>(() => {
    if (tab === 'feed' || NO_SUB_TABS.has(tab)) return undefined;
    if (tab === 'pro' && !isPro) return undefined;
    return [
      { key: LANDING, label: SECTION_LANDING_LABEL[tab] },
      ...(SECTION_SUBS[tab] ?? []).map((s) => ({ key: s.key, label: s.label, Icon: s.Icon })),
    ];
  }, [tab, isPro]);
  // Pro lapsed while on one of PRO's options: back to its landing, which is now the sign-up page.
  useEffect(() => {
    if (!isPro && tab === 'pro' && sub !== null) setSub(null);
  }, [isPro, tab, sub]);
  const eventsNew = useMemo(() => ({
    label: 'New',
    accessibilityLabel: 'Create a new event',
    onPress: () => (navigation as any).navigate('SocietyEventCreate'),
  }), [navigation]);
  const onSubTabRef = useRef<(key: string) => void>(() => {});
  const onSubTab = (key: string) => {
    // The landing: selectTab on the section you're in brings it back (or to its top).
    if (key === LANDING) selectTab(tab);
    else selectSub(key);
  };
  onSubTabRef.current = onSubTab;
  const bottomPad = 88 + insets.bottom + 32;

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
    const gate = (pane: FeedTab, fn: ScrollHandler): ScrollHandler => (e) => { if (tabRef.current === pane && !subRef.current) fn(e); };
    return {
      feed: gate('feed', onScroll), events: gate('events', onEventsScroll), market: gate('market', onMarketScroll),
      groups: gate('groups', onGroupsScroll), cars: gate('cars', onCarsScroll), members: gate('members', onMembersScroll),
      pro: gate('pro', onProScroll),
    };
  }, [onScroll, onEventsScroll, onMarketScroll, onGroupsScroll, onCarsScroll, onMembersScroll, onProScroll]);
  /**
   * The banner collapses with the feed's scroll — gone by the time the feed
   * has moved its height — and stays collapsed on every other tab and section.
   * Back on the feed (which a tab tap returns to its top) it opens again.
   */
  const feedY = useRef(0);
  const feedScroll = useCallback((e: any) => {
    const y = e?.nativeEvent?.contentOffset?.y ?? 0;
    feedY.current = y;
    if (tabRef.current === 'feed' && !subRef.current) {
      homeMessageCollapse.setValue(Math.min(HOME_MESSAGE_INSET, Math.max(0, y)));
    }
    gated.feed(e);
  }, [gated]);
  useEffect(() => {
    const onFeed = tab === 'feed' && !sub;
    Animated.timing(homeMessageCollapse, {
      toValue: onFeed ? Math.min(HOME_MESSAGE_INSET, Math.max(0, feedY.current)) : HOME_MESSAGE_INSET,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [tab, sub]);
  const marketContentStyle = useMemo(() => ({ paddingTop: sectionPad, paddingBottom: 88 + insets.bottom + 32 }), [sectionPad, insets.bottom]);
  // The market's switch and search pin under the header, following it as it hides.
  // The tab row stays when the header hides, so the bar stops under it.
  const marketStickyTop = useMemo(() => headerBottom(sectionPad, insets.top, TABS_STUCK_RISE), [sectionPad, insets.top]);
  const photoHeader = useMemo(() => <View style={{ height: sectionPad }} />, [sectionPad]);
  const photoZoom = useMemo(() => ({ bottom: insets.bottom + FAB_BOTTOM, left: FAB_RIGHT }), [insets.bottom]);
  const onDropPin = useCallback((point: { lat: number; lng: number; name?: string; address?: string }) => (navigation as any).navigate('PhotoSpotCreate', {
    lat: point.lat, lng: point.lng, name: point.name, address: point.address,
  }), [navigation]);
  const renderSpotActions = useCallback((spotId: string) => <SpotActions spotId={spotId} />, []);
  const onEditSpot = useCallback((spotId: string) => (navigation as any).navigate('PhotoSpotCreate', { spotId }), [navigation]);
  const eventsScrollRef = useRef<ScrollView>(null);
  const proScrollRef = useRef<ScrollView>(null);
  const marketScrollRef = useRef<FlatList<Listing>>(null);
  const groupsScrollRef = useRef<FlatList<any>>(null);
  const carsScrollRef = useRef<FlatList<any>>(null);
  const membersScrollRef = useRef<FlatList<any>>(null);
  useEffect(() => {
    const asked = route.params?.tab;
    if (!asked) return;
    selectTab(asked);
    // One of the section's options, straight away — the home feed's Play
    // asks for PRO › Games (openDailyGames). Set here rather than through
    // selectSub, which reads the tab from before this switch.
    const askedSub = route.params?.sub;
    if (askedSub && (SECTION_SUBS[asked] ?? []).some((s) => s.key === askedSub) && (asked !== 'pro' || isPro)) {
      const id = `${asked}:${askedSub}`;
      setMountedSubs((m) => (m.has(id) ? m : new Set(m).add(id)));
      setSub(askedSub);
      recordFeedTab(id);
    }
    // A photo spot to open on the map — a notification about one.
    if (asked === 'photography' && route.params?.spotId) setFocusSpotId(route.params.spotId);
    // Spent. Left in the params it would be saved with the navigation state
    // (see navPersistence) and replayed on the next launch — a reload after
    // the menu's Events would open on Events rather than on the feed.
    navigation.setParams({ tab: undefined, at: undefined, spotId: undefined, sub: undefined } as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.at]);

  /**
   * A post handed to the upload bar: the feed, at its top, at once — so the
   * bar is the first thing on screen. Landed: a fresh first page, with the
   * new post at its head.
   */
  const selectTabRef = useRef(selectTab);
  selectTabRef.current = selectTab;
  useEffect(() => onPostUploadEvent((e) => {
    if (e.type === 'start') {
      if (tabRef.current !== 'feed') selectTabRef.current('feed');
      showHeader();
      scrollRef.current?.scrollToOffset({ offset: 0, animated: false });
    } else {
      setFeedRefresh((n) => n + 1);
    }
  }), []);

  // Keep the client-side blocked-users list in sync so blocked authors'
  // content stays hidden across sessions (Apple UGC requirement).
  const { data: blockedData } = useGetBlockedUsersQuery();
  useEffect(() => {
    if (blockedData?.entries) {
      dispatch(setBlockedUsers(blockedData.entries.map((u) => u.user_id).filter(Boolean)));
    }
  }, [blockedData, dispatch]);

  return (
    <SafeAreaView style={ss.fill} edges={[]}>
      <AppHeader
        tabs={FEED_TABS}
        activeTab={tab}
        onTabPress={selectTab}
        // PRO's options ride in the header like every section's — one row
        // for all of PRO's screens, so moving between them slides the thumb
        // instead of redrawing the row — drawn as a contained track.
        subTabs={subTabs}
        proSubTabs={tab === 'pro'}
        activeSubTab={sub ?? LANDING}
        onSubTabPress={onSubTab}
        // Events' Add New, after its options rather than on the page.
        subTabsAction={tab === 'events' ? eventsNew : undefined}
        // Already home: the logo has nowhere to go, so it does what a pull
        // does — back to the top, header showing, and a fresh page with the
        // spinner turning. On another tab it brings you back to the feed.
        onLogoPress={tab === 'feed' ? () => { selectTab('feed'); setFeedRefresh((n) => n + 1); } : undefined}
        // "Message from Matt", over the tabs at the top of the feed.
        homeMessage
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
          paddingTop={headerPad + FEED_TOP_GAP + messageInset}
          onScroll={feedScroll}
          refreshSignal={feedRefresh}
        />
      </Animated.View>
      </View>
      {mounted.has('pro') && (
        <View style={landing('pro') ? paneShown : paneHidden} pointerEvents={landing('pro') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.pro]}>
          {isPro ? (
            // Home: today's Daily Games, the Pro group, Pro members' posts
            // and cars — under the options row, so it starts where the
            // other sections' panes do.
            <ProHomeScreen scrollRef={proScrollRef} headerPad={proPad} bottomPad={bottomPad} onScroll={gated.pro} active={landing('pro')} />
          ) : (
            <ProPane scrollRef={proScrollRef} headerPad={headerPad} bottomPad={bottomPad} />
          )}
        </Animated.View>
        </View>
      )}
      {mounted.has('events') && (
        <View style={landing('events') ? paneShown : paneHidden} pointerEvents={landing('events') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.events]}>
          <MemoEventsView headerPad={sectionPad} onScroll={gated.events} scrollRef={eventsScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('market') && (
        <View style={landing('market') ? paneShown : paneHidden} pointerEvents={landing('market') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.market]}>
          {/* The same browse the group Market sections use. The bottom pad
              clears the floating tab bar, as the Marketplace screen's did. */}
          {/* For sale only, with no Your Listings card or For sale / Want
              ads switch — Want Ads and My Listings are the header's tabs now. */}
          <MemoMarketplaceBrowse
            lockKind="sale"
            hideManageEntry
            listRef={marketScrollRef}
            onScroll={gated.market}
            contentContainerStyle={marketContentStyle}
            stickyTop={marketStickyTop}
          />
        </Animated.View>
        </View>
      )}
      {mounted.has('groups') && (
        <View style={landing('groups') ? paneShown : paneHidden} pointerEvents={landing('groups') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.groups]}>
          <MemoGroupsView headerPad={headerPad} onScroll={gated.groups} scrollRef={groupsScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('cars') && (
        <View style={landing('cars') ? paneShown : paneHidden} pointerEvents={landing('cars') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.cars]}>
          <MemoCarsView headerPad={sectionPad} onScroll={gated.cars} scrollRef={carsScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('members') && (
        <View style={landing('members') ? paneShown : paneHidden} pointerEvents={landing('members') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.members]}>
          <MemoMembersView headerPad={sectionPad} onScroll={gated.members} scrollRef={membersScrollRef} />
        </Animated.View>
        </View>
      )}
      {mounted.has('photography') && (
        <View style={landing('photography') ? paneShown : paneHidden} pointerEvents={landing('photography') ? 'auto' : 'none'}>
        <Animated.View style={[ss.fill, paneAnim.photography]}>
          {/* map, shared with the photo app (see its README). The
              header floats over the top, so the shared `header` slot is just
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
      {/* The sections' sub-screens, each mounted on its first pick and kept. */}
      {Object.entries(SECTION_SUBS).flatMap(([section, subs]) => subs.map((s) => {
        const id = `${section}:${s.key}`;
        if (!mountedSubs.has(id)) return null;
        // PRO's options are Pro's: videos, games and the marketplace never show for anyone else.
        if (section === 'pro' && !isPro) return null;
        return (
          <SubPane
            key={id}
            sub={s}
            // Clear of the header's options row — PRO's is the taller one.
            headerPad={section === 'pro' ? proPad : sectionPad}
            bottomPad={bottomPad}
            active={tab === section && sub === s.key}
          />
        );
      }))}
      </View>
    </SafeAreaView>
  );
}

/**
 * One section sub-screen's pane: hidden but kept when not showing, as the
 * section panes are, with its own header-scroll tracking (gated to when it's
 * showing) and the same fade-and-rise on arrival.
 */
const SubPane = React.memo(function SubPane({ sub, headerPad, bottomPad, active }: {
  sub: SectionSub;
  headerPad: number;
  bottomPad: number;
  active: boolean;
}) {
  const scroll = useHeaderScroll(headerPad);
  const activeRef = useRef(active);
  activeRef.current = active;
  const onScroll = useCallback((e: any) => { if (activeRef.current) scroll(e); }, [scroll]);
  const enter = useRef(new Animated.Value(0)).current;
  const style = useMemo(() => ({
    opacity: enter,
    transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [TAB_ENTER_RISE, 0] }) }],
  }), [enter]);
  useEffect(() => {
    if (!active) return;
    enter.setValue(0);
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [active, enter]);
  const Screen = sub.Component;
  return (
    <View style={active ? styles.pane : [styles.pane, styles.hidden]} pointerEvents={active ? 'auto' : 'none'}>
      <Animated.View style={[ss.fill, style]}>
        <Screen headerPad={headerPad} onScroll={onScroll} bottomPad={bottomPad} active={active} />
      </Animated.View>
    </View>
  );
});

/**
 * The PRO tab for a member who isn't Pro: ProPage, straight on the screen —
 * what Pro adds and the way to sign up, with no options row. A Pro member (or
 * an admin) gets Home instead (ProHomeScreen), with Videos, Games and
 * Marketplace in the row above.
 */
function ProPane({ scrollRef, headerPad, bottomPad, onScroll }: {
  scrollRef: React.RefObject<ScrollView | null>;
  headerPad: number;
  bottomPad: number;
  onScroll?: (e: any) => void;
}) {
  return (
    <ScrollView
      ref={scrollRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingTop: headerPad + 12, paddingBottom: bottomPad, paddingHorizontal: GUTTER + 16 }}
      showsVerticalScrollIndicator={false}
    >
      <ProPage />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  feedHeader: { paddingBottom: 8 },
  // Every pane fills the space under the header; the showing one is on top.
  pane: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  // A pane whose tab isn't showing: still in the native tree, so a return to
  // it is a prop change rather than a rebuild. See paneAnim.
  hidden: { opacity: 0 },
});
