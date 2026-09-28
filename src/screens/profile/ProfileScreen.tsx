import React, { useState, useRef, useEffect } from 'react';
import {
  View, StyleSheet, FlatList, TouchableOpacity, ScrollView, Alert, Modal, Animated, Pressable, Dimensions, ActivityIndicator,
} from 'react-native';
import { Text, TextInput } from '@ors/kit';
import { formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { Settings, Warehouse, Plus, MoreVertical, X, Search, Camera } from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetLoggedInUserQuery,
  useGetPublicUserByIdQuery,
  useGetPostsQuery,
  useGetCarsQuery,
  useGetRoutesQuery,
  useGetListsQuery,
  useGetUserFollowersQuery,
  useGetUserFollowingQuery,
  useBlockUserMutation,
  useUnblockUserMutation,
  useCreateReportMutation,
  useGetListingsQuery,
} from '../../api/apiService';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { addBlockedUser, removeBlockedUser } from '../../store/moderationSlice';
import Avatar from '../../components/ui/Avatar';
import AppHeader from '../../components/ui/AppHeader';
import { useScrollTopOnBack } from '../../hooks/useScrollTopOnBack';
import CarPosterCard from '../../components/cards/CarPosterCard';
import FollowButton from '../../components/social/FollowButton';
import ProfileHelpCard from '../../components/members/ProfileHelpCard';
import AskForPhotosButton from '../../components/cars/AskForPhotosButton';
import PhotoSpotShelf from '../../components/photography/PhotoSpotShelf';
import { PhotoSpotSummaryModal, PhotoSpotRow } from '@ors/kit/src/photography';
import { useGetPhotoSpotsQuery, type PhotoSpot } from '@ors/kit';
import GaragePanel from '../../components/cars/GaragePanel';
import GarageThumbs from '../../components/cars/GarageThumbs';
import SettingsPanel from '../../components/profile/SettingsPanel';
import { regionForCityState } from '../../constants/regions';
import { Shimmer } from '@ors/kit';
import { BannerSheet } from '../../components/members/ProfileSetupSheets';
import ListCard from '../../components/lists/ListCard';
import ListShelf, { LIST_SHELF_PREVIEW_COUNT } from '../../components/lists/ListShelf';
import ListSummaryModal from '../../components/lists/ListSummaryModal';
import { ProUpsellModal } from '../../components/pro/ProUpsell';
import {
  LIST_UPSELL,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_GRAY_23,
  COLOR_GRAY_30,
  COLOR_WHITE,
  COLOR_BORDER,
} from '../../constants/config';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { colors } from '../../constants/colors';
import SteeringWheel from '../../components/ui/SteeringWheel';
import RegionTile from '../../components/members/RegionTile';
import ProfileLinks from '../../components/members/ProfileLinks';
import PostStrip, { STRIP_PREVIEW_COUNT } from '../../components/social/PostStrip';
import RouteStrip, { ROUTE_STRIP_PREVIEW_COUNT } from '../../components/routes/RouteStrip';
import PollShelf, { POLL_SHELF_PREVIEW_COUNT } from '../../components/social/PollShelf';
import FeedItemCard from '../../components/cards/FeedItemCard';
import RoutesPane from '../../components/routes/RoutesPane';
import MemberListingsShelf from '../../components/marketplace/MemberListingsShelf';
import ListingCard, { LISTING_GRID_ROW } from '../../components/marketplace/ListingCard';
import ListingSummaryModal from '../../components/marketplace/ListingSummaryModal';
import type { SummaryOrigin } from '../../components/ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { imageUrl } from '../../utils/image';
import { postMediaList } from '../../utils/postMedia';
import PostMediaCarousel from '../../components/media/PostMediaCarousel';
import { useViewableIds } from '../../hooks/useViewableIds';
import { stripHtml } from '../../utils/text';
import type { AppStackParamList } from '../../navigation/types';
import type { GarageCar, Listing, Post, RouteListParams, User } from '../../types/api';
import { ss } from '../../styles/shared';
import RowEndSpacer from '../../components/ui/RowEndSpacer';
import { useRefreshControl } from '../../hooks/useRefreshControl';
import GroupAttribution from '../../components/groups/GroupAttribution';
import { FONT_INTER } from '../../constants/fonts'

type NavProp = NativeStackNavigationProp<AppStackParamList>;
// Cars and routes live on the page itself (see the garage section and the
// routes shelf), so they get no tile — but their "View all" opens a pane keyed
// the same way a tile's is.
// The marketplace sections are shelves too — see the three at the bottom of
// the page — so like routes they get a pane key without a tile.
// Polls are a shelf as well — their posts are in the Posts count too, but the
// shelf shows them with their choices, which the Posts cards don't.
type Tab = 'posts' | 'followers' | 'following' | 'lists' | 'routes'
  | 'forSale' | 'wants' | 'soldListings' | 'polls' | 'photoSpots';

const TABS: { key: Tab; label: string }[] = [
  { key: 'posts',     label: 'Posts' },
  { key: 'followers', label: 'Followers' },
  { key: 'following', label: 'Following' },
  { key: 'lists',     label: 'Lists' },
];

/**
 * What the pane's header calls each section. TABS covers the tiled ones; this
 * covers every section there is, tiled or not, so a pane opened from a shelf
 * isn't left with a blank title.
 */
const SECTION_LABELS: Record<Tab, string> = {
  posts:     'Posts',
  followers: 'Followers',
  following: 'Following',
  lists:     'Lists',
  routes:    'Routes',
  polls:     'Polls',
  forSale:      'For sale',
  wants:        'Want ads',
  soldListings: 'Sold',
  photoSpots:   'Photo spots',
};

// Garage carousel — cards stop short of full width so the next one peeks out.
/**
 * Membership badge colours, read from the raw palette rather than useColors():
 * that hook remaps `primaryAlt` to gold for a pro *viewer*, which would put a
 * gold badge on every member a pro browses. Gold is the pro mark, blue is
 * everyone else — and inside the component `colors` is the hook's, not this.
 */
const BADGE_PRO = colors.pro;
const BADGE_MEMBER = colors.primaryAlt;

/**
 * Wide enough for a five-figure follower count without wrapping, narrow enough
 * that a third card peeks in and says the row scrolls.
 */
const TILE_WIDTH = 118;

/** How many posts the "View all" pane pulls per page. */
const POSTS_PAGE_SIZE = 12;

/** The Posts pane's media shape — one for every card, whatever the photo. */
const POST_CARD_RATIO = 16 / 10;

/** The profile photo. The banner overlap, the ring and the badges all follow from it. */
const AVATAR_SIZE = 88;

/** The Pro ring's thickness around the photo. */
const PRO_RING = 5;
/**
 * How far the wheel and member-number badges hang past the photo's corners —
 * enough that they read as pinned to it rather than printed on it.
 */
const BADGE_OFFSET = -5;

/** How much of a bio shows before "… more". */
const BIO_LINES = 3;
/** Characters taken off the last kept line to make room for "… more". */
const BIO_MORE_ROOM = 8;

const GARAGE_GUTTER = 12;
const GARAGE_CARD_WIDTH = Dimensions.get('window').width * 0.9 - GARAGE_GUTTER;

