import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView,
  Linking, Dimensions, Platform, Alert,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useGetPhotoSpotsQuery } from '@ors/kit';
import {
  Car, Users, ShoppingBag, BookOpen, Flag, X, ChevronRight, Store, Route, UserRound, Bell, BellRing, Info, CalendarCheck, Mail, Package, LifeBuoy, Camera, UserPlus, Settings,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogOut } from 'lucide-react-native';
import Avatar from './Avatar';
import GrowPanel, { type GrowOrigin } from './GrowPanel';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { useGetUnreadNotificationCountQuery, useGetMyEventsCountQuery } from '../../api/apiService';
import { useMarketplaceUnread } from '../marketplace/MarketplaceUnreadBadge';
import MyEventsSheet from '../society/MyEventsSheet';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { colors } from '../../constants/colors';
import { InstagramIcon, DiscordIcon, YouTubeIcon } from './BrandIcons';
import { CONFIG } from '../../constants/config';
import { APP_VERSION } from '../../utils/appVersion';
import { ProUpsellModal } from '../pro/ProUpsell';
import InviteFriendModal from '../members/InviteFriendModal';
import ProfileSetupCard from '../members/ProfileSetupCard';
import { CarCreateSheet } from '../../screens/garage/CarCreateScreen';
import { SummaryTouchable, type SummaryOrigin } from './SummaryModal';
import SteeringWheel from './SteeringWheel';
import { imageUrl } from '../../utils/image';
import WhatsNewButton from './WhatsNew';
import { logout } from '../../store/authSlice';
import { useIsPro } from '../../hooks/useBrandColor';
import { ss } from '../../styles/shared';
import type { AppStackParamList } from '../../navigation/types';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

type NavProp = NativeStackNavigationProp<AppStackParamList>;

/**
 * The panel is the screen.
 *
 * It went 85% → 92%-capped-at-400 → all of it, each time for the same reason:
 * the two-up tiles were too narrow and the longer labels wrapped. There is no
 * width left to find, and a sliver of the feed showing down one edge was never
 * doing anything except making the menu feel like a drawer you had to hold
 * open. Full width also means the tiles can be sized from the real screen
 * rather than from a cap that stopped matching phones years ago.
 */
/**
 * The panel is nine tenths of the screen now, not all of it — the tiles are
 * sized off that, or the pair overflows the row and wraps to one per line.
 */
/** How much of the screen the open panel takes; the content scrolls inside. */
const PANEL_RATIO = 0.9;
const PANEL_WIDTH = Dimensions.get('window').width * PANEL_RATIO;
/**
 * Half the row, minus the 8px gutter — and a pixel of slack, so a rounding
 * error can't overflow the row and wrap the tiles to one per line.
 */
const TILE_WIDTH = Math.floor((PANEL_WIDTH - 32 - 8) / 2) - 1;

/**
 * Your Events is parked, not removed.
 *
 * Everything behind it still works — the count query, the sheet, the tap that
 * opens it — so this is one word away from coming back. Home went for good:
 * the feed is what closing the menu returns you to, so a tile for it was a
 * second way to do nothing.
 */
const SHOW_YOUR_EVENTS = false;

/**
 * The merch shop.
 *
 * Back on now that it has products of its own to sell — it lists from
 * horacio's /api/product and hands the buyer to the web to pay.
 */
const SHOW_SHOP = true;

/**
 * Dark palette, matched to the web drawer: white-on-dark rather than derived
 * from the brand fill.
 *
 * The panel was once translucent glass over the blurred app. Android never
 * sold it — expo-blur falls back to a thin scrim there, so the panel read as a
 * washed-out grey sheet with the feed showing through — and it turned out iOS
 * didn't either: a real blur behind 6% white still leaves the feed legible
 * through the menu, so the labels compete with whatever happens to be scrolled
 * behind them. Both platforms now get the near-solid slab and the heavier
 * backdrop. The blur stays: it's what keeps the edges of the screen from
 * reading as a flat black box.
 */
const PRO_GOLD  = colors.pro;
const PANEL_BG  = '#000000';
const TEXT_HI   = '#FFFFFF';
const TEXT_MID  = 'rgba(255,255,255,0.6)';
const TEXT_FAINT= 'rgba(255,255,255,0.45)';
const DIVIDER   = 'rgba(255,255,255,0.1)';
const TILE_BG   = 'rgba(255,255,255,0.07)';
const CHIP_BG   = 'rgba(255,255,255,0.1)';
const BRASS     = '#E5C58E';
/**
 * The wheel's own off-white, sampled from assets/logo.png.
 *
 * The wordmark beside it was pure white, which next to a warm cream read as
 * two different marks rather than one lockup.
 */
