import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable, FlatList, Alert, Animated,
  ActivityIndicator, type NativeScrollEvent, type NativeSyntheticEvent, Platform } from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft, ChevronRight, MessageSquare, MessageCircle, Newspaper,
  Car, Calendar, ShoppingBag, BookOpen, Settings, Plus, Check, X, UserPlus, PenSquare,
  Route as RouteIcon,
} from 'lucide-react-native';
import { formatDistanceToNow, format } from 'date-fns';
import {
  useGetGroupQuery,
  useGetGroupMembersQuery,
  useLeaveGroupMutation,
  useGetGroupCarsQuery,
  useGetUserGarageQuery,
  useUpdateCarGroupMutation,
  useGetGroupDiscussionQuery,
  useGetGroupNewsQuery,
  useGetGroupResourcesQuery,
  useGetEventsQuery,
  useGetRallysQuery,
  useGetRoutesQuery,
  useGetPostsQuery,
  useGetListingsQuery,
} from '../../api/apiService';
import type { GarageCar, Listing } from '../../types/api';
import { GroupSettingsBody } from '../../components/groups/GroupSettingsSheet';
import FollowButton from '../../components/social/FollowButton';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import AvatarStack from '../../components/ui/AvatarStack';
import AppHeader, { useHeaderPad, APP_HEADER_HEIGHT } from '../../components/ui/AppHeader';
import { headerOffset, useHeaderScroll } from '../../hooks/useHeaderScroll';
import CarGridItem from '../../components/cars/CarGridItem';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import FeedItemCard from '../../components/cards/FeedItemCard';
import RouteTrace from '../../components/routes/RouteTrace';
import ListingCard from '../../components/marketplace/ListingCard';
import ListingSummaryModal from '../../components/marketplace/ListingSummaryModal';
import GroupItemDetailModal from '../../components/groups/GroupItemDetailModal';
import GroupVoteButtons from '../../components/groups/GroupVoteButtons';
import GroupCreateSheet, { type CreateKind } from '../../components/groups/GroupCreateSheet';
import ActionSheet from '../../components/ui/ActionSheet';
import { withAlpha } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { useRefetchOnFocus } from '../../hooks/useRefetchOnFocus';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import type { AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { calendarDate } from '../../utils/calendarDate';
import { rallyDateRange, RALLY_DATE_TBA } from '../../utils/rally';
import { formatDistance, curvinessLabel } from '../../utils/routeGeometry';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import { useStackedUserSummary } from '../../components/members/useStackedUserSummary';
import CarSummaryModal from '../../components/cars/CarSummaryModal';
import UserSummaryModal from '../../components/members/UserSummaryModal';
import GroupInviteModal from '../../components/groups/GroupInviteModal';
import JoinRequestsPanel from '../../components/groups/JoinRequests';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../../components/ui/SummaryModal';
import { DISCUSSION_CATEGORIES, RESOURCE_CATEGORIES } from '../../constants/groupCategories';
import {
  COMMON_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_20,
  COLOR_GRAY_22,
  COLOR_GRAY_31,
  COLOR_RED,
  COLOR_WHITE,
  COLOR_PRO,
} from '../../constants/config';
import { useGroupSummary } from '../../providers/GroupSummaryProvider';
import { FONT_INTER } from '../../constants/fonts'

type AppNav = NativeStackNavigationProp<AppStackParamList>;

/**
 * The header band's own surface — a shade under the app's card colour.
 *
 * The banner, the title card and the members strip read as one masthead rather
 * than as three stacked cards, and dropping them below `card` (#1e1e1e) sets
 * that whole block back from the content beneath it. The banner's bottom fade
 * has to land on exactly this value or the seam it exists to hide comes back.
 */
const HERO_SURFACE = COLOR_GRAY_20;
/** Controls sitting on the banner — one step up, so they read as raised. */
const HERO_CONTROL = COLOR_GRAY_31;
/**
 * Border for the back and options buttons on the banner. A translucent white
 * rather than a fixed grey: the buttons sit on a photo, and a dark rule
 * disappeared against the darker ones.
 */
const HERO_BTN_BORDER = 'rgba(255,255,255,0.28)';
/** The discussion, news and resource cards' ground — a shade under the other cards'. */
const ITEM_CARD = COLOR_GRAY_22;
const GUTTER = 12;
/** Rows added each time the roster list reaches its end. */
const MEMBER_PAGE_SIZE = 25;
/** How many of a section's most recent items the tab shows before "view all". */
const RECENT_LIMIT = 5;
/** Listings go two to a row, so an even number. */
const RECENT_GRID = 6;

/** The back and cog squares on the banner. */
const HEADER_BTN = 34;

/** Where the lit tab is scrolled to sit, leaving the one before it peeking in. */
const TAB_ACTIVE_LEFT = 44;

type TabKey = 'discussion' | 'posts' | 'news' | 'cars' | 'events' | 'routes' | 'market' | 'resources';

/** The header tabs' unlit white — see AppHeader's TAB_IDLE. */
const HEADER_TAB_IDLE = 'rgba(255,255,255,0.6)';

const TABS: {
  key: TabKey;
  label: string;
  /** One line under the tab row saying what the section is for. */
  blurb: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}[] = [
  { key: 'discussion', label: 'Discussion',  Icon: MessageCircle, blurb: 'Questions, debates, help, & more' },
  { key: 'posts',      label: 'Posts',       Icon: MessageSquare, blurb: 'Photos, videos and updates shared into this group.' },
  { key: 'news',       label: 'News',        Icon: Newspaper,     blurb: "Announcements and updates from the group's admins." },
  { key: 'cars',       label: 'Cars',        Icon: Car,           blurb: 'The cars members have added to this group.' },
  { key: 'events',     label: 'Events',      Icon: Calendar,      blurb: 'Meets, drives and gatherings the group is running.' },
  // Drives members shared into the group — GroupSectionScreen's routes tab.
  { key: 'routes',     label: 'Routes',      Icon: RouteIcon,     blurb: 'Drives members have shared with the group.' },
  // The group's own marketplace — GroupSectionScreen's market tab. Keyed to match.
  { key: 'market',     label: 'Marketplace', Icon: ShoppingBag,   blurb: 'Parts and cars members are selling, listed only here.' },
  { key: 'resources',  label: 'Resources',   Icon: BookOpen,      blurb: 'Guides, links and references the group has collected.' },
];

const NEWS_CATEGORIES: { key: string; label: string }[] = [
  { key: 'general',       label: 'General' },
  { key: 'meets',         label: 'Meets' },
  { key: 'announcements', label: 'Announcements' },
];
const CATEGORY_LISTS: Record<string, { key: string; label: string }[]> = {
  discussion: DISCUSSION_CATEGORIES,
  news: NEWS_CATEGORIES,
  resource: RESOURCE_CATEGORIES,
};
const catLabel = (kind: string, key?: string) =>
  CATEGORY_LISTS[kind]?.find((cat) => cat.key === (key ?? 'general'))?.label ?? key;

const newestFirst = <T extends { created_at?: string }>(items: T[]) =>
  [...items].sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());

