import React, { useRef, useEffect, useCallback, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, Modal, ScrollView, Linking, Dimensions, Alert,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from './AppImage';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Car, Users, ShoppingBag, BookOpen, Flag, X, ChevronRight, Store, Route, UserRound, Bell, BellRing, Info, CalendarCheck, CheckSquare, Mail, Package, LifeBuoy, Camera, UserPlus, Settings, MapPinned, Waypoints, Shield,

} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LogOut } from 'lucide-react-native';
import GrowPanel, { type GrowOrigin } from './GrowPanel';
import { useAppSelector, useAppDispatch } from '../../store/store';
import { useGetBadgesQuery, useGetMyEventsCountQuery } from '../../api/apiService';
import { useMarketplaceUnread } from '../marketplace/MarketplaceUnreadBadge';
import { useIsAppActive } from '../../hooks/useIsAppActive';
import MyEventsSheet from '../society/MyEventsSheet';
import AllCarTasksSheet, { useAllCarTasksTally } from '../cars/AllCarTasksSheet';
import { openNotificationsPanel } from './NotificationsBell';
import { useEventSheet } from '../../providers/EventSheetProvider';
import { colors } from '../../constants/colors';
import { InstagramIcon, DiscordIcon, YouTubeIcon } from './BrandIcons';
import {
  CONFIG,
  COMMON_RADIUS,
  PILL_RADIUS,
  COLOR_BLACK,
  COLOR_LOGO_CREAM,
  COLOR_WHITE,
  COLOR_GRAY_10,
} from '../../constants/config';
import { ProUpsellModal } from '../pro/ProUpsell';
import InviteFriendModal from '../members/InviteFriendModal';
import ProfileSetupCard from '../members/ProfileSetupCard';
import { CarCreateSheet } from '../../screens/garage/CarCreateScreen';
import { SummaryTouchable, type SummaryOrigin } from './SummaryModal';
import SteeringWheel from './SteeringWheel';
import WhatsNewButton from './WhatsNew';
import OilSheen, { WARM_SHEEN_FILL } from './OilSheen';
import { logout } from '../../store/authSlice';
import { useIsPro } from '../../hooks/useBrandColor';
import { ss } from '../../styles/shared';
import type { AppStackParamList } from '../../navigation/types';
import { FONT_INTER } from '../../constants/fonts'

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
/** How far the header's fade runs below its logo row. */
const HEADER_FADE_H = 10;
/** The header's fade: the panel's colour (PANE_BG, #121212) to clear. */
const HEADER_FADE = ['rgba(18,18,18,0.96)', 'rgba(18,18,18,0.8)', 'rgba(18,18,18,0)'] as const;
/** The inbox circles' diameter. */
const CIRCLE = 52;

/**
 * My Events — the events you've said you're interested in. Home went for good:
 * the feed is what closing the menu returns you to, so a tile for it was a
 * second way to do nothing.
 */
const SHOW_YOUR_EVENTS = true;

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
const TEXT_HI   = COLOR_WHITE;
const TEXT_MID  = 'rgba(255,255,255,0.6)';
const TEXT_FAINT= 'rgba(255,255,255,0.45)';
const TILE_BG   = 'rgba(255,255,255,0.07)';
const CHIP_BG   = 'rgba(255,255,255,0.1)';
/** The dashboard button — a light grey, a step down from What's New's white. */
const USER_CARD_BG = '#C9C9C9';
/** The inbox circles and the main buttons — a well in the panel, darker than it. */
const CIRCLE_BG = 'rgba(0,0,0,0.6)';
/**
 * The wheel's own off-white, sampled from assets/logo.png.
 *
 * The wordmark beside it was pure white, which next to a warm cream read as
 * two different marks rather than one lockup.
 */
const LOGO_CREAM = COLOR_LOGO_CREAM;