function PostRow({ post, onPress, visible }: {
  post: Post;
  onPress: () => void;
  /** Whether the row is on screen, so its video stops when scrolled away. */
  visible?: boolean;
}) {
  const colors = useColors();
  // Photos and videos in the author's order — the same list the feed card
  // draws, so a video post shows its video here rather than a blank card.
  const media = postMediaList(post);
  const hasMedia = media.length > 0;
  const title = post.title ?? (post.body ? stripHtml(post.body) : null);
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  return (
    // A card with the picture on top rather than a row with a stamp beside it:
    // a post is mostly its photo, and at 58px it was a thumbnail of one.
    //
    // A View, not one card-wide touchable: the media is the feed's carousel,
    // which swipes between photos and plays a video where it sits, and a
    // touchable wrapped around it would take the first tap on a video and
    // leave for the post instead. A photo still opens the post, as do the words.
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {hasMedia ? (
        <PostMediaCarousel
          media={media}
          // The card's old fixed shape, so the pane's rows keep one rhythm
          // rather than each taking its photo's height.
          ratio={POST_CARD_RATIO}
          visible={visible}
          onPressItem={onPress}
        />
      ) : null}
      <TouchableOpacity style={styles.postCardBody} onPress={onPress} activeOpacity={0.85}>
        {title ? (
          <Text
            style={{ color: colors.fg, fontSize: hasMedia ? 15 : 17, fontFamily: FONT_INTER.bold, lineHeight: hasMedia ? 20 : 23 }}
            numberOfLines={hasMedia ? 2 : 4}
          >
            {title}
          </Text>
        ) : null}
        <Text style={{ color: colors.muted, fontSize: 12 }}>{timeAgo}</Text>
        {/* Same link the feed card carries, sized for a list. */}
        <GroupAttribution groupId={post.group_ids?.[0] ?? post.group_id} compact />
      </TouchableOpacity>
    </View>
  );
}