const timeAgo = (iso?: string) => (iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : '');

type DetailKind = 'news' | 'discussion' | 'resource';

export default function GroupDetailScreen() {
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const listRef = useRef<FlatList>(null);
  useScrollTopOnBack(listRef);
  const route = useRoute<{ key: string; name: string; params: { groupId: string } }>();
  const { groupId } = route.params;
  const navigation = useNavigation<AppNav>();
  const c = useColors();
  const brand = useBrandColor();
  const { userInfo } = useAppSelector((s) => s.auth);

  const [carModalOpen, setCarModalOpen] = useState(false);
  // A car opens as a summary rather than a page push — see CarSummaryModal.
  const [carSummary, setCarSummary] = useState<{ carId: string; origin: SummaryOrigin | null } | null>(null);
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);
  const [listingSummary, setListingSummary] = useState<{ listingId: string; origin: SummaryOrigin | null } | null>(null);
  const [rosterOrigin, setRosterOrigin] = useState<SummaryOrigin | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Non-undefined while the admin's join-request panel is open, and the rect
  // it grows out of.
  const [requestsOrigin, setRequestsOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const [membersOpen, setMembersOpen] = useState(false);
  // The settings panel, and the cog it grows out of.
  const [settingsOrigin, setSettingsOrigin] = useState<SummaryOrigin | null | undefined>(undefined);
  const settingsOpen = settingsOrigin !== undefined;
  const { openUser: openSettingsUser, stacked: settingsStackedUser } = useStackedUserSummary(settingsOpen);
  // The roster arrives in one response, so paging is done here: render a page
  // at a time and grow as you reach the end, rather than mounting hundreds of
  // rows at once.
  const [memberPage, setMemberPage] = useState(1);
  const [tab, setTab] = useState<TabKey>('discussion');
  // "Post to group": the menu of what to post, then the sheet for the kind chosen.
  const [postMenuOpen, setPostMenuOpen] = useState(false);
  const [createKind, setCreateKind] = useState<Extract<CreateKind, 'discussion' | 'resources' | 'news'> | null>(null);
  const [detailItem, setDetailItem] = useState<{ kind: DetailKind; data: any } | null>(null);

  const headerPad = useHeaderPad();
  const insets = useSafeAreaInsets();
  // The app header slides away as you read down and back as you come up,
  // the way it does on a car's page.
  const onHeaderScroll = useHeaderScroll(headerPad);

  /**
   * Sticky tabs, done by hand.
   *
   * The list's own sticky headers pin to the top of the viewport, which here
   * is the top of the screen — under the status bar and the floating app
   * header. So the tab row scrolls with everything else, and a second copy
   * sits fixed under the app header, shown once the first has passed under
   * it. Each row reports its height so the tab row's place in the content is
   * known; the app header's own offset says where "under it" is right now.
   */
  const rowH = useRef<Record<string, number>>({});
  const rowOrder = useRef<string[]>([]);
  const headerHidden = useRef(false);
  const [tabsStuck, setTabsStuck] = useState(false);
  useEffect(() => {
    const id = headerOffset.addListener(({ value }) => {
      headerHidden.current = value <= -APP_HEADER_HEIGHT + 1;
    });
    return () => headerOffset.removeListener(id);
  }, []);
  /** The scroll offset at which the page's tab row meets the fixed copy. */
  const dockOffset = useCallback(() => {
    let tabsY = 0;
    for (const key of rowOrder.current) {
      if (key === 'tabs') break;
      tabsY += rowH.current[key] ?? 0;
    }
    return tabsY - (headerHidden.current ? insets.top : headerPad);
  }, [insets.top, headerPad]);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onHeaderScroll(e);
    const stuck = e.nativeEvent.contentOffset.y >= dockOffset();
    setTabsStuck((was) => (was === stuck ? was : stuck));
  }, [onHeaderScroll, dockOffset]);
  // The fixed copy rides the app header: under its buttons while they're up,
  // and up to the status bar once they've gone.
  const overlayLift = useRef(headerOffset.interpolate({
    inputRange: [-APP_HEADER_HEIGHT, 0], outputRange: [-APP_HEADER_HEIGHT, 0], extrapolate: 'clamp',
  })).current;

  const { data: group, isLoading, refetch: refetchGroup } = useGetGroupQuery(groupId);
  // Always fetched fresh on arrival: the roster decides whether you may see the
  // page, and a cached one from before an approval would turn a new member away.
  const mountedAt = useRef(Date.now()).current;
  const {
    data: members = [], fulfilledTimeStamp: membersFetchedAt, refetch: refetchMembers,
  } = useGetGroupMembersQuery(groupId, { refetchOnMountOrArgChange: true });
  const membersLoaded = (membersFetchedAt ?? 0) >= mountedAt;
  // Coming back from elsewhere — the notifications list, most often, where a
  // join request gets approved — the roster here has to reflect that decision.
  useRefetchOnFocus(refetchMembers);
  useRefetchOnFocus(refetchGroup);
  const { data: groupCarsData, refetch: refetchCars } = useGetGroupCarsQuery(groupId);
  const { data: garageData }       = useGetUserGarageQuery(undefined, { skip: !carModalOpen });
  const [leave] = useLeaveGroupMutation();
  const [updateCarGroup] = useUpdateCarGroupMutation();

  // One section's items at a time — the tab you're on. Lazy, like the section
  // screen: the others are skipped until you switch to them.
  const { data: discussionData, isFetching: discussionFetching, refetch: refetchDiscussion } =
    useGetGroupDiscussionQuery({ groupId, limit: RECENT_LIMIT * 2 }, { skip: tab !== 'discussion' });
  const { data: postsData, isFetching: postsFetching, refetch: refetchPosts } =
    useGetPostsQuery({ group_id: groupId, limit: RECENT_LIMIT }, { skip: tab !== 'posts' });
  const { data: newsData, isFetching: newsFetching, refetch: refetchNews } =
    useGetGroupNewsQuery({ groupId, limit: RECENT_LIMIT * 2 }, { skip: tab !== 'news' });
  const { data: resourcesData, isFetching: resourcesFetching, refetch: refetchResources } =
    useGetGroupResourcesQuery({ groupId, limit: RECENT_LIMIT * 2 }, { skip: tab !== 'resources' });
  const { data: eventsData, isFetching: eventsFetching, refetch: refetchEvents } =
    useGetEventsQuery({ limit: RECENT_LIMIT, group_id: groupId }, { skip: tab !== 'events' });
  // The club rallys attached to this group lead its events.
  const { data: rallysData, isFetching: rallysFetching, refetch: refetchRallys } =
    useGetRallysQuery({ group_id: groupId, time_filter: 'upcoming', limit: RECENT_LIMIT }, { skip: tab !== 'events' });
  const { data: routesData, isFetching: routesFetching, refetch: refetchRoutes } =
    useGetRoutesQuery({ group_id: groupId, sort: 'votes', limit: RECENT_LIMIT }, { skip: tab !== 'routes' });
  const { data: listingsData, isFetching: listingsFetching, refetch: refetchListings } =
    useGetListingsQuery({ group_id: groupId, limit: RECENT_GRID }, { skip: tab !== 'market' });

  // Only the visible tab's query is running — refetching a skipped one throws.
  const refetchTab: Record<TabKey, () => unknown> = {
    discussion: refetchDiscussion, posts: refetchPosts, news: refetchNews, resources: refetchResources,
    events: () => Promise.all([refetchEvents(), refetchRallys()]),
    routes: refetchRoutes, market: refetchListings, cars: refetchCars,
  };
  const refreshControl = useRefreshControl(() =>
    Promise.all([refetchGroup(), refetchMembers(), refetchCars(), refetchTab[tab]()]));

  /**
   * This page is for members.
   *
   * In-app links already go through GroupSummaryProvider, which only sends
   * members here. What still arrives directly is a route — a tapped
   * notification, a push, a home banner — and those can't know. So the page
   * checks once, when the roster first loads: anyone who isn't an active member
   * is taken back and shown the group's summary, with Join in it, instead.
   *
   * Once, not continuously: leaving the group from settings makes you a
   * non-member too, and that has its own way out.
   */
  const { openGroup } = useGroupSummary();
  const accessChecked = useRef(false);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (accessChecked.current || !membersLoaded || !userInfo?.user_id) return;
    accessChecked.current = true;
    const mine = members.find((m) => m.user_id === userInfo.user_id);
    if (mine?.status === 'active') return;

    setRedirecting(true);
    if (navigation.canGoBack()) navigation.goBack();
    else (navigation as any).navigate('Groups');
    // After the screen has animated away — the summary is a modal, and iOS won't
    // present one while a transition is still running.
    setTimeout(() => openGroup(groupId), 400);
  }, [membersLoaded, members, userInfo?.user_id, navigation, openGroup, groupId]);

  const groupCars = groupCarsData?.entries ?? [];
  const myCars = garageData?.entries ?? [];

  // ── Tab row ─────────────────────────────────────────────────────────────
  // Brings the lit tab toward the front of the row, the way the app header's
  // tabs do. Positions come from each tab's own onLayout — they size to their
  // labels, so measuring is the only way to know.
  // Two rows — the one in the page and the fixed copy — kept in step.
  const tabScrollRef = useRef<ScrollView>(null);
  const overlayTabScrollRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, number>>({});
  const scrollTabIntoView = useCallback((key: TabKey) => {
    const x = tabX.current[key];
    if (x == null) return;
    const first = key === TABS[0].key;
    const to = { x: first ? 0 : Math.max(0, x - TAB_ACTIVE_LEFT), animated: true };
    tabScrollRef.current?.scrollTo(to);
    overlayTabScrollRef.current?.scrollTo(to);
  }, []);
  const switchTab = (key: TabKey) => {
    setTab(key);
    scrollTabIntoView(key);
    // Switched from the docked row, the new section starts right under it —
    // rather than wherever down the old section you happened to be.
    if (tabsStuck) listRef.current?.scrollToOffset({ offset: dockOffset(), animated: false });
  };

  // The roster decides whether you can see this page at all, so nothing renders
  // before it has answered.
  if (isLoading || !group || !membersLoaded || redirecting) return <Spinner fullScreen />;

  const banner   = firstGalleryUrl(group.banners) ?? firstGalleryUrl(group.gallery);
  /**
   * Only people who have actually joined.
   *
   * `getGroupMembers` returns every row — active, pending and invited — when no
   * status is passed, so counting the raw list here reported a group as bigger
   * than it is, and disagreed with both the group card (which counts active
   * server-side) and the Members tab (which filters the same way).
   */
  const activeMembers = members.filter((m) => m.status === 'active');
  const isMember = members.some((m) => m.user_id === userInfo?.user_id && m.status === 'active');
  // Active admins only. Without the status check an invited-but-not-joined
  // admin would see Settings before actually being in the group.
  const isAdmin  = members.some((m) => m.user_id === userInfo?.user_id && m.member_type === 'admin' && m.status === 'active');
  // Oldest first — whoever has waited longest is answered first.
  const pendingRequests = members
    .filter((m) => m.status === 'pending')
    .sort((a, b) => new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime());
  const canManageCars = isMember || isAdmin;

  const goToSection = (initialTab: string) => {
    (navigation as any).navigate('GroupSection', { groupId, groupTitle: group.title, initialTab });
  };

  // Whoever runs the group, for "Message admin". First active admin — a group
  // can have several and any of them can field a question.
  const groupAdmin = members.find((m) => m.member_type === 'admin' && m.status === 'active');
  const canMessageAdmin = !!groupAdmin?.user_id && groupAdmin.user_id !== userInfo?.user_id;

  // Admins lead the roster; everyone else keeps the order the server sent.
  const roster = [...activeMembers].sort(
    (a, b) => (a.member_type === 'admin' ? 0 : 1) - (b.member_type === 'admin' ? 0 : 1),
  );

  const messageAdmin = () => {
    if (!groupAdmin) return;
    setSettingsOrigin(undefined);
    // After the panel has gone — a screen can't be presented over a modal
    // that's still dismissing.
    setTimeout(() => (navigation as any).navigate('ComposeMessage', {
      userId: groupAdmin.user_id,
      username: groupAdmin.user?.username,
    }), 250);
  };

  const leaveGroup = () => {
    Alert.alert('Leave this group?', `You'll lose access to ${group.title}.`, [
      { text: 'Cancel', style: 'cancel' },
      // Out of the page as well as the group — it's members-only.
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => leave(groupId).unwrap().then(() => {
          setSettingsOrigin(undefined);
          setTimeout(() => navigation.goBack(), 250);
        }).catch(() => {
          Alert.alert("Couldn't leave the group", 'Please try again.');
        }),
      },
    ]);
  };

  // ── Banner ──────────────────────────────────────────────────────────────
  // The first row of the page, scrolling away with the rest of it.
  const bannerRow = (
    <View style={styles.bannerWrap}>
      {banner
        ? <Image source={{ uri: banner }} style={styles.banner} contentFit="cover" />
        : <View style={[styles.banner, { backgroundColor: c.primaryAlt }]} />}
      {/* A flat wash over the whole image, so the photo sits back and
          anything laid over it reads regardless of how bright it is. */}
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: withAlpha(HERO_SURFACE, 0.34) }]}
        pointerEvents="none"
      />
      {/* Darkens the top so the floating app header reads over the image. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.62)', 'rgba(0,0,0,0)']}
        style={styles.bannerTopScrim}
        pointerEvents="none"
      />
      {/* Fades the bottom into the page so the banner has no hard edge. Lands
          on the hero surface: whatever sits directly under it — the requests
          bar, the members strip, the description — shares that surface. Three
          stops rather than two, since a straight linear ramp reads as a band
          starting mid-image where an eased one doesn't. */}
      <LinearGradient
        colors={[withAlpha(HERO_SURFACE, 0), withAlpha(HERO_SURFACE, 0.72), HERO_SURFACE]}
        locations={[0, 0.55, 1]}
        style={styles.bannerFade}
        pointerEvents="none"
      />

      {/* Title sits on the banner itself, in the faded band at its foot: the
          back control, the name and the tagline down the left, and the
          group's actions — settings over "Post to group" — stacked on the
          right, both columns resting on the same baseline. */}
      <View style={styles.bannerTitleWrap}>
        <View style={styles.bannerLead}>
          <TouchableOpacity
            style={[styles.headerBtn, { borderColor: HERO_BTN_BORDER }]}
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <ChevronLeft size={22} color={c.fg} />
          </TouchableOpacity>
          <Text style={[styles.groupTitle, { color: c.fg }]} numberOfLines={2}>{group.title}</Text>
        </View>
        <View style={styles.bannerActions}>
          <SummaryTouchable
            style={[styles.headerBtn, { borderColor: HERO_BTN_BORDER }]}
            onPress={(origin) => setSettingsOrigin(origin)}
            accessibilityLabel="Group settings"
          >
            <Settings size={20} color={c.fg} />
          </SummaryTouchable>
          {/* One way in for everything a member can add — the sections' own
              plus buttons live a screen away, on the section screen. */}
          {(isMember || isAdmin) && (
            <TouchableOpacity
              style={[styles.postToBtn, { backgroundColor: c.primaryAlt }]}
              onPress={() => setPostMenuOpen(true)}
              activeOpacity={0.85}
              hitSlop={6}
              accessibilityRole="button"
            >
              <PenSquare size={14} color={COLOR_BLACK} strokeWidth={2.6} />
              <Text style={styles.postToText}>Post to group</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  // ── Tab bar ─────────────────────────────────────────────────────────────
  // The app header's tab row, in the page: labels with an underline under the
  // lit one, in the brand colour. Icons kept, one colour for all of them.
  const renderTabBar = (ref: React.RefObject<ScrollView | null>) => (
    <View style={[styles.tabBar, { backgroundColor: c.cream }]}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabRow}
      >
        {TABS.map(({ key, label, Icon }) => {
          const on = key === tab;
          // The header's colours: gold lit, its idle white stepped back.
          const color = on ? COLOR_PRO : HEADER_TAB_IDLE;
          return (
            <TouchableOpacity
              key={key}
              onLayout={(e) => { tabX.current[key] = e.nativeEvent.layout.x; }}
              onPress={() => switchTab(key)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <View style={styles.tabInner}>
                <Icon size={16} color={color} strokeWidth={on ? 2.4 : 2} />
                <Text style={[styles.tabLabel, { color }, !on && styles.tabLabelIdle]}>{label}</Text>
              </View>
              {/* Under the lit tab only, in its colour — as the header's. */}
              <View style={[styles.tabUnderline, { backgroundColor: on ? COLOR_PRO : 'transparent' }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  // ── Tab content ─────────────────────────────────────────────────────────
  const activeTab = TABS.find((t) => t.key === tab)!;
  const fetching =
    (tab === 'discussion' && discussionFetching) || (tab === 'posts' && postsFetching) ||
    (tab === 'news' && newsFetching) || (tab === 'resources' && resourcesFetching) ||
    (tab === 'events' && (eventsFetching || rallysFetching)) || (tab === 'routes' && routesFetching) ||
    (tab === 'market' && listingsFetching);

  let items: any[] = [];
  switch (tab) {
    case 'discussion': items = newestFirst(discussionData?.entries ?? []).slice(0, RECENT_LIMIT); break;
    case 'posts':      items = (postsData?.entries ?? []).slice(0, RECENT_LIMIT); break;
    case 'news':       items = newestFirst(newsData?.entries ?? []).slice(0, RECENT_LIMIT); break;
    case 'resources':  items = newestFirst(resourcesData?.entries ?? []).slice(0, RECENT_LIMIT); break;
    // Rallys first, marked so the renderer knows them from the group's own events.
    case 'events':     items = [
      ...(rallysData?.entries ?? []).map((r) => ({ ...r, _rally: true })),
      ...(eventsData?.entries ?? []),
    ].slice(0, RECENT_LIMIT); break;
    case 'routes':     items = (routesData?.entries ?? []).slice(0, RECENT_LIMIT); break;
    // All of them, not a recent few: this is where the group's cars live now.
    case 'cars':       items = groupCars; break;
    case 'market':     items = (listingsData?.entries ?? []).slice(0, RECENT_GRID); break;
  }

  // Discussion, news and resources share one card: the heading with the
  // author's face beside it, two lines of body, then the thumbs bottom-left
  // and when it was posted bottom-right. The thumbs are their own touchables
  // inside the card's, so a vote doesn't also open the item.
  const itemCard = (d: any, kind: DetailKind) => (
    <TouchableOpacity
      key={d.internal_id}
      style={[styles.card, styles.textCard, { backgroundColor: ITEM_CARD, borderColor: c.borderDark }]}
      onPress={() => setDetailItem({ kind, data: d })}
      activeOpacity={0.8}
    >
      <Text style={[styles.rowTitle, styles.cardTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
      {/* Pinned to the card's corner rather than in the heading's row, so it
          sits at the same spot however long the heading runs. */}
      <View style={styles.cardAvatar} pointerEvents="none">
        <Avatar user={d.user} size={36} />
      </View>
      {d.body ? <Text style={[styles.rowBody, styles.cardBody, { color: c.muted }]} numberOfLines={2}>{stripHtml(d.body)}</Text> : null}
      <View style={styles.cardFoot}>
        <GroupVoteButtons
          kind={kind}
          internal_id={d.internal_id}
          group_id={groupId}
          upvotes={d.upvotes}
          downvotes={d.downvotes}
          votes={d.votes}
        />
        <Text style={[styles.authorWhen, { color: c.grey }]} numberOfLines={1}>{timeAgo(d.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );

  // Every item its own object — inset, rounded and edged — so the section
  // reads as a handful of things rather than one surface with lines across it.
  const renderTabItem = (d: any) => {
    switch (tab) {
      case 'discussion': return itemCard(d, 'discussion');
      case 'news':       return itemCard(d, 'news');
      case 'resources':  return itemCard(d, 'resource');
      case 'posts':
        // The home feed's own card, so a post looks the same here as there.
        // Inset to the same gutter the cards around it keep.
        return (
          <View key={d.internal_id} style={styles.feedCard}>
            <FeedItemCard
              post={d}
              isLiked={d.isLiked}
              omitGroupId={groupId}
              onPress={() => (navigation as any).navigate('PostDetailModal', { postId: d.internal_id })}
            />
          </View>
        );
      case 'events': {
        if (d._rally) {
          const hero = d.hero_image ? imageUrl(d.hero_image) : firstGalleryUrl(d.gallery);
          return (
            <TouchableOpacity
              key={`rally-${d.internal_id}`}
              style={[styles.card, styles.mediaRow, { backgroundColor: c.card, borderColor: c.borderDark }]}
              onPress={() => (navigation as any).navigate('RallyDetailModal', { rallyId: d.internal_id })}
              activeOpacity={0.8}
            >
              {hero
                ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
                : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />}
              <View style={ss.fill}>
                <Text style={[styles.rallyTag, { color: c.primaryAlt }]}>ORS RALLY</Text>
                <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
                <Text style={[styles.metaText, { color: c.grey }]}>{rallyDateRange(d) ?? RALLY_DATE_TBA}</Text>
              </View>
            </TouchableOpacity>
          );
        }
        const hero = firstGalleryUrl(d.gallery);
        const eventDay = calendarDate(d.event_date);
        const date = eventDay ? format(eventDay, 'MMM d, yyyy') : null;
        return (
          <TouchableOpacity
            key={d.internal_id}
            style={[styles.card, styles.mediaRow, { backgroundColor: c.card, borderColor: c.borderDark }]}
            onPress={() => (navigation as any).navigate('EventDetailModal', { eventId: d.internal_id })}
            activeOpacity={0.8}
          >
            {hero
              ? <Image source={{ uri: hero }} style={styles.rowThumb} contentFit="cover" />
              : <View style={[styles.rowThumb, { backgroundColor: c.segment }]} />}
            <View style={ss.fill}>
              <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title}</Text>
              {date && <Text style={[styles.metaText, { color: c.grey }]}>{date}</Text>}
            </View>
          </TouchableOpacity>
        );
      }
      case 'routes': {
        const stats = d.stats;
        return (
          <TouchableOpacity
            key={d.internal_id}
            style={[styles.card, styles.mediaRow, { backgroundColor: c.card, borderColor: c.borderDark }]}
            onPress={() => (navigation as any).navigate('RouteDetailModal', { routeId: d.internal_id })}
            activeOpacity={0.8}
          >
            <RouteTrace polyline={d.polyline} speeds={d.speed_profile} color={c.primaryAlt} style={styles.rowThumb} />
            <View style={ss.fill}>
              <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{d.title || 'Untitled route'}</Text>
              {stats && (
                <Text style={[styles.metaText, { color: c.grey }]}>
                  {formatDistance(stats.distance_meters)} · {curvinessLabel(stats.curviness)} · score {d.vote_count ?? 0}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        );
      }
      default: return null;
    }
  };

  // Cars and listings are mostly their pictures, so they go two to a row.
  const pairs = (list: any[]) => list.reduce((rows: any[][], item, i) => {
    if (i % 2 === 0) rows.push([item]); else rows[rows.length - 1].push(item);
    return rows;
  }, []);

  // Listings two to a row.
  const renderListings = () => pairs(items).map((pair, r) => (
    <View key={r} style={styles.gridRow}>
      {pair.map((item) => (
        <ListingCard
          key={item.internal_id}
          listing={item as Listing}
          onPress={(origin) => setListingSummary({ listingId: item.internal_id, origin })}
        />
      ))}
      {/* Keeps a lone last item half-width instead of letting it stretch. */}
      {pair.length === 1 && <View style={ss.fill} />}
    </View>
  ));

  // Cars as the Cars screen lays them out: two columns, each card shaped by
  // its photo, the name and owner over its foot — the same component, so a
  // car looks the same here as it does there.
  const renderCars = () => (
    <View style={styles.mosaic}>
      {[0, 1].map((col) => (
        <View key={col} style={styles.column}>
          {(items as GarageCar[]).filter((_, i) => i % 2 === col).map((car) => (
            <CarGridItem
              key={car.internal_id}
              item={car}
              overlay
              onPress={(origin) => setCarSummary({ carId: car.internal_id, origin })}
            />
          ))}
        </View>
      ))}
    </View>
  );

  // What "+ New" does on this tab, or nothing when the tab has no "new".
  const createNew: (() => void) | null =
    tab === 'discussion' ? () => setCreateKind('discussion')
    : tab === 'resources' ? () => setCreateKind('resources')
    : tab === 'news' && isAdmin ? () => setCreateKind('news')
    : tab === 'posts' ? () => (navigation as any).navigate('Create', { groupId })
    : tab === 'cars' && canManageCars ? () => setCarModalOpen(true)
    : tab === 'market' ? () => (navigation as any).navigate('ListingCreate', { groupId })
    : null;

  const tabContent = (
    // No minimum height: a section with two items in it shouldn't scroll, and
    // the header only collapses as far as the content gives it reason to.
    <View>
      {/* What the section is, and the way to all of it — the way a feed
          introduces itself. Always shown, so an empty section still says what
          would go in it. */}
      <View style={styles.tabIntro}>
        <Text style={[styles.tabBlurb, { color: c.grey }]}>{activeTab.blurb}</Text>
        {/* A new one of whatever the tab holds. Events and routes have no
            "new" of their own here — both are made elsewhere — and news is
            the admins' to write. */}
        {createNew && (
          <TouchableOpacity
            style={[styles.newBtn, { backgroundColor: c.primaryAlt }]}
            onPress={createNew}
            activeOpacity={0.85}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`New ${activeTab.label.toLowerCase()}`}
          >
            <Plus size={13} color={COLOR_BLACK} strokeWidth={3} />
            <Text style={styles.newBtnText}>New</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.viewAll, { borderColor: c.primaryAlt }]}
          onPress={() => goToSection(tab)}
          activeOpacity={0.75}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`View all ${activeTab.label.toLowerCase()}`}
        >
          <Text style={[styles.viewAllText, { color: c.primaryAlt }]}>All</Text>
          <ChevronRight size={13} color={c.primaryAlt} strokeWidth={2.6} />
        </TouchableOpacity>
      </View>
      {fetching ? (
        <ActivityIndicator size="large" color={c.primaryAlt} style={styles.loader} />
      ) : items.length === 0 ? (
        <EmptyState title={`No ${activeTab.label.toLowerCase()} yet`} />
      ) : tab === 'cars' ? renderCars() : tab === 'market' ? renderListings() : items.map(renderTabItem)}
    </View>
  );

  // ── Page rows ───────────────────────────────────────────────────────────
  // A list rather than a scroll view, for the sticky tab bar: everything above
  // it scrolls away under the collapsed header, and it stays.
  const rows: { key: string; node: React.ReactNode }[] = [{ key: 'banner', node: bannerRow }];

  // Join requests — admins only, and only while someone is waiting. At the
  // top of the page rather than inside Settings: a request is a person
  // waiting on an answer, and the only other place it surfaced was a
  // notification, which is easy to clear without acting on.
  if (isAdmin && pendingRequests.length > 0) rows.push({ key: 'requests', node: (
    <SummaryTouchable
      style={[styles.requestsBar, { backgroundColor: HERO_SURFACE, borderBottomColor: c.borderDark }]}
      onPress={(origin) => setRequestsOrigin(origin)}
      activeOpacity={0.8}
      accessibilityLabel={`Review ${pendingRequests.length} join request${pendingRequests.length === 1 ? '' : 's'}`}
    >
      <View style={styles.requestsCount}>
        <Text style={styles.requestsCountText}>{pendingRequests.length}</Text>
      </View>
      <Text style={[styles.requestsText, { color: c.fg }]}>
        {pendingRequests.length === 1 ? 'Join request waiting' : 'Join requests waiting'}
      </Text>
      <Text style={[styles.requestsAction, { color: c.primaryAlt }]}>Review</Text>
    </SummaryTouchable>
  ) });

  // Members strip — opens the full roster.
  if (activeMembers.length > 0) rows.push({ key: 'members', node: (
    <SummaryTouchable
      // No rule under it: the description below shares this surface, and
      // the two are meant to read as one block.
      style={[styles.membersStrip, { backgroundColor: HERO_SURFACE }]}
      onPress={(origin) => {
        setMemberPage(1);
        setRosterOrigin(origin);
        setMembersOpen(true);
      }}
      activeOpacity={0.75}
      accessibilityLabel={`View all ${activeMembers.length} members`}
    >
      <View style={styles.avatarRow}>
        <AvatarStack users={activeMembers.map((m) => m.user)} ringColor={HERO_SURFACE} />
      </View>
    </SummaryTouchable>
  ) });

  // Description — on the hero surface the banner fades to, so it runs
  // seamlessly out of the masthead rather than starting a new card.
  if (group.body || group.subtitle) rows.push({ key: 'body', node: (
    <View style={[styles.bodyBlock, { backgroundColor: HERO_SURFACE, borderBottomColor: c.border }]}>
      {/* The tagline leads the description rather than sitting on the banner. */}
      {group.subtitle ? (
        <View style={[styles.taglinePill, { backgroundColor: HERO_CONTROL, borderColor: c.borderDark }]}>
          <Text style={[styles.taglineText, { color: c.fg }]} numberOfLines={1}>{group.subtitle}</Text>
        </View>
      ) : null}
      {group.body ? <Text style={[styles.bodyText, { color: c.fg }]}>{stripHtml(group.body)}</Text> : null}
    </View>
  ) });

  if (isMember || isAdmin) {
    rows.push({ key: 'tabs', node: renderTabBar(tabScrollRef) });
    rows.push({ key: 'content', node: tabContent });
  }
  rowOrder.current = rows.map((r) => r.key);

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: c.cream }]} edges={[]}>
      {/* The header floats so the banner starts at the very top of the
          viewport, the way the profile screen's cover does. */}
      <AppHeader />
      <FlatList
        ref={listRef}
        refreshControl={refreshControl}
        data={rows}
        keyExtractor={(r) => r.key}
        renderItem={({ item }) => (
          <View onLayout={(e) => { rowH.current[item.key] = e.nativeEvent.layout.height; }}>
            {item.node}
          </View>
        )}
        style={[ss.fill, { backgroundColor: c.cream }]}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      />

      {/* The fixed tab row — see `tabsStuck`. Under the app header's own
          layer, so its buttons stay on top and take their taps. */}
      {tabsStuck && (
        <Animated.View
          style={[styles.tabsOverlay, { paddingTop: headerPad, backgroundColor: c.cream, transform: [{ translateY: overlayLift }] }]}
          pointerEvents="box-none"
        >
          {renderTabBar(overlayTabScrollRef)}
        </Animated.View>
      )}

      {/* Add car modal. Fades rather than slides — the sheet is nearly
          full-height, so a slide reads as a page transition. */}
      <Modal visible={carModalOpen} transparent animationType="fade" onRequestClose={() => setCarModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCarModalOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: c.cream }]}>
            <View style={[styles.sheetHeader, { borderBottomColor: c.border }]}>
              <Text style={[styles.sheetTitle, { color: c.fg }]}>Add car</Text>
              <TouchableOpacity onPress={() => setCarModalOpen(false)} hitSlop={8}>
                <X size={22} color={c.grey} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.sheetHint, { color: c.grey }]}>Tap a car to add or remove it from this group.</Text>
            <FlatList
              data={myCars}
              keyExtractor={(car: GarageCar) => car.internal_id}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => {
                const associated = item.group_id === groupId;
                const img = firstGalleryUrl(item.gallery) ?? (item.profile_image ? imageUrl(item.profile_image) : null);
                return (
                  <TouchableOpacity
                    style={[styles.carPickRow, { borderBottomColor: c.border }]}
                    onPress={() => updateCarGroup({ carId: item.internal_id, groupId: associated ? null : groupId })}
                    activeOpacity={0.7}
                  >
                    {img
                      ? <Image source={{ uri: img }} style={styles.carPickThumb} contentFit="cover" />
                      : <View style={[styles.carPickThumb, { backgroundColor: c.segment }]} />}
                    <Text style={[styles.carPickTitle, { color: c.fg }]} numberOfLines={1}>
                      {[item.year, item.make, item.model].filter(Boolean).join(' ') || item.title || 'Car'}
                    </Text>
                    <View style={[styles.carCheck, { borderColor: associated ? c.primaryAlt : c.border }, associated && { backgroundColor: c.primaryAlt }]}>
                      {associated && <Check size={14} color={COLOR_BLACK} strokeWidth={3} />}
                    </View>
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={[styles.carsEmpty, { color: c.grey }]}>You have no cars in your garage yet.</Text>
              }
            />
          </View>
        </View>
      </Modal>

      {/* ── Members roster ──
          A summary of the group's people, in the same panel the cars and the
          members themselves use, rather than a slide-up sheet of its own. The
          rows are mapped rather than listed: SummaryModal brings its own
          scroller, and a FlatList inside one is a scroller inside a scroller. */}
      <SummaryModal
        visible={membersOpen}
        onClose={() => setMembersOpen(false)}
        origin={rosterOrigin}
        actionLabel="View All Members"
        onAction={() => (navigation as any).navigate('GroupMembers', { groupId })}
      >
        <View style={styles.panelHead}>
          <Text style={[styles.panelTitle, { color: c.fg }]}>
            {activeMembers.length} member{activeMembers.length !== 1 ? 's' : ''}
          </Text>
          {/* Anyone in the group can ask someone in — a club grows by its
              members knowing people, not by its admins doing the asking. The
              roster is itself a modal, and the invite sheet is another, so
              this closes first and opens that once it has gone. */}
          {(isMember || isAdmin) && (
            <TouchableOpacity
              style={[styles.stripInvite, { backgroundColor: c.primaryAlt }]}
              onPress={() => {
                setMembersOpen(false);
                setTimeout(() => setInviteOpen(true), 250);
              }}
              activeOpacity={0.85}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Invite someone to this group"
            >
              <UserPlus size={14} color={COLOR_BLACK} strokeWidth={2.6} />
              <Text style={styles.stripInviteText}>Invite</Text>
            </TouchableOpacity>
          )}
        </View>

        {roster.slice(0, memberPage * MEMBER_PAGE_SIZE).map((item) => {
            const isMe = item.user_id === userInfo?.user_id;
            return (
              // The row opens the member's summary; the follow button stays as
              // an inline shortcut.
              <SummaryTouchable
                key={item.user_id}
                style={[styles.memberRow, { borderBottomColor: c.borderDark }]}
                onPress={(origin) => {
                  // The roster is itself a modal; a second one over it fights
                  // for the screen, so close this first.
                  setMembersOpen(false);
                  requestAnimationFrame(() => setUserSummary({ userId: item.user_id, origin }));
                }}
              >
                <Avatar user={item.user} size={40} />
                <View style={styles.memberNameWrap}>
                  <Text style={[styles.memberName, { color: c.fg }]} numberOfLines={1}>
                    @{item.user?.username ?? 'member'}
                  </Text>
                  {item.member_type === 'admin' && (
                    <View style={[styles.adminPill, { backgroundColor: c.secondary }]}>
                      <Text style={[styles.adminPillText, { color: c.fg }]}>Admin</Text>
                    </View>
                  )}
                </View>
                {/* No point offering to follow yourself. */}
                {!isMe && item.user?.username ? (
                  <FollowButton username={item.user.username} />
                ) : null}
              </SummaryTouchable>
            );
        })}

        {/* A page at a time, on request. Without a list underneath there's
            nothing to reach the end of. */}
        {memberPage * MEMBER_PAGE_SIZE < roster.length && (
          <TouchableOpacity
            style={styles.rosterMore}
            onPress={() => setMemberPage((p) => p + 1)}
            activeOpacity={0.75}
          >
            <Text style={[styles.rosterMoreText, { color: c.primaryAlt }]}>
              Show more
            </Text>
          </TouchableOpacity>
        )}
      </SummaryModal>

      {/* ── Settings ──
          The same contents the section screen's sheet holds, grown out of the
          cog rather than slid up from the foot. Membership actions ride along
          — the ⋮ menu that used to carry them is gone. */}
      <SummaryModal
        visible={settingsOpen}
        onClose={() => setSettingsOrigin(undefined)}
        origin={settingsOrigin ?? null}
        stacked={settingsStackedUser}
      >
        <View style={styles.panelHead}>
          <Text style={[styles.panelTitle, { color: c.fg }]}>Group settings</Text>
        </View>
        <GroupSettingsBody
          groupId={groupId}
          visible={settingsOpen}
          onClose={() => setSettingsOrigin(undefined)}
          // Every screen in this stack is a view of the group that just stopped
          // existing, so popping one would only land on another of them. After
          // the panel has gone, since it's a modal.
          onDeleted={() => setTimeout(() => navigation.popToTop(), 250)}
          onOpenUser={openSettingsUser}
          onMessageAdmin={canMessageAdmin ? messageAdmin : undefined}
          onLeave={isMember ? leaveGroup : undefined}
        />
      </SummaryModal>

      {/* The menu closes before its choice runs, but the fade is still going
          — iOS won't present the next modal over one that's dismissing, and
          the Create screen is a modal too. */}
      <ActionSheet
        visible={postMenuOpen}
        onClose={() => setPostMenuOpen(false)}
        title="Post to group"
        message={group.title}
        options={[
          { label: 'Discussion', onPress: () => setTimeout(() => setCreateKind('discussion'), 300) },
          { label: 'Resource',   onPress: () => setTimeout(() => setCreateKind('resources'), 300) },
          // The full post form, with this group ticked and nothing else.
          { label: 'Post', onPress: () => setTimeout(() => (navigation as any).navigate('Create', { groupId }), 300) },
        ]}
      />

      {createKind && (
        <GroupCreateSheet
          kind={createKind}
          groupId={groupId}
          groupTitle={group.title}
          categories={createKind === 'discussion' ? DISCUSSION_CATEGORIES : createKind === 'news' ? NEWS_CATEGORIES : RESOURCE_CATEGORIES}
          visible
          onClose={() => setCreateKind(null)}
        />
      )}

      <GroupItemDetailModal
        visible={!!detailItem}
        item={detailItem?.data ?? null}
        kind={detailItem?.kind ?? null}
        categoryLabel={detailItem ? catLabel(detailItem.kind, detailItem.data?.category) : null}
        categories={detailItem ? CATEGORY_LISTS[detailItem.kind] : []}
        groupTitle={group.title}
        onClose={() => setDetailItem(null)}
      />

      <CarSummaryModal
        carId={carSummary?.carId ?? null}
        origin={carSummary?.origin}
        onClose={() => setCarSummary(null)}
      />

      <ListingSummaryModal
        listingId={listingSummary?.listingId ?? null}
        origin={listingSummary?.origin}
        omitGroupId={groupId}
        onClose={() => setListingSummary(null)}
      />

      <UserSummaryModal
        userId={userSummary?.userId ?? null}
        origin={userSummary?.origin}
        onClose={() => setUserSummary(null)}
      />

      <JoinRequestsPanel
        groupId={groupId}
        pending={pendingRequests}
        visible={requestsOrigin !== undefined}
        origin={requestsOrigin}
        onClose={() => setRequestsOrigin(undefined)}
      />

      <GroupInviteModal
        groupId={groupId}
        groupTitle={group.title}
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll:       { paddingBottom: 120 },

  panelHead:    {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingLeft: 16, paddingTop: 18, paddingBottom: 10,
    // Clear of the panel's floating close button (38pt, inset 12).
    paddingRight: 62,
  },
  panelTitle:   { fontSize: 19, fontFamily: FONT_INTER.bold },
  rosterMore:    { paddingVertical: 16, alignItems: 'center' },
  rosterMoreText:{ fontSize: 14, fontFamily: FONT_INTER.bold },

  bannerWrap:     { position: 'relative' },
  // Short enough to stay a header rather than a hero, while leaving the
  // floating app header and the overlaid title room to sit on the image.
  banner:         { width: '100%', aspectRatio: 5 / 3 },
  bannerTopScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%' },
  // Over half the banner: the eased ramp needs the distance, and it's what
  // keeps the fade from reading as a band across the photo.
  bannerFade:     { position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%' },
  bannerTitleWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'flex-end', gap: 12,
  },
  // The name takes what the actions leave it.
  bannerLead:     { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: 8 },
  bannerActions:  { alignItems: 'flex-end', gap: 8 },
  headerBtn:      {
    width: HEADER_BTN, height: HEADER_BTN, borderRadius: COMMON_RADIUS, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  groupTitle:     { fontSize: 26, lineHeight: 31, fontFamily: FONT_INTER.bold, letterSpacing: -0.4 },
  taglinePill:    {
    alignSelf: 'flex-start', borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  taglineText:    { fontSize: 12, fontFamily: FONT_INTER.semibold },

  requestsBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  // The same red bubble unread counts wear — this is the same kind of "waiting
  // on you".
  requestsCount: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLOR_RED,
  },
  requestsCountText: { fontSize: 12, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },
  requestsText:   { flex: 1, fontSize: 14, fontFamily: FONT_INTER.bold },
  requestsAction: { fontSize: 13, fontFamily: FONT_INTER.extrabold },

  membersStrip: { padding: 14, paddingTop: 0 },
  avatarRow:    { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  stripInvite:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999,
  },
  stripInviteText: { fontSize: 12, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },

  memberRow:    {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // The name column absorbs the squeeze so the follow button keeps its full
  // width on a long username.
  memberNameWrap: { flex: 1, minWidth: 0, gap: 3, alignItems: 'flex-start' },
  memberName:   { fontSize: 15, fontFamily: FONT_INTER.semibold },
  adminPill:    { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  adminPillText:{ fontSize: 10, fontFamily: FONT_INTER.extrabold },

  bodyBlock:    { padding: 16, paddingTop: 0, borderBottomWidth: 1, gap: 10, alignItems: 'flex-start' },
  // Beside the back and cog squares, at their height.
  postToBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: HEADER_BTN, paddingHorizontal: 12, borderRadius: COMMON_RADIUS,
  },
  postToText:   { fontSize: 13, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },
  bodyText:     { fontSize: 13, lineHeight: 19, width: '80%' },

  carsEmpty:     { paddingHorizontal: GUTTER, fontSize: 13, paddingVertical: 4 },

  // The app header's tab row, brought into the page. Opaque, since it sticks
  // over whatever scrolls under it.
  tabBar:       { paddingBottom: 0 },
  // Between the page and the app header (zIndex 20), so the header's
  // buttons stay on top of it.
  tabsOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 15, elevation: 15 },
  // The header's measures: its gap (wider on iOS, where GUTTER is narrow),
  // its start pad, its vertical padding.
  tabRow:       { flexDirection: 'row', alignItems: 'center', gap: Platform.OS === 'android' ? GUTTER : GUTTER * 4, paddingHorizontal: 12, paddingVertical: 10 },
  tabInner:     { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabLabel:     { fontSize: 17, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  // The unlit tabs a weight lighter, so the lit one leads.
  tabLabelIdle: { fontFamily: FONT_INTER.medium },
  // Always there, transparent when unlit, so every label sits at the same
  // height whichever tab is active. A touch thicker than a hairline so its
  // round ends show.
  tabUnderline: { height: 3, borderRadius: 999, marginTop: 1, overflow: 'hidden' },

  loader:       { marginVertical: 40 },
  rowTitle:     { fontSize: 15, fontFamily: FONT_INTER.bold, marginBottom: 3 },
  rowBody:      { fontSize: 13, lineHeight: 18, marginBottom: 3 },
  metaText:     { fontSize: 12 },
  rallyTag:     { fontSize: 10, fontFamily: FONT_INTER.extrabold, letterSpacing: 0.6, marginBottom: 2 },
  rowThumb:     { width: 72, height: 52, borderRadius: 8 },
  tabIntro:     {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: GUTTER, paddingTop: 10, paddingBottom: 2,
  },
  tabBlurb:     { flex: 1, fontSize: 13, lineHeight: 18 },
  viewAll:      {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingLeft: 10, paddingRight: 7, paddingVertical: 5,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
  },
  viewAllText:  { fontSize: 12, fontFamily: FONT_INTER.bold },
  // Solid where "All" is outlined: making is the louder of the two.
  newBtn:       {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingLeft: 8, paddingRight: 10, paddingVertical: 6,
    borderRadius: COMMON_RADIUS,
  },
  newBtnText:   { fontSize: 12, fontFamily: FONT_INTER.bold, color: COLOR_BLACK },
  // One shape for every item, whatever it holds.
  card:         {
    marginHorizontal: GUTTER, marginTop: 10,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  textCard:     { paddingHorizontal: 14, paddingVertical: 12, gap: 5 },
  cardBody:     { width: '90%', fontSize: 12, lineHeight: 17 },
  feedCard:     { paddingHorizontal: GUTTER, marginTop: 10 },
  // Room on the right for the avatar in the corner.
  cardTitle:    { marginBottom: 0, paddingRight: 46 },
  cardAvatar:   { position: 'absolute', top: 12, right: 12 },
  cardFoot:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  authorWhen:   { fontSize: 10, fontStyle: 'italic' },
  mediaRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 12 },
  gridRow:      { flexDirection: 'row', gap: 10, marginHorizontal: GUTTER, marginTop: 10 },
  // The Cars screen's mosaic: two columns, each card its photo's shape.
  mosaic:       { flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingTop: 10 },
  column:       { flex: 1 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet:         { maxHeight: '80%', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  sheetTitle:    { fontSize: 17, fontFamily: FONT_INTER.bold },
  sheetHint:     { fontSize: 13, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 },
  carPickRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  carPickThumb:  { width: 54, height: 40, borderRadius: 6 },
  carPickTitle:  { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
  carCheck:      { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