/** Half-width tile — two per row, so the menu fits without scrolling. */
function NavTile({ label, Icon, onPress, count, wide, flex, row }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  onPress: () => void;
  /** Unread count — a red bubble in the corner when above zero. */
  count?: number;
  /** Fill the row instead of taking half of it. */
  wide?: boolean;
  /**
   * Share of the row, for pairs that shouldn't split it evenly — 1 against 2
   * gives a third and two thirds. Replaces the fixed half-width, so every tile
   * in the row needs one.
   */
  flex?: number;
  /** A tile in one of the sideways rows (NavSection): a fixed width. */
  row?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.navTile,
        row && styles.navTileRow,
        wide && styles.navTileWide,
        flex != null && { width: undefined, flex },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Larger and white: the mark is how a tile is found at a glance, and at
          mid grey it sat behind its own label. */}
      <Icon size={row ? 22 : 24} color={COLOR_WHITE} />
      <Text style={[styles.navTileLabel, row && styles.navTileLabelRow]} numberOfLines={1}>{label}</Text>
      {/* Stacked, pinned to the corner — there's no end of the line for it.
          Inline in a row tile, after the label. */}
      {count != null && count > 0 && (
        <View style={[styles.unreadPill, !row && styles.unreadPillCorner]}>
          <Text style={styles.unreadPillText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** A titled group of tiles, in a row that scrolls sideways out to the panel's edges. */
function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.sectionScroll}
        contentContainerStyle={styles.sectionRow}
      >
        {children}
      </ScrollView>
    </View>
  );
}

/**
 * One inbox shortcut: a circle with its label under it. Five share a row, so
 * the inbox costs one row's height rather than three.
 */