const LOGO_CREAM = '#F7F1D9';

/** Half-width tile — two per row, so the menu fits without scrolling. */
function NavTile({ label, Icon, onPress, count, countTone = 'brass', wide, flex }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  /** Unread count — renders a brass pill on the right when above zero. */
  count?: number;
  /**
   * What the pill means. Brass is the drawer's own "there are things here";
   * 'alert' is the red bubble the rest of the app uses for messages waiting on
   * you, and matches the badge on the same feature's other entry points.
   */
  countTone?: 'brass' | 'alert';
  /** Fill the row instead of taking half of it. */
  wide?: boolean;
  /**
   * Share of the row, for pairs that shouldn't split it evenly — 1 against 2
   * gives a third and two thirds. Replaces the fixed half-width, so every tile
   * in the row needs one.
   */
  flex?: number;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.navTile,
        wide && styles.navTileWide,
        flex != null && { width: undefined, flex },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Icon size={19} color={TEXT_MID} />
      <Text style={styles.navTileLabel} numberOfLines={1}>{label}</Text>
      {/* Pinned to the corner rather than trailing the label — stacked, there
          is no end of the line for it to sit at. */}
      {count != null && count > 0 && (
        <View style={[styles.unreadPill, countTone === 'alert' && styles.unreadPillAlert]}>
          <Text style={[styles.unreadPillText, countTone === 'alert' && styles.unreadPillTextAlert]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** How many pin photos the Photography tile lays side by side behind its label. */
const PHOTOGRAPHY_TILE_SHOTS = 3;

/**
 * The Photography tile: full width, taller than the grid's, and wearing a few
 * photos from recent pins behind its label — a glimpse of the map's point
 * rather than an icon standing in for it. The photos fade to the tile's own
 * black along the bottom and the left, where the label sits, so it reads on
 * any picture. With no pinned photos yet it's a plain tile, still full width.
 */
function PhotographyTile({ onPress }: { onPress: () => void }) {
  // The most recent spots, as the map lists them with no viewport; the first
  // photo of each of the first few that have one.
  const { data } = useGetPhotoSpotsQuery({ limit: 12 });
  const shots = (data?.entries ?? [])
    .map((spot) => imageUrl(spot.gallery?.[0]?.filename))
    .filter((url): url is string => !!url)
    .slice(0, PHOTOGRAPHY_TILE_SHOTS);

  return (
    // A hairline of grey gradient around the tile, lit from the bottom-right: the
    // gradient is the frame, and the tile is inset by the frame's width.
    <LinearGradient
      colors={['#262626', '#5A5A5A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.photoTileFrame}
    >
    <TouchableOpacity
      style={styles.photoTile}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Photography"
    >
      {shots.length > 0 && (
        <View style={[StyleSheet.absoluteFill, styles.photoTileShots]}>
          {shots.map((url) => (
            <Image key={url} source={{ uri: url }} style={styles.photoTileShot} contentFit="cover" transition={200} />
          ))}
        </View>
      )}
      {/* Two fades: up from the bottom for the label, and in from the left so
          the icon and the first word don't sit on the brightest part of a photo. */}
      <LinearGradient
        colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.85)']}
        locations={[0.35, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 0.7, y: 0.5 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.photoTileText}>
        <View style={styles.photoTileTitleRow}>
          <Camera size={20} color={TEXT_HI} />
          <Text style={styles.photoTileTitle}>Photography</Text>
        </View>
        <Text style={styles.photoTileSub} numberOfLines={1}>Members' favorite places to shoot their cars</Text>
      </View>
    </TouchableOpacity>
    </LinearGradient>
  );
}

/**
 * One inbox shortcut.
 *
 * Deliberately not a `NavTile`: outlined rather than filled, and horizontal
 * rather than stacked, so the pair reads as a different kind of thing from the
 * grid of places underneath them.
 */
function InboxPill({ label, Icon, count, onPress }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  /** Unread count — a brass pill on the right when above zero. */
  count?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.inboxPill} onPress={onPress} activeOpacity={0.75}>
      <Icon size={15} color={TEXT_MID} />
      <Text style={styles.inboxPillLabel} numberOfLines={1}>{label}</Text>
      {count != null && count > 0 && (
        <View style={styles.unreadPill}>
          <Text style={styles.unreadPillText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

interface NavDrawerProps {
  visible: boolean;
  onClose: () => void;
  /**
   * Where the menu button sits on screen, measured at press time — the panel
   * grows out of that rectangle, the way the notifications bell's does.
   */
  origin?: GrowOrigin | null;
}
/** The menu button's corner radius, which the growing box starts from. */
const BTN_RADIUS = 14;

export default function NavDrawer({ visible, onClose, origin }: NavDrawerProps) {
  const navigation = useNavigation<NavProp>();
  // Measured rather than assumed: the header carries the status-bar inset on
  // top of its own row, and the list has to start below whatever that adds up
  // to on this device.
  const [headerH, setHeaderH] = useState(72);
  const { userInfo } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const isPro = useIsPro();
  /** About and Support take the account's colour — gold for Pro, else blue. */
  const slabFill = isPro ? colors.pro : colors.primaryAlt;
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  // The bell's own count, so the drawer and the header always agree.
  const { data: notifData } = useGetUnreadNotificationCountQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.NOTIFICATION_POLL_INTERVAL,
  });
  const notifCount = notifData?.count ?? 0;

  /**
   * Marketplace messages waiting on you.
   *
   * On the drawer's Marketplace tile because that's the way in from anywhere —
   * the marketplace has no tab of its own. Counted off the marketplace's own
   * threads, so it can never move the Messages badge beside it.
   */
  const { count: marketplaceUnread } = useMarketplaceUnread();

  // Upcoming events you've flagged interest in — the bubble on "Your Events".
  const { data: myEventsData } = useGetMyEventsCountQuery(undefined, { skip: !isLoggedIn });
  const myEventsCount = myEventsData?.count ?? 0;
  const [myEventsOpen, setMyEventsOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  /** Open when non-null; the origin is the row the panel grows out of. */
  const [invite, setInvite] = useState<{ origin: SummaryOrigin | null } | null>(null);
  /** The add-a-car form, open over the menu — see the setup card below. */
  const [carFormOpen, setCarFormOpen] = useState(false);
  const { openEventSheet } = useEventSheet();

  /**
   * Set by GrowPanel once mounted — the panel owns the open/close animation
   * and hands this in, so every "leave the menu" path below goes through the
   * same collapse-then-go. Held in a ref so the callbacks defined here (which
   * are created before the panel renders) can reach it.
   */
  const leave = useRef<(run?: () => void) => void>(() => onClose());
  /** Close first, then navigate once the drawer is off-screen. */
  const closeThen = useCallback((go: () => void) => leave.current(go), []);
  const handleClose = useCallback(() => leave.current(), []);

  /**
   * Confirmed, because the control is now an icon rather than a labelled
   * button. A mis-tap next to the close X would otherwise end the session, and
   * getting back in means finding a password.
   */
  const handleLogout = useCallback(() => {
    Alert.alert('Log out?', "You'll need to sign in again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => closeThen(() => dispatch(logout())),
      },
    ]);
  }, [closeThen, dispatch]);

  const goFeed = useCallback((screen: 'Feed' | 'Groups' | 'Articles' | 'Podcasts' | 'Search' | 'Dashboard' | 'Members' | 'Marketplace') => {
    closeThen(() => navigation.navigate('MainTabs', {
      screen: 'FeedTab',
      params: { screen },
    } as any));
  }, [closeThen, navigation]);

  const displayName = userInfo?.username ?? '';

  return (
    <GrowPanel visible={visible} origin={origin} onClose={onClose} surface={PANEL_BG}>
      {({ closeThen: panelClose }) => {
        leave.current = panelClose;
        return (
          <>
          <View style={ss.fill}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: headerH + 10, paddingBottom: 24 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* The head of the list, above your own account row. It's the
                  only gold in a white-on-dark drawer, so it reads as the one
                  offer rather than another destination — and it's gone entirely
                  for members who already have it, which puts the account row
                  back on top for everyone who's paid. */}
              {!isPro && (
                <TouchableOpacity
                  style={styles.proCallout}
                  onPress={() => setProOpen(true)}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel="Upgrade to Pro"
                >
                  <View style={styles.proCalloutIcon}>
                    <SteeringWheel size={26} color="#000000" strokeWidth={2.4} />
                  </View>
                  <View style={styles.proCalloutText}>
                    <Text style={styles.proCalloutTitle}>Upgrade to Pro</Text>
                    <Text style={styles.proCalloutSub}>
                      Unlimited garage, posts, routes, & more
                    </Text>
                  </View>
                  <ChevronRight size={16} color="rgba(0,0,0,0.5)" strokeWidth={3} />
                </TouchableOpacity>
              )}

              {/* Your own account. Dashboard and Settings are where you go to
                  change anything about yourself, and as a grey tile a third of
                  the way down it read as one more row among the destinations.
                  Cream, the wheel's own colour, is the one light surface in a
                  dark drawer, so it's found early whether or not the gold sits
                  above it; the cog says "settings" before the label does.

                  In the list rather than pinned above it: pinned, it and the
                  footer were eating fixed height at both ends and squeezing
                  the tiles into the band left over. */}
              {userInfo && (
                <TouchableOpacity
                  style={styles.userCard}
                  onPress={() => goFeed('Dashboard')}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="My Dashboard & Settings"
                >
                  <Avatar
                    user={userInfo}
                    size={44}
                  />
                  <View style={styles.userCardText}>
                    <Text style={styles.userCardName} numberOfLines={1}>My Dashboard & Settings</Text>
                    <Text style={styles.userCardSub} numberOfLines={1}>@{displayName}</Text>
                  </View>
                  <View style={styles.userCardCog}>
                    <Settings size={19} color={LOGO_CREAM} strokeWidth={2.2} />
                  </View>
                </TouchableOpacity>
              )}

              {/* What's left of setting up a profile — renders nothing once
                  every step is done or dismissed. Pro members too: an account
                  can be paid for and still have no photo. */}
              {userInfo && (
                <ProfileSetupCard
                  // Photo and bio are done in sheets inside the card, and the
                  // car form now opens over the menu too: closing everything
                  // to push CarCreate dropped you back on whatever screen was
                  // under the drawer once the car was saved, with the rest of
                  // the checklist gone. Only a post still leaves — Create is a
                  // full-screen composer, not a sheet.
                  onGo={(step) => (
                    step === 'car'
                      ? setCarFormOpen(true)
                      : closeThen(() => navigation.navigate('Create'))
                  )}
                />
              )}

              {/* Your inbox — pills, not tiles, and ahead of the grid. These
                  are the things that might be waiting for you, so they come
                  before the places you browse to; the grid below is where you
                  go when nothing is.

                  Alerts sits with them on its own row rather than squeezed
                  into theirs: it's the rules behind some of those
                  notifications, so it belongs beside them — but it's a full
                  width of label, and a third of a row would truncate it.

                  Outlined and inline rather than filled and stacked: drawn
                  like the tiles they read as two more destinations in the same
                  list, when they're a different kind of thing. */}
              <View style={styles.inboxRow}>
                <InboxPill
                  label="Messages"
                  Icon={Mail}
                  onPress={() => closeThen(() => navigation.navigate('Messages'))}
                />
                <InboxPill
                  label="Notifications"
                  Icon={Bell}
                  count={notifCount}
                  onPress={() => closeThen(() => navigation.navigate('Notifications'))}
                />
              </View>
              <View style={styles.inboxRow}>
                <InboxPill
                  label="Custom Alerts"
                  Icon={BellRing}
                  onPress={() => closeThen(() => navigation.navigate('Alerts'))}
                />
              </View>

              {SHOW_YOUR_EVENTS && (
                <View style={styles.pairRow}>
                  <NavTile label="Your Events" Icon={CalendarCheck}
                    flex={1}
                    count={myEventsCount}
                    onPress={() => setMyEventsOpen(true)} />
                </View>
              )}

              {/* Two-column grid — half the height of a stacked list, which is
                  what kept the log-out button pushed below the fold.

                  No heading over it: with the inbox pills above reading as
                  their own kind of thing and the slabs below as theirs, the
                  grid is already the only run of tiles in the menu, and a
                  label naming it was saying what the shapes had said. */}
              <View style={styles.grid}>
                <NavTile label="Events" Icon={Flag}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Events' } } as any))} />
                <NavTile label="ORS Rallys" Icon={Route}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Rallys' } } as any))} />
                <NavTile label="Cars" Icon={Car}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'CarsTab', params: { screen: 'Cars' } } as any))} />
                <NavTile label="Groups" Icon={Users}
                  onPress={() => goFeed('Groups')} />
                <NavTile label="Members" Icon={UserRound}
                  onPress={() => goFeed('Members')} />
                <NavTile label="Articles" Icon={BookOpen}
                  onPress={() => goFeed('Articles')} />
                {/* Routes came out of the tab bar when the marketplace took
                    that lane. */}
                <NavTile label="Routes" Icon={Route}
                  onPress={() => closeThen(() => navigation.navigate('Routes'))} />
                {/* Marketplace is somewhere you browse, so it browses with
                    everything else. It had a SHOP heading of its own next to
                    the merch shop; with that parked, the heading was left
                    naming a section that no longer had two things in it. */}
                <NavTile label="Marketplace" Icon={ShoppingBag}
                  count={marketplaceUnread}
                  countTone="alert"
                  onPress={() => goFeed('Marketplace')} />
                {/* The header's + used to be the only way to list a diecast; it
                    goes straight to a new post now, so the entry point lives
                    here beside the marketplace it lists into. Pro-only, as
                    before — and conditional, which is the other reason it can't
                    carry a section heading of its own: a basic account would
                    get the label and an empty grid under it. */}
                {isPro && (
                  <NavTile label="List a Diecast" Icon={Package}
                    onPress={() => closeThen(() => navigation.navigate('DiecastCreate'))} />
                )}
              </View>

              {/* Photography closes the grid on a full-width tile of its own —
                  the map is a place you go, and a few of its photos say so
                  better than a camera glyph did. */}
              <PhotographyTile
                onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'PhotographyTab' } as any))}
              />

              {/* The shop leads the three slabs at the foot of the menu.
                  It sits out of the tile grid for the same reason About and
                  Support do — none of them is somewhere you browse to — and
                  now wears the same size and fill as the two below it. Its own
                  brass and larger type made it the loudest thing in the drawer,
                  which is a lot of emphasis for a shop with a few shirts. */}
              {SHOW_SHOP && (
                <TouchableOpacity
                  style={[styles.aboutBtn, { backgroundColor: slabFill }]}
                  onPress={() => closeThen(() => navigation.navigate('Shop'))}
                  activeOpacity={0.85}
                >
                  <Store size={20} color="#000000" />
                  <Text style={styles.aboutBtnText}>Shop</Text>
                  <ChevronRight size={18} color="#000000" />
                </TouchableOpacity>
              )}

              {/* Two slabs rather than tiles — neither is somewhere you browse
                  to. One is the story of the place, the other is how you reach
                  a person in it, and they're the last two things in the menu
                  for the same reason. The MORE heading went with them: a
                  section label over a single row was naming a section of one.

                  Both the same fill, rather than one filled and one dark:
                  they're a pair of ways to reach the society, and colouring
                  them differently implied a hierarchy that isn't there. Gold
                  for a pro member, blue otherwise — black text reads on both,
                  so only the ground changes. */}
              <TouchableOpacity
                style={[styles.aboutBtn, SHOW_SHOP && styles.supportBtn, { backgroundColor: slabFill }]}
                onPress={() => closeThen(() => navigation.navigate('About'))}
                activeOpacity={0.85}
              >
                <Info size={20} color="#000000" />
                <Text style={styles.aboutBtnText}>About Open Road Society</Text>
                <ChevronRight size={18} color="#000000" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.aboutBtn, styles.supportBtn, { backgroundColor: slabFill }]}
                onPress={() => closeThen(() => navigation.navigate('Support'))}
                activeOpacity={0.85}
              >
                <LifeBuoy size={20} color="#000000" />
                <Text style={styles.aboutBtnText}>Support</Text>
                <ChevronRight size={18} color="#000000" />
              </TouchableOpacity>

              {/* Last of the slabs — another way into the society, only for
                  someone who isn't in it yet. Opens over the menu rather than
                  closing it, since it's one field and you're coming straight
                  back. */}
              <SummaryTouchable
                style={[styles.aboutBtn, styles.supportBtn, { backgroundColor: slabFill }]}
                onPress={(origin) => setInvite({ origin })}
                accessibilityLabel="Invite a friend"
              >
                <UserPlus size={20} color="#000000" />
                <Text style={styles.aboutBtnText}>Invite a Friend</Text>
                <ChevronRight size={18} color="#000000" />
              </SummaryTouchable>

              <View style={styles.footer}>
                {/* Leads the small print, above the version pill it's about.
                    Renders nothing when this version has no notes written up —
                    see src/constants/changelog.ts — so the footer goes back to
                    what it was rather than offering an empty panel. Its own
                    modal and its own unread dot live inside it. */}
                <WhatsNewButton />

                {/* Above the copyright, on its own line — it's the one piece of
                    small print anyone actually goes looking for, usually to read
                    it out when something's wrong. A pill in mono, because that's
                    a build identifier rather than prose: the fixed widths make
                    the digits easy to read back over a call, and the chip marks
                    it as a value rather than a sentence. Tracks app.json, which
                    is what `npm run bump` rewrites. */}
                {APP_VERSION ? (
                  <Text style={styles.footerVersion}>v{APP_VERSION}</Text>
                ) : null}

                {/* The society's rooms elsewhere — above the small print,
                    below everything you can do in the app. As marks rather
                    than labelled tiles, since a logo names the place better
                    than the word does. They were standing in as a generic
                    chain link and a speech bubble, which said "a link" and "a
                    chat" without naming either. See BrandIcons. */}
                <View style={styles.socialRow}>
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => Linking.openURL('https://instagram.com/open.road.society/')}
                    activeOpacity={0.8}
                    accessibilityRole="link"
                    accessibilityLabel="Open Road Society on Instagram"
                  >
                    <InstagramIcon size={19} color={TEXT_HI} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => Linking.openURL('https://discord.gg/MBHDngHvx')}
                    activeOpacity={0.8}
                    accessibilityRole="link"
                    accessibilityLabel="Open Road Society on Discord"
                  >
                    <DiscordIcon size={19} color={TEXT_HI} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => Linking.openURL('https://www.youtube.com/@openroadsocietyco')}
                    activeOpacity={0.8}
                    accessibilityRole="link"
                    accessibilityLabel="Open Road Society on YouTube"
                  >
                    <YouTubeIcon size={19} color={TEXT_HI} />
                  </TouchableOpacity>

                  {/* Log out, quietly, on the end of this row.
                      It was a full-width outlined slab of its own, which gave
                      the least-used control in the menu the most weight in it
                      — and red made it look like something had gone wrong. As
                      a text button it's findable without announcing itself,
                      and the confirm dialog is still what actually protects
                      the tap. */}
                  <TouchableOpacity
                    style={styles.logoutBtn}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Log out"
                  >
                    <LogOut size={14} color={TEXT_MID} />
                    <Text style={styles.logoutText}>Log out</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.footerBottom}>
                  <Text style={styles.footerCopy}>© {new Date().getFullYear()} Open Road Society</Text>
                  <View style={styles.footerLinks}>
                    <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/privacy-policy')} hitSlop={8}>
                      <Text style={styles.footerLink}>Privacy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Linking.openURL('https://openroadsociety.co/terms-of-service')} hitSlop={8}>
                      <Text style={styles.footerLink}>Terms</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Header. Rendered after the list so it paints on top of it: an
                iOS blur samples whatever is beneath it in the hierarchy, which
                is what lets the tiles show through as they pass under. */}
            {/* Inside an inset panel now, so no status-bar inset of its own —
                the panel's top edge already clears it. */}
            <View
              style={[styles.panelHeader, { paddingTop: 14 }]}
              onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
            >
              {/* iOS only. Android's blur needs a `blurTarget` this bar
                  can't sensibly give it, and without one expo-blur logs a
                  warning on every render and draws nothing — the tint below
                  does the job there on its own. */}
              {Platform.OS === 'ios' && (
                <BlurView tint="dark" intensity={55} style={StyleSheet.absoluteFill} />
              )}
              {/* Enough tint to keep the logo and icons legible over whatever
                  tile happens to be sliding under them, and no more. */}
              <View style={[StyleSheet.absoluteFill, styles.panelHeaderTint]} />
              {/* Who this is, and the way out — the whole header. Messages,
                  notifications and log out used to sit under it as three
                  unlabelled discs; they're rows in the list now, where they
                  can say what they are. */}
              <View style={styles.titleRow}>
                <Image
                  source={require('../../../assets/logo.png')}
                  style={styles.titleLogo}
                  contentFit="contain"
                  // The mark is a flat cream wheel, so a tint recolours it
                  // cleanly — no second asset to keep in step with the palette.
                  tintColor={isPro ? colors.pro : undefined}
                />
                <Text
                  style={[styles.panelLogo, isPro && { color: colors.pro }]}
                  numberOfLines={1}
                >
                  Open Road Society
                </Text>
                {/* A qualifier on the wordmark, not a second badge — hence
                    tight against it rather than out at the edge, and gold
                    because that is what Pro is everywhere else in the app.
                    The header's own PRO mark is turned on its side to fit
                    beside a small logo; there's room for a pill here. */}
                {isPro && (
                  <View style={styles.proPill}>
                    <Text style={styles.proPillText}>PRO</Text>
                  </View>
                )}
                <View style={styles.titleSpacer} />
                <TouchableOpacity
                  onPress={handleClose}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                >
                  <X size={22} color={TEXT_HI} strokeWidth={2} />
                </TouchableOpacity>
              </View>

            </View>

          </View>

          {/* Sheets that open over the menu. Rendered in here, inside
              GrowPanel's own Modal, on purpose: on iOS a Modal is presented
              by the nearest presented controller above it, so a sibling
              outside the panel would be asked of the root — which is busy
              showing the panel — and never appear. Inside, each stacks on
              top, the same way the setup card's photo and bio sheets do. */}
          <ProUpsellModal
        visible={proOpen}
        onClose={() => setProOpen(false)}
        title="Open Road Society Pro"
        message="We're working on a pro-level tier with additional features. If you're interested, then click Get Notified and we'll let you know when it's available."
      />

      {/* Hosted in the drawer's own Modal rather than pushed as the CarCreate
          route. The drawer is an RN Modal, and on iOS a native-stack modal
          presents from beneath it — the form would open behind the menu. A
          Modal mounted in here stacks on top, the same way the setup card's
          photo and bio sheets do. Mounted only while open: the sheet runs its
          own close animation and reports back when it's gone. */}
      {carFormOpen && <CarCreateSheet onDismissed={() => setCarFormOpen(false)} />}

      <InviteFriendModal
        visible={!!invite}
        origin={invite?.origin}
        onClose={() => setInvite(null)}
      />

      <MyEventsSheet
        visible={myEventsOpen}
        onClose={() => setMyEventsOpen(false)}
        onSelectEvent={(event) => {
          setMyEventsOpen(false);
          // Close the drawer first — the sheet lives at the root, so it would
          // otherwise open behind it.
          closeThen(() => openEventSheet({ eventId: event.internal_id }));
        }}
      />
          </>
        );
      }}
    </GrowPanel>
  );
}