function UserRow({ user, onPress, currentUserId }: { user: User; onPress: () => void; currentUserId?: string }) {
  const colors = useColors();
  const dispatch = useAppDispatch();
  const [blockUser] = useBlockUserMutation();
  const [unblockUser] = useUnblockUserMutation();
  const [createReport] = useCreateReportMutation();
  const isBlocked = useAppSelector((s) => s.moderation.blockedUserIds.includes(user.user_id));

  const handleUnblock = () => {
    Alert.alert(
      'Unblock user',
      `Unblock @${user.username}? You'll be able to see each other's content again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await unblockUser({ blocked_id: user.user_id }).unwrap();
              dispatch(removeBlockedUser(user.user_id));
            } catch {
              Alert.alert('Error', 'Could not unblock user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleMorePress = () => {
    Alert.alert(
      `@${user.username}`,
      undefined,
      [
        {
          text: 'Block user',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Block user',
              `Block @${user.username}? They won't be able to see your content and you won't see theirs.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await blockUser({ blocked_id: user.user_id }).unwrap();
                      dispatch(addBlockedUser(user.user_id));                                   // hide their content instantly
                      createReport({ content_type: 'user', content_id: user.user_id }).catch(() => {}); // notify moderation
                      Alert.alert('Blocked', `@${user.username} has been blocked. You won't see their content anymore.`);
                    } catch {
                      Alert.alert('Error', 'Could not block user. Please try again.');
                    }
                  },
                },
              ]
            );
          },
        },
        {
          text: 'Report user',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Report user',
              `Report @${user.username} as inappropriate?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Report',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await createReport({ content_type: 'user', content_id: user.user_id }).unwrap();
                      Alert.alert('Reported', `@${user.username} has been reported for review.`);
                    } catch (err: any) {
                      if (err?.status === 409) {
                        Alert.alert('Already reported', 'You\'ve already reported this user.');
                      } else {
                        Alert.alert('Error', 'Could not report user. Please try again.');
                      }
                    }
                  },
                },
              ]
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  return (
    <TouchableOpacity
      style={[ss.listRow, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar user={user} size={44} />
      <Text style={[styles.userRowName, { color: colors.fg, flex: 1 }]}>@{user.username}</Text>
      {isBlocked ? (
        <>
          <View style={[styles.blockedPill, { backgroundColor: colors.red + '18' }]}>
            <Text style={[styles.blockedPillText, { color: colors.red }]}>Blocked</Text>
          </View>
          <TouchableOpacity
            style={[styles.unblockBtn, { borderColor: colors.border }]}
            onPress={handleUnblock}
            activeOpacity={0.7}
          >
            <Text style={[styles.unblockBtnText, { color: colors.primaryAlt }]}>Unblock</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {user.username && user.user_id !== currentUserId && (
            <FollowButton username={user.username} />
          )}
          {user.user_id !== currentUserId && (
            <TouchableOpacity onPress={handleMorePress} hitSlop={10} style={styles.moreBtn}>
              <MoreVertical size={18} color={colors.grey} />
            </TouchableOpacity>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const route = useRoute<any>();
  const paramUserId = route.params?.userId as string | undefined;
  const paramInitialTab = route.params?.initialTab as Tab | undefined;
  // The header's back button lands here at the top — see useScrollTopOnBack.
  const scrollRef = useRef<ScrollView>(null);
  useScrollTopOnBack(scrollRef);

  const navigation = useNavigation<NavProp>();
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  // The *viewer's* standing. It decides one thing on this page — whether "New
  // list" opens the form or the Pro pitch — and nothing about what they may see.
  const isPro = userInfo?.accountType === 'pro' || userInfo?.accountType === 'admin';
  const [activeSection, setActiveSection] = useState<Tab | null>(paramInitialTab ?? null);
  // Kept mounted through the slide-out so content doesn't vanish mid-animation.
  const [renderedSection, setRenderedSection] = useState<Tab | null>(paramInitialTab ?? null);
  const [userSearch, setUserSearch] = useState('');
  const [bioExpanded, setBioExpanded] = useState(false);
  /** The cover-photo sheet, opened from the camera button on an empty banner. */
  const [bannerSheet, setBannerSheet] = useState(false);
  /** The banner's garage and settings panels, and the buttons they grow from. */
  const garageBtnRef = useRef<View>(null);
  const [garageOpen, setGarageOpen] = useState(false);
  const [garageOrigin, setGarageOrigin] = useState<SummaryOrigin | null>(null);
  const settingsBtnRef = useRef<View>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsOrigin, setSettingsOrigin] = useState<SummaryOrigin | null>(null);
  /** Measures the pressed button first, so the panel grows out of it. */
  const openFrom = (
    ref: React.RefObject<View | null>,
    setOrigin: (o: SummaryOrigin | null) => void,
    setOpen: (v: boolean) => void,
  ) => {
    const node = ref.current;
    if (!node) { setOrigin(null); setOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setOrigin({ x, y, w, h });
      setOpen(true);
    });
  };
  /**
   * The listing panel, and the card it grows out of.
   *
   * Opened from a shelf directly, or from a pane — in which case the pane
   * closes first and this is set on the way out, because neither platform will
   * present a panel over a modal that is still up.
   */
  const [listingSummary, setListingSummary] =
    useState<{ id: string; origin: SummaryOrigin | null } | null>(null);
  /** The list panel — the same arrangement, for the same reason. */
  /** The photo spot whose summary is open, from the shelf or its pane. */
  const [spotSummaryId, setSpotSummaryId] = useState<string | null>(null);
  const [listSummary, setListSummary] =
    useState<{ id: string; origin: SummaryOrigin | null } | null>(null);
  /** "New list", pressed by a basic member: the pitch rather than a form the server will refuse. */
  const [listUpsell, setListUpsell] = useState(false);
  /** The bio's lines as laid out unclamped — measured once, then used to cut it. */
  const [bioLines, setBioLines] = useState<string[] | null>(null);
  // Which cards in the Posts pane are on screen, so a video stops when its
  // card scrolls out of the pane.
  const { listProps: postViewability, isVisible: isPostVisible } =
    useViewableIds<Post>((p) => p.internal_id);
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const [blockProfileUser] = useBlockUserMutation();
  const [reportProfileUser] = useCreateReportMutation();
  const sheetY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const sheetMounted = useRef(false);

  useEffect(() => {
    if (activeSection) {
      setRenderedSection(activeSection);
      if (activeSection === 'posts') { setPostsPage(0); setAllPosts([]); }
      setUserSearch('');
      sheetMounted.current = true;
      sheetY.setValue(600);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(sheetY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else if (sheetMounted.current) {
      Animated.parallel([
        Animated.timing(sheetY, { toValue: 600, duration: 220, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start(() => {
        sheetMounted.current = false;
        setRenderedSection(null);
      });
    }
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  // `initialTab` arriving on a screen that's already mounted — the dashboard's
  // "My lists" row, when this profile is the one underneath it. The useState
  // initialisers above only ever see the first value.
  useEffect(() => {
    if (paramInitialTab) setActiveSection(paramInitialTab);
  }, [paramInitialTab]);

  /**
   * Something to do once the pane has actually gone.
   *
   * The pane is a Modal that stays mounted through its 220ms slide-out, and a
   * second Modal presented in that window is presented *from* the first — a
   * view controller iOS is about to dismiss, which can take whatever it's
   * presenting down with it. Waiting for `renderedSection` to clear is waiting
   * for the unmount itself rather than guessing at its duration.
   */
  const afterPane = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (renderedSection !== null) return;
    const run = afterPane.current;
    afterPane.current = null;
    run?.();
  }, [renderedSection]);
  const closePaneThen = (fn: () => void) => { afterPane.current = fn; setActiveSection(null); };

  const isOwnProfile = !paramUserId || paramUserId === userInfo?.user_id;

  const { data: loggedInUser, isLoading: loadingOwn, refetch: refetchOwn } = useGetLoggedInUserQuery(undefined, { skip: !isOwnProfile });
  const { data: publicUser, isLoading: loadingOther, refetch: refetchOther } = useGetPublicUserByIdQuery(paramUserId!, { skip: isOwnProfile || !paramUserId });

  const user = isOwnProfile ? loggedInUser : publicUser;
  // The *viewed* profile's standing, not the viewer's — `isPro` above gates
  // what you're allowed to see, this is a badge on someone else.
  const viewedIsPro = (user as any)?.accountType === 'pro' || (user as any)?.accountType === 'admin';
  const isLoading = isOwnProfile ? loadingOwn : loadingOther;
  const userId = user?.user_id ?? '';

  // All sections fetched up front so the tiles can show counts and content is
  // ready the moment a tile opens its modal.
  const { data: postsData, refetch: refetchPosts } = useGetPostsQuery({ user_id: userId, limit: 30 }, { skip: !userId });

  /**
   * The posts of theirs that carry a poll — the Polls shelf, and its pane.
   *
   * `has_poll` is what makes the server resolve the viewer on this list (a
   * plain `user_id` list is cached without one), so `my_option_id` is right
   * here and a poll you've voted in shows its results rather than asking
   * again. One query at a generous limit for both the shelf and the pane: a
   * member's polls are a handful, not a feed.
   */
  const { data: pollsData, refetch: refetchPolls } = useGetPostsQuery(
    { user_id: userId, has_poll: true, limit: 50 },
    { skip: !userId },
  );

  // The Posts pane pages rather than stopping at whatever the strip's query
  // happened to fetch. Its own query so the strip and the counts aren't
  // refetched every time someone scrolls the pane.
  const [postsPage, setPostsPage] = useState(0);
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const { data: postsPageData, isFetching: postsFetching } = useGetPostsQuery(
    { user_id: userId, page: postsPage, limit: POSTS_PAGE_SIZE },
    { skip: !userId || renderedSection !== 'posts' },
  );

  useEffect(() => {
    if (!postsPageData?.entries) return;
    if (postsPage === 0) setAllPosts(postsPageData.entries);
    // Guarded on id: a post added while someone is paging would otherwise
    // shift the boundary and repeat a row.
    else setAllPosts((prev) => {
      const seen = new Set(prev.map((x) => x.internal_id));
      return [...prev, ...postsPageData.entries.filter((x) => !seen.has(x.internal_id))];
    });
  }, [postsPageData, postsPage]);
  const { data: carsData, refetch: refetchCars }  = useGetCarsQuery({ user_id: userId, limit: 24 }, { skip: !userId });
  // Their photography pins, newest first. The whole set rather than a page:
  // the endpoint has no count to go with a short page, and it's the map's
  // query — a member has tens of these, not thousands.
  const { data: spotsData } = useGetPhotoSpotsQuery({ user_id: userId, limit: 300 }, { skip: !userId });

  /**
   * The routes this person recorded.
   *
   * On your own profile the list is asked for with `scope=protected`, which is
   * the only way the API will part with a route you marked private or shared
   * into groups alone — your own page is the one place those belong, and
   * without them a drive you saved would simply be missing from your profile
   * with nothing to say why. The card marks each one Private so it's never
   * mistaken for something other people can see. Anyone else's profile gets
   * the plain list, which the server has already reduced to what reaches the
   * public — a private or group-only route is not in it to be filtered.
   *
   * One params object, shared with the pane, so the shelf and the full list
   * can't disagree about whose routes these are.
   */
  const routeParams: RouteListParams = isOwnProfile
    ? { scope: 'protected' }
    : { user_id: userId };
  const { data: routesData, refetch: refetchRoutes } = useGetRoutesQuery(
    { ...routeParams, limit: ROUTE_STRIP_PREVIEW_COUNT },
    { skip: !userId },
  );

  /**
   * What this member has on the marketplace.
   *
   * Three queries rather than one filtered three ways, because the browse
   * endpoint decides what "sold" means: it leaves sold listings out unless
   * asked for them by name. Each one only runs while its own pane is open —
   * the shelves on the page fetch their own six-item preview (see
   * MemberListingsShelf), and RTK caches the two separately.
   *
   * Sold is shown on anyone's profile, not just your own: on a marketplace
   * with no ratings, what somebody has actually sold is the reputation.
   */
  const listingPaneParams = { user_id: userId, sort: 'recent' as const, limit: 24 };
  const { data: forSalePane } = useGetListingsQuery(
    { ...listingPaneParams, kind: 'sale' },
    { skip: !userId || renderedSection !== 'forSale' },
  );
  const { data: wantsPane } = useGetListingsQuery(
    { ...listingPaneParams, kind: 'want' },
    { skip: !userId || renderedSection !== 'wants' },
  );
  const { data: soldPane } = useGetListingsQuery(
    { ...listingPaneParams, sold: 'true' },
    { skip: !userId || renderedSection !== 'soldListings' },
  );

  // The profile is the person plus their posts, garage and routes — the things
  // the page actually shows. The rest are counts behind tiles and come back
  // with the tags these invalidate.
  const refreshControl = useRefreshControl(() => Promise.all([
    isOwnProfile ? refetchOwn() : refetchOther(),
    refetchPosts(),
    refetchPolls(),
    refetchCars(),
    refetchRoutes(),
  ]));
  /**
   * Their lists — for anyone looking.
   *
   * This used to be skipped unless the *viewer* was Pro, which got the gate
   * backwards: making lists is the Pro feature, so the people who could never
   * see a Pro member's lists were exactly the basic members they were made to
   * be shown to. Reading is open; only "New list" asks about membership.
   *
   * `car_id: 'none'` leaves out the lists attached to a car. Those belong to
   * the car's page — "5 mods I want to do next year" beside "Top 5 designers"
   * here would be the garage leaking into the profile.
   */
  const { data: listsData }     = useGetListsQuery({ user_id: userId, car_id: 'none', limit: 50 }, { skip: !userId });
  const { data: followersData } = useGetUserFollowersQuery({ userId, limit: 50 }, { skip: !userId });
  const { data: followingData } = useGetUserFollowingQuery({ userId, limit: 50 }, { skip: !userId });

  if (isLoading || !user) return <Spinner fullScreen />;

  const handleProfileMenu = () => {
    Alert.alert(`@${user.username}`, undefined, [
      {
        text: 'Block user',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Block user',
          `Block @${user.username}? You won't see each other's content, messages, or notifications.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Block',
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockProfileUser({ blocked_id: user.user_id }).unwrap();
                  dispatch(addBlockedUser(user.user_id));                                        // hide their content instantly
                  reportProfileUser({ content_type: 'user', content_id: user.user_id }).catch(() => {}); // notify moderation
                  Alert.alert('Blocked', `@${user.username} has been blocked. You won't see their content anymore.`);
                  navigation.goBack();
                } catch {
                  Alert.alert('Error', 'Could not block user. Please try again.');
                }
              },
            },
          ]
        ),
      },
      {
        text: 'Report user',
        style: 'destructive',
        onPress: () => Alert.alert(
          'Report user',
          `Report @${user.username} as inappropriate?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Report',
              style: 'destructive',
              onPress: async () => {
                try {
                  await reportProfileUser({ content_type: 'user', content_id: user.user_id }).unwrap();
                  Alert.alert('Reported', 'Thanks — our team will review this user.');
                } catch (err: any) {
                  if (err?.status === 409) Alert.alert('Already reported', "You've already reported this user.");
                  else Alert.alert('Error', 'Could not report user. Please try again.');
                }
              },
            },
          ]
        ),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const bannerUri = user.banners?.[0]?.filename ? imageUrl(user.banners[0].filename) : null;
  const posts     = postsData?.entries ?? [];
  const polls     = pollsData?.entries ?? [];
  const cars      = carsData?.entries ?? [];
  const photoSpots = spotsData?.entries ?? [];
  const routes    = routesData?.entries ?? [];
  const lists     = listsData?.entries ?? [];
  const followers = followersData?.entries ?? [];
  const following = followingData?.entries ?? [];

  // Every profile uses the floating header over the cover image, so the screen
  // claims no top inset.
  const safeEdges: Edge[] = [];
  // Clear the floating tab bar. Computed rather than read via
  // useBottomTabBarHeight, which throws when this renders outside the tabs.
  const tabBarClearance = 88 + insets.bottom;
  const safeBg    = colors.cream;

  const countFor = (key: Tab): number => {
    switch (key) {
      case 'posts':     return postsData?.total ?? posts.length;
      case 'followers': return followersData?.total ?? followers.length;
      case 'following': return followingData?.total ?? following.length;
      case 'lists':     return listsData?.total ?? lists.length;
      // No tile of its own — the shelf below is the routes section — but the
      // switch answers for every section so it can't fall through.
      case 'routes':    return routesData?.total ?? routes.length;
      case 'polls':     return pollsData?.total ?? polls.length;
      // Shelves too, and their counts live on the shelf's own query rather
      // than here — nothing on this page asks for these.
      case 'forSale':      return forSalePane?.total ?? 0;
      case 'wants':        return wantsPane?.total ?? 0;
      case 'soldListings': return soldPane?.total ?? 0;
      case 'photoSpots':   return photoSpots.length;
    }
  };

  // The Lists tile is for profiles that have lists, plus your own — where an
  // empty one is the way in to making the first. On anyone else's profile a
  // "0 Lists" tile is a door onto an empty room.
  const visibleTabs = isOwnProfile || countFor('lists') > 0
    ? TABS
    : TABS.filter((t) => t.key !== 'lists');

  /** The form for a Pro member, the pitch for everyone else. Never both. */
  const startNewList = () => {
    if (isPro) (navigation as any).navigate('CreateList');
    else setListUpsell(true);
  };

  // ── Top chrome ─────────────────────────────────────────────────────────────
  // Identical chrome whether it's your profile or someone else's — the back
  // chevron is replaced by the header's own navigation (plus swipe-back).
  const topBar = <AppHeader />;

  // ── Section tiles — tap to open a modal with that section's content ───────
  const tilesEl = (
    // Sideways rather than a wrapping grid: a grid has to give every tile the
    // same slot and reflows into a ragged last row as tabs come and go — the
    // Lists tile only appears on profiles with lists, so that row is two-up
    // for some people and three-up for others. A strip just runs on, and
    // matches the garage and posts rows below it.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tilesRow}
      snapToInterval={TILE_WIDTH + 10}
      snapToAlignment="start"
      decelerationRate="fast"
    >
      {visibleTabs.map((t) => (
        <TouchableOpacity
          key={t.key}
          style={[styles.tile, { borderColor: colors.border }]}
          onPress={() => setActiveSection(t.key)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`${countFor(t.key)} ${t.label}`}
        >
          <Text style={[styles.tileCount, { color: colors.fg }]}>{countFor(t.key)}</Text>
          <Text style={[styles.tileLabel, { color: colors.grey }]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
      <RowEndSpacer width={12} />
    </ScrollView>
  );

  // ── Garage — lives on the page rather than behind a tile ──────────────────
  // A featured car (if any) leads at full width; the rest sit two-up beneath it.
  const featuredCar = cars.find((c) => c.featured);
  const restCars = featuredCar ? cars.filter((c) => c.internal_id !== featuredCar.internal_id) : cars;

  const garageEl = (
    <View style={styles.garageSection}>
      <View style={styles.garageHeader}>
        <Text style={[styles.garageTitle, { color: colors.fg }]}>Garage</Text>
        <Text style={[styles.garageCount, { color: colors.grey }]}>{carsData?.total ?? cars.length}</Text>
      </View>

      {cars.length === 0 ? (
        <EmptyState title="No cars yet" />
      ) : (
        <>
          {featuredCar && <CarPosterCard car={featuredCar} featured />}
          {/* A lone card gets the full width. In the carousel it stopped short
              to hint at a next card that doesn't exist, and the row it sat in
              had nowhere to scroll to. Covers a featured car plus one other,
              too — that carousel would hold the same single card. */}
          {restCars.length === 1 && <CarPosterCard car={restCars[0]} />}
          {restCars.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.garageCarousel}
              // Snaps card-by-card rather than page-by-page, so the peek stays put.
              snapToInterval={GARAGE_CARD_WIDTH + GARAGE_GUTTER}
              snapToAlignment="start"
              decelerationRate="fast"
            >
              {restCars.map((car: GarageCar) => (
                <View key={car.internal_id} style={styles.garageCarouselItem}>
                  {/* Nearly full-screen width, so it takes the full plate and
                      just drops its margins — `compact` scales the name down
                      for half-width grids, which these aren't. */}
                  <CarPosterCard car={car} style={styles.garageCarouselCard} />
                </View>
              ))}
              <RowEndSpacer width={GARAGE_GUTTER} />
            </ScrollView>
          )}
        </>
      )}
    </View>
  );

  // ── Profile header ────────────────────────────────────────────────────────
  const profileHeader = (
    <View>
      {/* Shorter without a cover photo: the tall banner exists to show a
          photograph, and given over to the stand-in it was a large grey slab
          above every profile that hasn't set one. */}
      <View style={[styles.bannerContainer, !bannerUri && styles.bannerContainerBare]}>
        {/* Same stand-in a car uses when it has no photo. */}
        <Image
          source={bannerUri ? { uri: bannerUri } : require('../../../assets/car-placeholder.jpg')}
          style={styles.banner}
          contentFit="cover"
        />
        {/* The stand-in, dimmed — it's a placeholder, and shouldn't be the
            brightest thing on a profile that hasn't chosen a cover. */}
        {!bannerUri && <View style={styles.bannerDim} pointerEvents="none" />}
        {/* Darkens the top of the cover so the floating header reads over it. */}
        <LinearGradient
          colors={['rgba(0,0,0,0.6)', 'rgba(0,0,0,0)']}
          style={styles.bannerScrim}
          pointerEvents="none"
        />

        {/* Shortcuts on the cover rather than in a row of their own — the
            avatar overlaps only the bottom-left of the banner, so this corner
            is free. The garage is anyone's to look in; the camera and the cog
            are yours alone. Both panels open in place. */}
        {(isOwnProfile || cars.length > 0) && (
          <View style={styles.bannerActions}>
            {/* The header's garage door, here too: their cars' photos beside
                the icon, and a tap opens the garage summary in place rather
                than leaving the profile. */}
            <View ref={garageBtnRef} collapsable={false}>
              <TouchableOpacity
                style={[styles.bannerIconBtn, cars.length > 0 && styles.bannerGarageBtn]}
                onPress={() => openFrom(garageBtnRef, setGarageOrigin, setGarageOpen)}
                accessibilityRole="button"
                accessibilityLabel={isOwnProfile ? 'Your garage' : `@${user.username}'s garage`}
              >
                <Warehouse size={19} color={COLOR_WHITE} />
                <GarageThumbs cars={cars} />
              </TouchableOpacity>
            </View>
            {/* Only while there's nothing there — once a cover is set, the
                photo is the thing, and changing it lives in Settings. */}
            {isOwnProfile && !bannerUri && (
              <TouchableOpacity
                style={styles.bannerIconBtn}
                onPress={() => setBannerSheet(true)}
                accessibilityRole="button"
                accessibilityLabel="Add a cover photo"
              >
                <Camera size={19} color={COLOR_WHITE} />
              </TouchableOpacity>
            )}
            {isOwnProfile && (
              <View ref={settingsBtnRef} collapsable={false}>
                <TouchableOpacity
                  style={styles.bannerIconBtn}
                  onPress={() => openFrom(settingsBtnRef, setSettingsOrigin, setSettingsOpen)}
                  accessibilityRole="button"
                  accessibilityLabel="Settings"
                >
                  <Settings size={19} color={COLOR_WHITE} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
      <View style={styles.avatarRow}>
        {/* The ring and the badge ride on a box outside the avatar: the avatar
            itself clips to a circle, so a badge inside it would be cut in half.
            Same gold ring and wheel a pro member gets in the member list. */}
        <View style={styles.avatarBox}>
          {/* A Pro member's ring is the Pro buttons' gold, oil-slick sheen and
              passing shine included, rather than a flat stroke. The ring is the fill showing around the photo;
              the badges stay outside it, since it clips to its own circle. */}
          {viewedIsPro ? (
            <Shimmer
              radius={AVATAR_SIZE / 2 + PRO_RING}
              color={colors.pro}
              tone="warm"
              style={styles.proRing}
            >
              <View style={styles.avatarWrap}>
                <Avatar user={user} size={AVATAR_SIZE} />
              </View>
            </Shimmer>
          ) : (
            <View style={styles.avatarWrap}>
              <Avatar user={user} size={AVATAR_SIZE} />
            </View>
          )}
          {viewedIsPro && (
            <View style={styles.proWheel}>
              <SteeringWheel size={24} color={COLOR_BLACK} strokeWidth={2.5} />
            </View>
          )}
          {/* Membership number, worn on the photo like the pro wheel — opposite
              corner so the two never sit on top of each other. */}
          {user.memberNumber ? (
            // Gold is the pro mark — the wheel beside it says the same thing.
            <View style={[
              styles.memberBadge,
              { backgroundColor: viewedIsPro ? BADGE_PRO : BADGE_MEMBER },
            ]}>
              <Text
                style={[styles.memberBadgeText, { color: COLOR_BLACK }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {user.memberNumber}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Beside the photo rather than under it — the two are one
            introduction, and the name had been sitting a block away from the
            face it belongs to. */}
        <View style={styles.identity}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            @{user.username}
          </Text>
        </View>
      </View>

      {/* Their own row: with the name taking the space beside the avatar,
          Follow / Message / ⋮ no longer fit alongside it. */}
      {!isOwnProfile && (
        <View style={styles.actionsRow}>
          <View style={styles.followRow}>
            {/* Squared off to match Message and the ⋮ beside it — a pill next
                to two 8pt corners read as a different kind of control. */}
            {/* Darker than the app's usual grey, in step with the tiles below.
                Wrapped so it can take half the row: Button has no style prop,
                and a column child stretches to its parent's width. */}
            <View style={styles.actionGrow}>
              <FollowButton username={user.username} radius={8} followingBackground={COLOR_GRAY_30} />
            </View>
            <TouchableOpacity
              style={[styles.msgBtn, styles.actionGrow, { borderColor: colors.border }]}
              onPress={() => navigation.navigate('ComposeMessage', { userId: user.user_id, username: user.username })}
            >
              <Text style={[styles.msgBtnText, { color: colors.fg }]}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.profileMenuBtn, { borderColor: colors.border }]}
              onPress={handleProfileMenu}
              hitSlop={8}
            >
              <MoreVertical size={18} color={colors.fg} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.info}>
        {user.bio ? (
          <View style={styles.bioWrap}>
            {/* "… more" sits at the end of the third line, not on a line of its
                own. RN's own ellipsis can't be followed by anything, so the
                clamp is done by hand: laid out once in full to learn where the
                lines break, then the first three are kept, with the last one
                shortened to leave room for the link. */}
            <Text
              style={[styles.bio, { color: colors.muted }]}
              onTextLayout={bioLines == null ? (e) => setBioLines(e.nativeEvent.lines.map((l) => l.text)) : undefined}
            >
              {bioLines && bioLines.length > BIO_LINES && !bioExpanded ? (
                <>
                  {bioLines.slice(0, BIO_LINES - 1).join('')}
                  {bioLines[BIO_LINES - 1].trimEnd().slice(0, -BIO_MORE_ROOM).trimEnd()}
                  {'… '}
                  <Text style={[styles.moreLink, { color: colors.grey }]} onPress={() => setBioExpanded(true)}>More</Text>
                </>
              ) : (
                <>
                  {stripHtml(user.bio)}
                  {bioLines && bioLines.length > BIO_LINES ? (
                    <>
                      {' '}
                      <Text style={[styles.moreLink, { color: colors.grey }]} onPress={() => setBioExpanded(false)}>Less</Text>
                    </>
                  ) : null}
                </>
              )}
            </Text>
          </View>
        ) : null}

        {/* Their own links, under the bio they belong to. */}
        <ProfileLinks links={user.links} />

        {/* Yours: what's still missing — a photo, a bio, a car, anyone to
            follow — each finished without leaving the page. Nothing once done. */}
        {isOwnProfile && (
          <ProfileHelpCard carCount={carsData?.total ?? cars.length} followingCount={countFor('following')} />
        )}
        {/* Someone else's, with no photo: ask them for one. */}
        {!isOwnProfile && !!userInfo && !user.gallery?.length && !(user as any).profilePicture && (
          <AskForPhotosButton kind="profile" userId={user.user_id} ownerName={user.username} />
        )}
      </View>

      {/* Renders nothing until the server has one for them. A picture, not a
          button — no onPress, so no chevron and nothing to tap. The country
          tile beside it is lit in their colour, like their member badge. */}
      <RegionTile
        filename={(user as any)?.regionMap?.filename}
        cityState={(user as any)?.cityState}
        region={regionForCityState((user as any)?.cityState)?.key}
        regionColor={viewedIsPro ? BADGE_PRO : BADGE_MEMBER}
      />
    </View>
  );

  // ── Navigate helpers that also dismiss the modal ──────────────────────────
  const openAndClose = (fn: () => void) => { setActiveSection(null); fn(); };

  // ── Modal content per section ─────────────────────────────────────────────
  const renderSectionContent = () => {
    switch (renderedSection) {
      case 'posts': {
        const total = postsPageData?.total ?? postsData?.total ?? 0;
        // Falls back to the strip's own list until the first page lands, so
        // opening the pane doesn't flash empty.
        const shown = allPosts.length > 0 ? allPosts : posts;
        return (
          <FlatList
            data={shown}
            keyExtractor={(p: Post) => p.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            {...postViewability}
            renderItem={({ item }) => (
              <PostRow
                post={item}
                visible={isPostVisible(item.internal_id)}
                onPress={() => openAndClose(() => (navigation as any).navigate('PostDetailModal', { postId: item.internal_id }))}
              />
            )}
            onEndReachedThreshold={0.4}
            onEndReached={() => {
              if (!postsFetching && shown.length < total) setPostsPage((p) => p + 1);
            }}
            ListFooterComponent={
              postsFetching && shown.length > 0
                ? <ActivityIndicator style={styles.listFooter} color={colors.primaryAlt} />
                : null
            }
            ListEmptyComponent={<EmptyState title="No posts yet" />}
          />
        );
      }
      case 'routes':
        // Its own scroller, unlike the FlatList panes either side of it —
        // RoutesPane pages by a button and leaves scrolling to its host.
        return (
          <ScrollView contentContainerStyle={styles.modalList} showsVerticalScrollIndicator={false}>
            <RoutesPane
              params={routeParams}
              emptyTitle="No routes yet"
              // The detail is a native-stack modal and this pane is an RN
              // <Modal>; iOS won't present one over the other, so the pane
              // closes on the way out.
              onRoutePress={(r) => openAndClose(() => (navigation as any).navigate('RouteDetailModal', { routeId: r.internal_id }))}
            />
          </ScrollView>
        );
      case 'photoSpots':
        // The map's own rows. A spot's summary is its own modal, so the pane
        // closes on the way — see 'routes'.
        return (
          <FlatList
            data={photoSpots}
            keyExtractor={(s: PhotoSpot) => s.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <PhotoSpotRow spot={item} onPress={(s) => openAndClose(() => setSpotSummaryId(s.internal_id))} />
            )}
            ListEmptyComponent={<EmptyState title="No photo spots yet" />}
          />
        );
      case 'polls':
        // The feed's own cards, full width, so every poll can be answered
        // from the list. Opening one closes the pane first — see 'posts'.
        return (
          <FlatList
            data={polls}
            keyExtractor={(p: Post) => p.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              // Inset to the gutter the Posts pane's cards keep, so the two
              // panes line up; the card brings its own corners.
              <View style={styles.pollRow}>
                <FeedItemCard
                  post={item}
                  onPress={() => openAndClose(() => (navigation as any).navigate('PostDetailModal', { postId: item.internal_id }))}
                  onCommentPress={() => openAndClose(() => (navigation as any).navigate('PostDetailModal', { postId: item.internal_id }))}
                />
              </View>
            )}
            ListEmptyComponent={<EmptyState title="No polls yet" />}
          />
        );
      case 'forSale':
      case 'wants':
      case 'soldListings': {
        const source = renderedSection === 'forSale' ? forSalePane
          : renderedSection === 'wants' ? wantsPane
            : soldPane;
        return (
          <FlatList
            data={source?.entries ?? []}
            keyExtractor={(l: Listing) => l.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            numColumns={2}
            columnWrapperStyle={LISTING_GRID_ROW}
            renderItem={({ item }) => (
              // The browse screen's own card and grid, so a listing looks the
              // same wherever it's met. The panel it opens can't be presented over
              // this pane, so the pane closes first and the panel opens after.
              <ListingCard
                listing={item}
                onPress={(origin) => openAndClose(() => setListingSummary({ id: item.internal_id, origin }))}
              />
            )}
            ListEmptyComponent={
              <EmptyState title={
                renderedSection === 'forSale' ? 'Nothing for sale'
                  : renderedSection === 'wants' ? 'No want ads'
                    : 'Nothing sold yet'
              } />
            }
          />
        );
      }
      case 'followers':
      case 'following': {
        const source = renderedSection === 'followers' ? followers : following;
        const q = userSearch.trim().toLowerCase();
        const data = q ? source.filter((u) => (u.username ?? '').toLowerCase().includes(q)) : source;
        return (
          <FlatList
            data={data}
            keyExtractor={(u: User) => u.user_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <View style={[styles.userSearchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={15} color={colors.grey} />
                <TextInput
                  style={[styles.userSearchInput, { color: colors.fg }]}
                  value={userSearch}
                  onChangeText={setUserSearch}
                  placeholder="Search by username..."
                  placeholderTextColor={colors.grey}
                  autoCapitalize="none"
                />
              </View>
            }
            renderItem={({ item }) => (
              <UserRow
                user={item}
                currentUserId={userInfo?.user_id}
                onPress={() => openAndClose(() => (navigation as any).navigate('UserDetail', { userId: item.user_id, username: item.username }))}
              />
            )}
            ListEmptyComponent={
              <EmptyState title={q ? 'No users match' : (renderedSection === 'followers' ? 'No followers yet' : 'Not following anyone yet')} />
            }
          />
        );
      }
      case 'lists':
        return (
          <FlatList
            data={lists}
            keyExtractor={(l: any) => l.internal_id}
            contentContainerStyle={styles.modalList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              isOwnProfile ? (
                <TouchableOpacity
                  style={[styles.newListBtn, { backgroundColor: colors.primaryAlt }]}
                  onPress={() => closePaneThen(startNewList)}
                >
                  <Plus size={16} color={COLOR_WHITE} />
                  <Text style={styles.newListBtnText}>New List</Text>
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => (
              // The panel can't be presented over this pane, so the pane goes
              // first and the panel opens once it has — see closePaneThen.
              <ListCard
                list={item}
                onPress={(l, origin) => closePaneThen(() => setListSummary({ id: l.internal_id, origin }))}
              />
            )}
            ListEmptyComponent={<EmptyState title="No lists yet" />}
          />
        );
      default:
        return null;
    }
  };

  const activeLabel = renderedSection ? SECTION_LABELS[renderedSection] : '';

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: safeBg }]} edges={safeEdges}>
      {topBar}
      <ScrollView
        ref={scrollRef}
        refreshControl={refreshControl}
        style={{ backgroundColor: colors.cream }}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarClearance + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {profileHeader}
        {tilesEl}
        {garageEl}
        {/* Their posts, the same shape as the garage above it. "View all"
            opens the same pane the Posts tile does. */}
        <PostStrip
          title="Posts"
          posts={posts.slice(0, STRIP_PREVIEW_COUNT)}
          total={postsData?.total ?? posts.length}
          // Every post here is theirs, so a byline on each card would just be
          // the same name six times.
          showByline={false}
          // Same shade as the section tiles, so the page's surfaces agree.
          cardBackground={COLOR_GRAY_23}
          onPostPress={(post) => (navigation as any).navigate('PostDetailModal', { postId: post.internal_id })}
          onViewAll={() => setActiveSection('posts')}
        />
        {/* The questions they've asked, drawn as the feed draws them so the
            choices show and can be picked. Nothing at all when there are
            none — see PollShelf. */}
        <PollShelf
          title="Polls"
          posts={polls.slice(0, POLL_SHELF_PREVIEW_COUNT)}
          total={pollsData?.total ?? polls.length}
          onPostPress={(post) => (navigation as any).navigate('PostDetailModal', { postId: post.internal_id })}
          onViewAll={() => setActiveSection('polls')}
        />
        {/* The drives they've recorded, the same shape as the posts shelf
            above it. Renders nothing at all when there are none — see
            RouteStrip. */}
        <RouteStrip
          title="Routes"
          routes={routes}
          total={routesData?.total ?? routes.length}
          onViewAll={() => setActiveSection('routes')}
        />
        {/* What they've ranked and collected. Nothing at all when there are
            none — except on your own profile as a Pro member, where the empty
            shelf is the invitation. A basic member's way in is the Lists tile,
            which leads to the pitch; a standing "New list" here that only ever
            opened an advert would be the app nagging them on their own page. */}
        <ListShelf
          title="Lists"
          lists={lists.slice(0, LIST_SHELF_PREVIEW_COUNT)}
          total={listsData?.total ?? lists.length}
          onListPress={(l, origin) => setListSummary({ id: l.internal_id, origin })}
          onViewAll={() => setActiveSection('lists')}
          onAdd={isOwnProfile && isPro ? startNewList : undefined}
          emptyHint="Your top five anything — designers, roads, the cars you'd own tomorrow."
        />
        {/* The places they've pinned for photographs. Nothing when there are
            none — see PhotoSpotShelf. */}
        <PhotoSpotShelf
          spots={photoSpots}
          total={photoSpots.length}
          onSpotPress={(s) => setSpotSummaryId(s.internal_id)}
          onViewAll={() => setActiveSection('photoSpots')}
        />
        {/* Their marketplace, in the three piles it splits into. Each shelf
            renders nothing when it's empty, so a member who has never sold
            anything gets no marketplace section at all rather than three
            headings over three blanks. */}
        <MemberListingsShelf
          userId={userId}
          title="For sale"
          kind="sale"
          onViewAll={() => setActiveSection('forSale')}
          onListingPress={(l) => setListingSummary({ id: l.internal_id, origin: null })}
        />
        <MemberListingsShelf
          userId={userId}
          title="Want ads"
          kind="want"
          onViewAll={() => setActiveSection('wants')}
          onListingPress={(l) => setListingSummary({ id: l.internal_id, origin: null })}
        />
        <MemberListingsShelf
          userId={userId}
          title="Sold"
          sold
          onViewAll={() => setActiveSection('soldListings')}
          onListingPress={(l) => setListingSummary({ id: l.internal_id, origin: null })}
        />
      </ScrollView>

      <Modal
        visible={!!renderedSection}
        transparent
        animationType="none"
        onRequestClose={() => setActiveSection(null)}
      >
        <View style={styles.modalBackdrop}>
          {/* Fixed overlay — fades in/out, never slides */}
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)', opacity: overlayOpacity }]}
            pointerEvents="none"
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setActiveSection(null)} />
          {/* Sheet — slides up */}
          <Animated.View style={[styles.sheet, { backgroundColor: colors.cream, transform: [{ translateY: sheetY }] }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.sheetTitle, { color: colors.fg }]}>{activeLabel}</Text>
              <TouchableOpacity onPress={() => setActiveSection(null)} hitSlop={8}>
                <X size={22} color={colors.grey} />
              </TouchableOpacity>
            </View>
            <View style={ss.fill}>{renderSectionContent()}</View>
          </Animated.View>
        </View>
      </Modal>

      {/* The listing panel, shared with the marketplace — including its
          "message the seller" button, which is the marketplace's own
          conversation and not this app's inbox. */}
      <ListingSummaryModal
        listingId={listingSummary?.id ?? null}
        origin={listingSummary?.origin}
        onClose={() => setListingSummary(null)}
      />

      {/* A list, read in place — open to every viewer. Its Edit button only
          appears for the author, whatever their membership is now. */}
      <ListSummaryModal
        listId={listSummary?.id ?? null}
        origin={listSummary?.origin}
        onClose={() => setListSummary(null)}
      />

      {/* The same summary a pin on the map opens; the pinner gets its Edit. */}
      <PhotoSpotSummaryModal
        spotId={spotSummaryId}
        onClose={() => setSpotSummaryId(null)}
        onEdit={(id) => (navigation as any).navigate('PhotoSpotCreate', { spotId: id })}
      />

      <ProUpsellModal
        visible={listUpsell}
        onClose={() => setListUpsell(false)}
        title={LIST_UPSELL.title}
        message={LIST_UPSELL.message}
      />

      {/* Saving invalidates the profile, so the banner fills and goes back to
          full height on its own — nothing here has to refresh it by hand. */}
      <BannerSheet visible={bannerSheet} onClose={() => setBannerSheet(false)} />
      <GaragePanel
        visible={garageOpen}
        origin={garageOrigin}
        onClose={() => setGarageOpen(false)}
        owner={{ user_id: user.user_id, username: user.username }}
      />
      {isOwnProfile && (
        <SettingsPanel visible={settingsOpen} origin={settingsOrigin} onClose={() => setSettingsOpen(false)} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list:            { paddingBottom: 24 },
  // Taller than a classic cover strip because the floating header sits over its
  // top portion — this keeps a usable amount of image visible beneath it.
  // 10/9 is the old 5/3 with 50% more height.
  bannerContainer: { width: '100%', aspectRatio: 10 / 8 },
  // Still deep enough for the floating header to sit over, and for the avatar
  // to overlap by half its height — just not a photo's worth of height. The old
  // 10/4 plus 100: at 10/4 the stand-in read as a strip, not a cover.
  bannerContainerBare: { aspectRatio: undefined, height: Dimensions.get('window').width * 0.4 + 100 },
  banner:          { width: '100%', height: '100%' },
  // Written out: RN 0.86 removed `StyleSheet.absoluteFillObject`, and spreading
  // it yields {} — the dim would have no size and silently not show.
  bannerDim:       { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)' },
  // Neutral, not brand-colored — at this height a solid accent block dominates
  // the screen for anyone without a cover image.
  bannerScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  avatarRow:       { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 16, marginTop: -AVATAR_SIZE / 2 },
  // Sits on the avatar's baseline, with a little lift so it reads level with
  // the photo rather than hanging off its bottom edge.
  identity:        { flex: 1, minWidth: 0, paddingBottom: 10 },
  actionsRow:      { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 12 },
  // Clear of the avatar, which overlaps the banner's bottom-left by half its height.
  bannerActions:   { position: 'absolute', right: 12, bottom: 12, flexDirection: 'row', gap: 8 },
  bannerIconBtn:   {
    width: 38, height: 38, borderRadius: COMMON_RADIUS,
    // Near-solid: at half black the buttons went muddy over a bright cover.
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLOR_BORDER,
    alignItems: 'center', justifyContent: 'center',
  },
  // Widens to hold the car photos beside the door, as the header's does.
  bannerGarageBtn: { width: undefined, flexDirection: 'row', gap: 6, paddingHorizontal: 9 },
  avatarBox:       { position: 'relative' },
  // Pads out to hold the ring clear of the photo, so the avatar reads at the
  // same AVATAR_SIZE either way.
  proRing:         { padding: PRO_RING },
  proWheel: {
    position: 'absolute', bottom: BADGE_OFFSET, right: BADGE_OFFSET,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.pro,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarWrap:      {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: colors.primaryAlt,
    shadowColor: COLOR_BLACK, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn:       {
    width: 36, height: 36, borderRadius: COMMON_RADIUS, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  // Follow and Message split the width between them; the ⋮ keeps its size.
  followRow:  { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  actionGrow: { flex: 1 },
  msgBtn:     { borderWidth: 1.5, borderRadius: COMMON_RADIUS, paddingHorizontal: 14, paddingVertical: 6, alignItems: 'center' },
  msgBtnText: { fontSize: 14, fontFamily: FONT_INTER.semibold },
  profileMenuBtn: { borderWidth: 1.5, borderRadius: COMMON_RADIUS, paddingHorizontal: 8, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  info:       { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 3 },
  name:       { fontSize: 19, fontFamily: FONT_INTER.semibold },
  // Bottom-left of the photo — the pro wheel owns the bottom-right. A true
  // circle: fixed on both axes rather than stretched by its padding, so a
  // three-digit number and a one-digit number are the same shape. Long numbers
  // scale their text down instead of pulling it into an oval.
  memberBadge: {
    position: 'absolute', bottom: BADGE_OFFSET, left: BADGE_OFFSET,
    width: 32, height: 32, borderRadius: PILL_RADIUS,
    alignItems: 'center', justifyContent: 'center',
  },
  memberBadgeText: {
    fontSize: 12, fontFamily: FONT_INTER.extrabold,
    textAlign: 'center', paddingHorizontal: 2,
  },
  username:   { fontSize: 14, marginTop: 2 },
  bioWrap:    { marginTop: 8, marginBottom: 14 },
  bio:        { fontSize: 14, lineHeight: 20 },
  moreLink:   { fontSize: 13, fontFamily: FONT_INTER.bold, textDecorationLine: 'underline' },
  location:   { fontSize: 13, marginTop: 4 },
  tilesRow:   { paddingLeft: 12, paddingTop: 4, gap: 10 },
  tile:       {
    width: TILE_WIDTH,
    // A step under the card colour (#1e1e1e): a row of them at full card
    // brightness outweighed the profile they sit under.
    backgroundColor: COLOR_GRAY_23,
    borderRadius: 12, borderWidth: 1,
    paddingVertical: 16, paddingHorizontal: 14,
    alignItems: 'center', justifyContent: 'center', gap: 2,
  },
  tileCount:  { fontSize: 22, fontFamily: FONT_INTER.bold },
  tileLabel:  { fontSize: 12, fontFamily: FONT_INTER.bold, letterSpacing: 0.3, textTransform: 'uppercase' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet:         { height: '85%', borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  sheetHandle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 },
  sheetHeader:   {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1,
  },
  sheetTitle:    { fontSize: 17, fontFamily: FONT_INTER.bold },
  listFooter:    { paddingVertical: 18 },
  modalList:     { paddingBottom: 32 },
  userSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 12, paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 10, borderWidth: 1,
  },
  userSearchInput: { flex: 1, fontSize: 14 },

  pollRow:  { marginHorizontal: 12 },
  postCard: {
    marginHorizontal: 12, marginTop: 10,
    borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden',
  },
  postCardBody:  { padding: 12, gap: 4 },

  garageSection: { marginTop: 18 },
  garageHeader:  {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 6,
  },
  garageTitle:   { fontSize: 18, fontFamily: FONT_INTER.bold },
  garageCount:   { fontSize: 14, fontFamily: FONT_INTER.bold },
  garageCarousel: {
    // Vertical padding so the glow under each card has somewhere to fall —
    // without it the ScrollView clips its content bounds and the shadow stops
    // dead at the bottom edge of the card.
    gap: GARAGE_GUTTER, paddingLeft: GARAGE_GUTTER,
    paddingTop: 10, paddingBottom: 16,
  },
  garageCarouselItem: { width: GARAGE_CARD_WIDTH },
  garageCarouselCard: { marginHorizontal: 0, marginVertical: 0 },
  newListBtn:    {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start', marginHorizontal: 12, marginBottom: 12, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: COMMON_RADIUS,
  },
  newListBtnText:  { color: COLOR_WHITE, fontSize: 14, fontFamily: FONT_INTER.semibold },
  userRowText:     { flex: 1 },
  userRowName:     { fontSize: 15, fontFamily: FONT_INTER.semibold },
  userRowUsername: { fontSize: 13, marginTop: 1 },
  moreBtn:         { padding: 4, marginLeft: 4 },
  blockedPill:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: PILL_RADIUS },
  blockedPillText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  unblockBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: COMMON_RADIUS, borderWidth: 1, marginLeft: 8 },
  unblockBtnText:  { fontSize: 13, fontFamily: FONT_INTER.bold },
});