function InboxCircle({ label, Icon, count, onPress }: {
  label: string;
  Icon: React.ComponentType<{ size: number; color: string }>;
  /** Unread count — a red bubble on the circle's corner when above zero. */
  count?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.circleBtn}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <View style={styles.circle}>
        <Icon size={21} color={COLOR_WHITE} />
        {count != null && count > 0 && (
          <View style={[styles.unreadPill, styles.circleCount]}>
            <Text style={styles.unreadPillText}>{count > 99 ? '99+' : count}</Text>
          </View>
        )}
      </View>
      <Text style={styles.circleLabel} numberOfLines={1}>{label}</Text>
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
  const { userInfo } = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const isPro = useIsPro();
  // Measured: the list starts under the floating header's logo row.
  const [headerH, setHeaderH] = useState(72);
  /** The header's mark and wordmark — Pro red, or the blue on a basic account. */
  const brandMark = isPro ? colors.pro : colors.primaryAlt;
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  // The bell's own count, so the drawer and the header always agree.
  // One poll for every badge the chrome draws (see getBadges), paused in the background.
  const appActive = useIsAppActive();
  const { data: badges } = useGetBadgesQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: appActive ? CONFIG.NOTIFICATION_POLL_INTERVAL : 0,
  });
  const notifCount = badges?.notifications ?? 0;

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
  const [tasksOpen, setTasksOpen] = useState(false);
  // Every car's tasks, for the All Car Tasks pill — how many open, and the pie.
  const taskTotals = useAllCarTasksTally(isLoggedIn && isPro);
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

  const goFeed = useCallback((screen: 'Feed' | 'Groups' | 'Articles' | 'Podcasts' | 'Search' | 'Dashboard' | 'Members' | 'Marketplace' | 'Brands') => {
    closeThen(() => navigation.navigate('MainTabs', {
      screen: 'FeedTab',
      params: { screen },
    } as any));
  }, [closeThen, navigation]);


  return (
    <GrowPanel visible={visible} origin={origin} onClose={onClose} backdrop="summary">
      {({ closeThen: panelClose }) => {
        leave.current = panelClose;
        return (
          <>
          <View style={ss.fill}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                // Below the whole header, fade included, so at rest nothing
                // sits under the gradient — only what's scrolled up does.
                { paddingTop: headerH, paddingBottom: 24 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {/* What's left of setting up a profile, at the very top —
                  renders nothing once every step is done or dismissed. Pro members too: an account
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
                    <SteeringWheel size={26} color={COLOR_BLACK} strokeWidth={2.4} />
                  </View>
                  <View style={styles.proCalloutText}>
                    <Text style={styles.proCalloutTitle}>Upgrade to Pro</Text>
                    <Text style={styles.proCalloutSub}>
                      A bigger garage, more posts, routes & more
                    </Text>
                  </View>
                  <ChevronRight size={16} color="rgba(0,0,0,0.5)" strokeWidth={3} />
                </TouchableOpacity>
              )}

              {/* Your inbox — a row of circles rather than pills: the things
                  that might be waiting for you, ahead of the places you browse
                  to, in a single row's height. Car Tasks is a Pro tool, so
                  it's only here for Pro. */}
              <View style={styles.circleRow}>
                <InboxCircle
                  label="Messages"
                  Icon={Mail}
                  onPress={() => closeThen(() => navigation.navigate('Messages'))}
                />
                <InboxCircle
                  label="Notices"
                  Icon={Bell}
                  count={notifCount}
                  // The header's own panel, grown from its bell, as if it had
                  // been tapped there — a couple of frames on, once the menu's
                  // Modal has gone (iOS won't present one over another). The
                  // screen is the fallback where no header bell is showing.
                  onPress={() => closeThen(() => requestAnimationFrame(() => requestAnimationFrame(() => {
                    if (!openNotificationsPanel()) navigation.navigate('Notifications');
                  })))}
                />
                <InboxCircle
                  label="Alerts"
                  Icon={BellRing}
                  onPress={() => closeThen(() => navigation.navigate('Alerts'))}
                />
                {SHOW_YOUR_EVENTS && (
                  <InboxCircle
                    label="My Events"
                    Icon={CalendarCheck}
                    count={myEventsCount}
                    onPress={() => setMyEventsOpen(true)}
                  />
                )}
                {isPro && (
                  <InboxCircle
                    label="Car Tasks"
                    Icon={CheckSquare}
                    count={taskTotals.open}
                    onPress={() => setTasksOpen(true)}
                  />
                )}
              </View>

              {/* The places you browse to, grouped, each group a row that
                  scrolls sideways. */}
              <NavSection title="Events & Drives">
                {/* Home, on its Events tab — where events live now. */}
                <NavTile row label="Events" Icon={Flag} onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Feed', params: { tab: 'events', at: Date.now() } },
                  } as any))} />
                <NavTile row label="ORS Rallys" Icon={Route}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', { screen: 'SocietyTab', params: { screen: 'Rallys' } } as any))} />
                <NavTile row label="Routes" Icon={Waypoints}
                  onPress={() => closeThen(() => navigation.navigate('Routes'))} />
              </NavSection>

              <NavSection title="Community">
                <NavTile row label="Groups" Icon={Users} onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Feed', params: { tab: 'groups', at: Date.now() } },
                  } as any))} />
                <NavTile row label="Members" Icon={UserRound} onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Feed', params: { tab: 'members', at: Date.now() } },
                  } as any))} />
                {/* Where posts were made, as pins — the other map you browse. */}
                <NavTile row label="Posts Map" Icon={MapPinned}
                  onPress={() => closeThen(() => navigation.navigate('PostsMap'))} />
                {/* Home, on its Photography tab — the map lives there now. */}
                <NavTile row label="Photography" Icon={Camera}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Feed', params: { tab: 'photography', at: Date.now() } },
                  } as any))} />
                <NavTile row label="Marketplace" Icon={ShoppingBag} count={marketplaceUnread} onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Feed', params: { tab: 'market', at: Date.now() } },
                  } as any))} />
                {/* Pro-only, beside the marketplace it lists into. */}
                {isPro && (
                  <NavTile row label="List a Diecast" Icon={Package}
                    onPress={() => closeThen(() => navigation.navigate('DiecastCreate'))} />
                )}
              </NavSection>

              <NavSection title="Cars">
                <NavTile row label="Member Cars" Icon={Car} onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Feed', params: { tab: 'cars', at: Date.now() } },
                  } as any))} />
                <NavTile row label="All Brands" Icon={Shield} onPress={() => goFeed('Brands')} />
              </NavSection>


              <NavSection title="The Society">
                <NavTile row label="About" Icon={Info}
                  onPress={() => closeThen(() => navigation.navigate('About'))} />
                <NavTile row label="Concierge" Icon={Car}
                  onPress={() => closeThen(() => navigation.navigate('Concierge'))} />
                <NavTile row label="Articles" Icon={BookOpen} onPress={() => goFeed('Articles')} />
                {/* The society's YouTube channel, watched in the app. */}
                <NavTile row label="ORS Videos" Icon={YouTubeIcon}
                  onPress={() => closeThen(() => navigation.navigate('MainTabs', {
                    screen: 'FeedTab',
                    params: { screen: 'Videos' },
                  } as any))} />
                {SHOW_SHOP && (
                  <NavTile row label="Shop" Icon={Store}
                    onPress={() => closeThen(() => navigation.navigate('Shop'))} />
                )}
              </NavSection>

              {/* At the foot of the menu, above the small print. Your own account. Dashboard and Settings are where you go to
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
                  accessibilityLabel="Dashboard & Settings"
                >
                  {/* What's New's button, under it, without the gradient: the
                      same slab and chevron. */}
                  <Settings size={17} color={COLOR_GRAY_10} strokeWidth={2.2} />
                  <View style={styles.userCardText}>
                    <Text style={styles.userCardName} numberOfLines={1}>Dashboard & Settings</Text>
                  </View>
                  <ChevronRight size={16} color="rgba(0,0,0,0.55)" strokeWidth={2.5} />
                </TouchableOpacity>
              )}

              <View style={styles.footer}>
                {/* Leads the small print, above the version pill it's about.
                    Always shown: with no notes yet for this version it offers
                    the latest that has some — see WhatsNew. Its own modal
                    lives inside it. */}
                <WhatsNewButton />

                {/* Support and Invite, as plain links under the release notes:
                    ways to reach a person, not places to browse to, so they
                    sit with the small print rather than among the slabs. */}
                <View style={styles.footLinks}>
                  <TouchableOpacity
                    style={styles.footBtn}
                    onPress={() => closeThen(() => navigation.navigate('Support'))}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                  >
                    <LifeBuoy size={16} color={TEXT_HI} />
                    <Text style={styles.footBtnText} numberOfLines={1}>Support</Text>
                  </TouchableOpacity>
                  <SummaryTouchable
                    style={styles.footBtn}
                    onPress={(origin) => setInvite({ origin })}
                    accessibilityLabel="Invite a friend"
                  >
                    <UserPlus size={16} color={TEXT_HI} />
                    <Text style={styles.footBtnText} numberOfLines={1}>Invite a friend</Text>
                  </SummaryTouchable>
                </View>

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
                  {/* The version, then Log out, together at the row's end —
                      two small chips in the same style. The version is the one
                      piece of small print anyone goes looking for, usually to
                      read it out when something's wrong; it tracks app.json,
                      which `npm run bump` rewrites. */}
                  {/* The word, then the circle — one control, so either takes the tap. */}
                  <TouchableOpacity
                    style={styles.footerChips}
                    onPress={handleLogout}
                    activeOpacity={0.7}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Log out"
                  >
                    <Text style={styles.logoutLabel}>Log out</Text>
                    <View style={styles.logoutBtn}>
                      <LogOut size={17} color={TEXT_HI} />
                    </View>
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

            {/* Header, floating over the list, which runs to the panel's top
                beneath it. No solid bar: a fade from the panel's colour to
                clear, so the tiles dim as they pass under the logo. After the
                list so it paints on top; box-none so only its buttons take
                touches. */}
            <View
              style={styles.panelHeader}
              pointerEvents="box-none"
              onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}
            >
              <LinearGradient
                colors={HEADER_FADE}
                locations={[0, 0.55, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <View style={styles.titleRow}>
                <Image
                  source={require('../../../assets/logo.png')}
                  style={styles.titleLogo}
                  contentFit="contain"
                  // The mark is a flat cream wheel, so a tint recolours it
                  // cleanly — no second asset to keep in step with the palette.
                  tintColor={brandMark}
                />
                <Text
                  style={[styles.panelLogo, { color: brandMark }]}
                  numberOfLines={1}
                >
                  Open Road Society
                </Text>
                {/* A qualifier on the wordmark, not a second badge — hence
                    tight against it rather than out at the edge, and gold
                    because that is what Pro is everywhere else in the app.
                    The header's own PRO mark is turned on its side to fit
                    beside a small logo; there's room for a pill here. */}
                {/* Gold with the oil-slick film, as the header's Pro button is. */}
                {isPro && (
                  <View style={styles.proPill}>
                    <OilSheen tone="warm" radius={999} />
                    <Text style={styles.proPillText}>PRO</Text>
                  </View>
                )}
                <View style={styles.titleSpacer} />
                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={handleClose}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Close menu"
                >
                  <X size={20} color={TEXT_HI} strokeWidth={2.2} />
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

      <AllCarTasksSheet visible={tasksOpen} onClose={() => setTasksOpen(false)} />

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
  // One line: the mark, the wordmark, and the X — on the panel itself.
  // Over the top of the list; the fade below the row is HEADER_FADE_H.
  panelHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    justifyContent: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: HEADER_FADE_H,
  },
  // A semi-transparent black disc behind the X.
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  // A little air above it, clear of the panel's rounded top corners.
  titleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 3,
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
  panelLogo:  { flexShrink: 1, fontSize: 19, fontFamily: FONT_INTER.semibold, letterSpacing: 0.3, color: LOGO_CREAM },
  proPill: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: 999,
    // The sheen's own fill, the old Pro gold — not PRO_GOLD, now the red.
    backgroundColor: WARM_SHEEN_FILL,
    overflow: 'hidden',
  },
  proPillText: {
    fontSize: 10, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK,
    letterSpacing: 0.8,
  },
  // What's New's button (WhatsNew's `btn`), minus its gradient film.
  userCard:   {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 24, minHeight: 48,
    paddingHorizontal: 14, paddingVertical: 10,
    // A soft grey rather than What's New's white, so the two don't compete.
    borderRadius: COMMON_RADIUS, backgroundColor: USER_CARD_BG,
  },
  userCardText: { flex: 1, minWidth: 0 },
  userCardName: { fontSize: 14, fontFamily: FONT_INTER.semibold, color: COLOR_GRAY_10 },
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20 },
  // The inbox circles, spread evenly across the row.
  // Ruled off above and below, with room inside, so the inbox reads as its
  // own band between the account cards and the tiles.
  circleRow:   {
    flexDirection: 'row', justifyContent: 'space-between',
    // Out to the panel's edges, so the rules run edge to edge; the padding
    // keeps the circles on the gutter.
    marginTop: 4, marginBottom: 4, marginHorizontal: -16,
    paddingVertical: 16, paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  circleBtn:   { flex: 1, alignItems: 'center', gap: 6 },
  circle: {
    width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2,
    // Darker than the panel, no outline.
    backgroundColor: CIRCLE_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  // On the circle's top-right edge.
  circleCount: { position: 'absolute', top: -4, right: -6 },
  circleLabel: { fontSize: 11, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },

  // A group of tiles: its name, then the sideways row.
  section:       { marginTop: 18 },
  sectionTitle:  {
    fontSize: 13, fontFamily: FONT_INTER.medium,
    color: COLOR_WHITE, marginBottom: 8,
  },
  // Out to the panel's edges, so a row scrolls under them rather than
  // stopping at the gutter; the content puts the gutter back.
  sectionScroll: { marginHorizontal: -16 },
  sectionRow:    { gap: 8, paddingHorizontal: 16 },

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
  // Inline and short: the icon beside the label, and as wide as the two need.
  navTileRow:   {
    width: undefined,
    flexDirection: 'row', justifyContent: 'flex-start', gap: 10,
    // The inbox circles' dark well.
    backgroundColor: CIRCLE_BG,
    paddingHorizontal: 14, paddingVertical: 16,
  },
  navTileLabel: {
    fontSize: 12.5, fontFamily: FONT_INTER.bold, color: TEXT_HI,
    textAlign: 'center', flexShrink: 1,
  },
  navTileLabelRow: { fontSize: 15, textAlign: 'left', flexShrink: 0 },
  rowGap:       { marginTop: 8 },
  // Every count in the menu is the app's "waiting for you" red — the bell's
  // bubble — a circle for one digit, stretching to a pill for more.
  unreadPill:   {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    backgroundColor: colors.countBadge,
    alignItems: 'center', justifyContent: 'center',
  },
  // On a tile, pinned in the corner — far enough in that it sits on the tile
  // rather than on its edge. In an inbox pill it's inline, after the label.
  unreadPillCorner: { position: 'absolute', top: 11, right: 11 },
  unreadPillText: { fontSize: 11.5, fontFamily: FONT_INTER.extrabold, color: COLOR_WHITE },

  // Two outlined buttons sharing the row evenly.
  footLinks:    { flexDirection: 'row', gap: 8, marginTop: 10 },
  // Grow from nothing, so the two are exactly half each whatever their labels.
  footBtn: {
    flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
  },
  footBtnText:  { flexShrink: 1, fontSize: 13.5, fontFamily: FONT_INTER.semibold, color: TEXT_HI },

  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  socialBtn: {
    width: 40, height: 40, borderRadius: COMMON_RADIUS,
    backgroundColor: CHIP_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  // `marginLeft: auto` takes the gap between the marks and these, so the two
  // groups sit at opposite ends of the row rather than bunched together.
  footerChips: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 'auto' },
  logoutLabel: { fontSize: 13, fontFamily: FONT_INTER.semibold, color: TEXT_MID },
  // A circle at the social marks' size, the icon alone.
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: CHIP_BG,
    alignItems: 'center', justifyContent: 'center',
  },
  footer:        {
    // Last thing in the list, under the dashboard card — the footer's own
    // gap, so it and What's New read as a pair.
    marginTop: 12, gap: 12,
  },
  footerBottom:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
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
  proCalloutTitle: { fontSize: 14, fontFamily: FONT_INTER.extrabold, color: COLOR_BLACK },
  proCalloutSub:   { fontSize: 11.5, color: 'rgba(0,0,0,0.65)', marginTop: 1 },

});