const styles = StyleSheet.create({
  // The panel's box, backdrop and fade are GrowPanel's; only what's drawn
  // inside the panel is styled here.
  panelHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    // One line: the mark, the wordmark, and the X.
    justifyContent: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    // Clips the blur to the bar, and gives the list a visible edge to pass
    // beneath rather than fading into nothing.
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER,
  },
  panelHeaderTint: { backgroundColor: 'rgba(0,0,0,0.62)' },
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  // Takes whatever the wordmark and the pill leave, so the close X stays on
  // the edge rather than trailing the text.
  titleSpacer: { flex: 1 },
  titleLogo:  { width: 30, height: 30 },
  // `flex`, not `flexShrink` — it takes the room between the mark and the X,
  // so the X stays pinned to the edge whatever the wordmark does.
  // `flexShrink`, not `flex: 1` — with the pill beside it the wordmark takes
  // the room it needs and gives way first, instead of claiming the whole gap
  // and pushing the pill against the X.
  panelLogo:  { flexShrink: 1, fontSize: 19, fontWeight: '600', letterSpacing: 0.3, color: LOGO_CREAM },
  proPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: PRO_GOLD,
  },
  proPillText: {
    fontSize: 10, fontWeight: '800', color: '#000000',
    letterSpacing: 0.8,
  },
  // Light on dark — the one cream surface in the drawer, so it leads the eye.
  userCard:   {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    // No horizontal margin any more — the scroll content supplies the gutter
    // now that this sits inside it.
    marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: COMMON_RADIUS, backgroundColor: LOGO_CREAM,
  },
  userCardText: { flex: 1, minWidth: 0 },
  userCardName: { fontSize: 15, fontWeight: '800', color: '#000000' },
  userCardSub:  { fontSize: 13, fontWeight: '600', color: 'rgba(0,0,0,0.6)', marginTop: 1 },
  // Dark chip, cream cog — the card's colours swapped, so the icon reads as the
  // button's mark rather than a stray glyph on the cream.
  userCardCog: {
    width: 36, height: 36, borderRadius: COMMON_RADIUS,
    backgroundColor: '#121212',
    alignItems: 'center', justifyContent: 'center',
  },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  // No wrap: the two share the row evenly rather than sizing to their labels,
  // so "Messages" and "Notifications" come out the same width despite one
  // being half again as long.
  inboxRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  inboxPill: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1, borderColor: DIVIDER,
  },
  // Lighter than a tile's label — these sit above the grid and shouldn't
  // outweigh it.
  inboxPillLabel: { fontSize: 13, fontWeight: '600', color: TEXT_HI, flexShrink: 1 },

  // `paddingTop` picks up the separation the removed section heading used to
  // provide between the inbox pills and the tiles.
  grid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
  pairRow:  { flexDirection: 'row', gap: 8 },
  navTile:  {
    width: TILE_WIDTH,
    // Stacked, not inline. An icon beside a label is a list row wearing a
    // background; an icon over a label is a card. The height that costs is the
    // point of it — these were squeezed flat to keep the menu off a scroll,
    // and the menu scrolls now, which is the cheaper thing to give up.
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 16, borderRadius: 12,
    backgroundColor: TILE_BG,
  },
  navTileWide:  { width: undefined, flex: 1 },
  // The frame's padding is the border's width; the tile's radius is the frame's less that.
  photoTileFrame: { marginTop: 8, padding: 1.5, borderRadius: 12 },
  photoTile: {
    height: 128, borderRadius: 10.5, overflow: 'hidden',
    backgroundColor: PANEL_BG, justifyContent: 'flex-end',
  },
  photoTileShots: { flexDirection: 'row' },
  photoTileShot:  { flex: 1, height: '100%' },
  photoTileText:  { paddingHorizontal: 14, paddingBottom: 12, gap: 3 },
  photoTileTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  photoTileTitle: { fontSize: 17, fontWeight: '800', color: TEXT_HI },
  photoTileSub:   { fontSize: 12, fontWeight: '600', color: TEXT_MID },
  navTileLabel: {
    fontSize: 12.5, fontWeight: '700', color: TEXT_HI,
    textAlign: 'center', flexShrink: 1,
  },
  rowGap:       { marginTop: 8 },
  unreadPill:   {
    position: 'absolute', top: 7, right: 7,
    minWidth: 20, height: 20, borderRadius: PILL_RADIUS, paddingHorizontal: 6,
    backgroundColor: BRASS,
    alignItems: 'center', justifyContent: 'center',
  },
  unreadPillText: { fontSize: 11, fontWeight: '700', color: '#000000' },
  // The app's "waiting for you" red — the same bubble the bell and the
  // marketplace's other entry points wear.
  unreadPillAlert:     { backgroundColor: colors.red },
  unreadPillTextAlert: { color: '#FFFFFF' },

  aboutBtn:     {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 20,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: COMMON_RADIUS,
  },
  aboutBtnText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#000000' },
  supportBtn:   { marginTop: 8 },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  socialBtn: {
    width: 40, height: 40, borderRadius: COMMON_RADIUS,
    backgroundColor: CHIP_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  // `marginLeft: auto` takes the gap between the marks and this, so the two
  // sit at opposite ends of the row rather than bunched together.
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginLeft: 'auto',
    paddingHorizontal: 4, paddingVertical: 8,
  },
  logoutText: { fontSize: 13, fontWeight: '600', color: TEXT_MID },
  footer:        {
    // Last thing in the list rather than a band pinned under it. The rule
    // still marks it off as small print — it just arrives when you reach the
    // end instead of holding a strip of the panel the whole time.
    marginTop: 20, paddingTop: 16, gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
  },
  footerBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerLinks:   { flexDirection: 'row', gap: 12 },
  footerLink:    { fontSize: 12, color: TEXT_MID },
  footerCopy:    { fontSize: 12, color: TEXT_FAINT },
  proCallout: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    // No horizontal margin: this moved into the scroll list, whose content
    // already supplies the gutter, so its own 16 was doubling it and leaving
    // the callout inset from every tile below it.
    marginTop: 4, marginBottom: 10,
    paddingHorizontal: 13, paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: PRO_GOLD,
  },
  // The disc is barely wider than the wheel now — the ground is there to sit
  // it on, not to frame it.
  proCalloutIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  proCalloutText:  { flex: 1 },
  proCalloutTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  proCalloutSub:   { fontSize: 11.5, color: 'rgba(0,0,0,0.65)', marginTop: 1 },

  footerVersion: {
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: CHIP_BG,
    // No mono is loaded, and the two platforms don't share a built-in name —
    // Android resolves anything it doesn't know to its default sans, so naming
    // one font here would quietly be mono on iOS only.
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    letterSpacing: 0.2,
    color: TEXT_MID,
  },
});
