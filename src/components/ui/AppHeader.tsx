import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, StatusBar, Image, Animated, Easing, Platform, ScrollView } from 'react-native';
import { Text } from '@ors/kit';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { headerOffset, resetHeader } from '../../hooks/useHeaderScroll';
import { goBackToTop } from '../../hooks/useScrollTopOnBack';
import { ChevronLeft, Bookmark, Search } from 'lucide-react-native';
import { useSearch } from '../../providers/SearchProvider';
import Svg, { Line } from 'react-native-svg';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import NavDrawer from './NavDrawer';
import NotificationsBell from './NotificationsBell';
import GarageDoor from './GarageDoor';
import GaragePanel from '../cars/GaragePanel';
import GarageThumbs from '../cars/GarageThumbs';
import { useAppSelector } from '../../store/store';
import { useGetUserGarageQuery, useGetLoggedInUserQuery } from '../../api/apiService';
import SummaryModal, { type SummaryOrigin } from './SummaryModal';
import BookmarksPanel from '../cars/BookmarksPanel';
import { useBrandColor, useIsPro } from '../../hooks/useBrandColor';
import OilSheen, { useSheenTone, type SheenTone } from './OilSheen';
import type { AppStackParamList } from '../../navigation/types';
import { COMMON_RADIUS, GUTTER, COLOR_BLACK, COLOR_WHITE, COLOR_BORDER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

type NavProp = NativeStackNavigationProp<AppStackParamList>;

const BTN = 42;          // floating button edge length
// The app's shared corner — the sheen overlay reads this too, so the two
// can't drift apart.
const BTN_RADIUS = COMMON_RADIUS;
const ROW_PAD_V = 8;     // vertical padding around the button row

/**
 * How far below the safe-area inset the button row starts.
 *
 * iOS notch/island insets already clear the status bar generously, so the full
 * pad on top of them leaves the header sitting low. Android's inset is the
 * status bar height exactly and needs the breathing room.
 */
const TOP_OFFSET = Platform.OS === 'ios' ? 0 : ROW_PAD_V;

const ICON = COLOR_BLACK;

/**
 * The back button beside the logo — off for now. With the sections moved into
 * the home screen's tabs and the menu, there's little left to go back through,
 * and a button that rarely appears read as clutter when it did. Everything
 * behind it is intact: set this to true and it slides back in wherever
 * there's history. Screens with a back of their own (a group's page) keep it.
 */
const SHOW_HEADER_BACK = false;

/** The back button is narrower than the others — a chevron, not a destination. */
const BACK_W = 30;
/** Space between the back button and the logo, same as the right-hand row. */
const BACK_GAP = 7;

/** The bar's side padding — the back button's travel has to clear it too. */
const BAR_PAD_H = GUTTER;
/**
 * Where the back button starts: fully past the left edge of the screen, with
 * room for its shadow, so it arrives from outside rather than fading up in
 * place. Always further out than the space opening beside the logo grows, so
 * it never passes over the logo on the way in.
 */
const BACK_ENTER_FROM = -(BAR_PAD_H + BACK_W + 8);

/** Length of the vertical PRO mark, along the word. */
const PRO_LEN = 25;

/** How far the scrim carries on past the buttons before it's gone. */
const SCRIM_FADE = 28;

/**
 * Height the header occupies below the safe-area inset.
 */
export const APP_HEADER_HEIGHT = BTN + TOP_OFFSET + ROW_PAD_V;

/**
 * Top padding a screen's scroll content needs so its first item starts clear of
 * the floating buttons. The bar is an absolute overlay and reserves no layout
 * space, so content scrolls up underneath it.
 */
export function useHeaderPad({ tabs = false }: { tabs?: boolean } = {}): number {
  const insets = useSafeAreaInsets();
  return insets.top + APP_HEADER_HEIGHT + (tabs ? HEADER_TABS_HEIGHT : 0);
}

/** Height of the tab row under the buttons, on screens that have one. */
export const HEADER_TABS_HEIGHT = 52;

/** One entry in the header's tab row. */
export interface HeaderTab {
  key: string;
  label: string;
  /** Before the label, in the label's colour — the group page's tabs wear them too. */
  Icon?: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

/**
 * Floating header button — a rounded square fully filled with the brand color,
 * sitting below the status bar. `wide` relaxes the fixed width for buttons
 * that carry a label.
 */
/**
 * The menu glyph: two bars rather than lucide's three. Drawn on lucide's
 * 24-unit grid with its bar length and round caps, so it sits beside the
 * other header icons at the same weight — just one bar lighter.
 */
function MenuBars({ size, color, strokeWidth }: { size: number; color: string; strokeWidth: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={4} y1={8} x2={20} y2={8} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      <Line x1={4} y1={16} x2={20} y2={16} stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * The tab row under the header's buttons.
 *
 * It rides the same `headerOffset` as the buttons, but only for the first
 * APP_HEADER_HEIGHT of the trip: the buttons carry on off the top, and the
 * row stops just under the status bar and sticks there, so it's always in
 * reach. Its background is HeaderGround's, behind the whole header.
 */
/**
 * The background behind the whole header — status bar, buttons and tabs — on
 * a screen with tabs: a black-tinted blur.
 *
 * It rides up with the header for the same distance the tab row does, so
 * once the row sticks it covers the status bar and the row and nothing more.
 * It starts TABS_STUCK_RISE above the top of the screen for that reason:
 * off-screen at rest, that's the part that slides down behind the status bar
 * as the rest goes up. Moving a blur is fine on iOS where fading one isn't,
 * so nothing here animates but its position.
 */
function HeaderGround({ height }: { height: number }) {
  const lift = headerOffset.interpolate({
    inputRange: [-TABS_STUCK_RISE, 0],
    outputRange: [-TABS_STUCK_RISE, 0],
    extrapolate: 'clamp',
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ground, { top: -TABS_STUCK_RISE, height: height + TABS_STUCK_RISE, transform: [{ translateY: lift }] }]}
    >
      <BlurView tint="dark" intensity={TABS_BLUR} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, styles.groundTint]} />
    </Animated.View>
  );
}

function HeaderTabs({ tabs, activeTab, onTabPress, top }: {
  tabs: HeaderTab[];
  activeTab?: string;
  onTabPress?: (key: string) => void;
  top: number;
}) {
  // The account's colour for the lit tab — gold for Pro, blue otherwise — so
  // it matches the switches and filter pills beneath it.
  const brand = useBrandColor();

  /**
   * The lit tab, brought toward the front of the row — scrolled so it starts
   * TABS_ACTIVE_LEFT in from the screen's edge, leaving the tab before it
   * peeking in on the left so you can see there's somewhere to go back to.
   * The first tab has nothing before it to show, so it stays anchored on the
   * gutter. The row can't scroll past its end, so the last few stop short of
   * the mark but are still all in view.
   *
   * Positions are each tab's own x within the row, measured as they lay out;
   * the row's TABS_START_PAD is outside that, so it's added back to find
   * where the tab sits against the screen.
   */
  const scrollRef = useRef<ScrollView>(null);
  const tabX = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!activeTab) return;
    const x = tabX.current[activeTab];
    if (x == null) return;
    const first = activeTab === tabs[0]?.key;
    const to = first ? 0 : Math.max(0, TABS_START_PAD + x - TABS_ACTIVE_LEFT);
    scrollRef.current?.scrollTo({ x: to, animated: true });
  }, [activeTab]);

  const indent = headerOffset.interpolate({
    inputRange: [-APP_HEADER_HEIGHT, 0],
    outputRange: [TABS_STUCK_INDENT, 0],
    extrapolate: 'clamp',
  });
  const shrink = headerOffset.interpolate({
    inputRange: [-APP_HEADER_HEIGHT, 0],
    outputRange: [TABS_STUCK_SCALE, 1],
    extrapolate: 'clamp',
  });
  /**
   * Whether the row has stuck — for the heavier weight it takes there: scaled
   * down, a weight reads lighter, so the stuck tabs step up to Inter Black.
   * A font can't ride the native driver, so this flips as the row arrives
   * rather than easing with it.
   */
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    let on = false;
    const id = headerOffset.addListener(({ value }) => {
      const next = value <= -APP_HEADER_HEIGHT + 1;
      if (next !== on) { on = next; setStuck(next); }
    });
    return () => headerOffset.removeListener(id);
  }, []);
  const lift = headerOffset.interpolate({
    inputRange: [-TABS_STUCK_RISE, 0],
    outputRange: [-TABS_STUCK_RISE, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.tabs, { top, transform: [{ translateY: lift }] }]}>
      <ScrollView
        ref={scrollRef}
        horizontal
        style={styles.tabsScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsRow}
      >
        {/* Slides further in as the row sticks — flush with the header's
            buttons at rest, but on its own against the screen edge it read as
            crammed into the corner. */}
        {/* …and shrinks a little as it goes: under the status bar it's a
            strip you reach for, not the screen's title. Scaled rather than
            re-sized, so it rides the same native-driven offset — anchored at
            the left, so the first tab keeps its place. */}
        <Animated.View style={[styles.tabsItems, { transform: [{ translateX: indent }, { scale: shrink }] }]}>
        {tabs.map((t) => {
          const on = t.key === activeTab;
          return (
            <TouchableOpacity
              key={t.key}
              onLayout={(e) => { tabX.current[t.key] = e.nativeEvent.layout.x; }}
              onPress={() => onTabPress?.(t.key)}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8 }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <View style={styles.tabInner}>
                {t.Icon ? <t.Icon size={16} color={on ? brand : TAB_IDLE} strokeWidth={on ? 2.4 : 2} /> : null}
                <Text
                  style={[
                    styles.tabLabel,
                    { color: on ? brand : TAB_IDLE },
                    !on && styles.tabLabelIdle,
                    stuck && (on ? styles.tabLabelStuck : styles.tabLabelIdleStuck),
                  ]}
                >
                  {t.label}
                </Text>
              </View>
              {/* Under the lit tab only, in its colour, the width of its word. */}
              <View style={[styles.tabUnderline, { backgroundColor: on ? brand : 'transparent' }]} />
            </TouchableOpacity>
          );
        })}
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

function FloatingButton({
  onPress, children, label, tint, wide, bare, outlined, sheen, round,
}: {
  onPress: () => void;
  children: React.ReactNode;
  label: string;
  tint: string;
  wide?: boolean;
  /**
   * No fill — just the glyph, like the notifications bell beside it.
   *
   * For the controls that aren't destinations. The shadow stays either way:
   * the bar floats over content of any brightness, and an unbacked white icon
   * needs it to stay legible over a pale photo.
   */
  bare?: boolean;
  /**
   * Outlined instead of filled: a white hairline over a barely-there black
   * ground. Between `bare` and the brand fill — enough of a surface to read as
   * a button, without claiming the brand colour.
   */
  outlined?: boolean;
  /** An oil-slick film over the fill — the home button's. See OilSheen. */
  sheen?: SheenTone;
  /** A full circle rather than the rounded square — the profile photo's. */
  round?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={label}
      // The color lives on the shadowed view itself: iOS won't cast a shadow
      // from a view with no background, and it guarantees the tint fills the
      // button rather than relying on an absolutely-positioned sibling.
      style={[
        styles.btn,
        wide && styles.btnWide,
        round && styles.btnRound,
        bare ? styles.btnBare
          : outlined ? styles.btnOutlined
          : { backgroundColor: tint },
      ]}
    >
      {sheen && !bare && !outlined && <OilSheen tone={sheen} radius={BTN_RADIUS} />}
      <View style={[styles.btnIcon, wide && styles.btnIconWide, round && styles.btnRound]}>{children}</View>
    </TouchableOpacity>
  );
}

interface AppHeaderProps {
  /**
   * Reserve layout space for the header instead of floating over the content.
   * Screens whose scroll container applies `useHeaderPad()` leave this off so
   * their content passes under the buttons.
   */
  spacer?: boolean;
  /**
   * A row of tabs under the buttons — "Your Feed" on the home screen. When the
   * header scrolls away the buttons leave, but this row stops at the top of
   * the screen and stays, so it can be used however far down you are. A
   * screen with tabs pads its content with `useHeaderPad({ tabs: true })`.
   */
  tabs?: HeaderTab[];
  /** The tab that's lit — the one whose content is showing. */
  activeTab?: string;
  onTabPress?: (key: string) => void;
  /**
   * What the logo does on a screen that's already where it leads — the home
   * feed refreshing itself. Left out, the logo goes to the home feed.
   */
  onLogoPress?: () => void;
}

export default function AppHeader({ spacer, tabs, activeTab, onTabPress, onLogoPress }: AppHeaderProps = {}) {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAppSelector((s) => s.auth);
  const { openSearch } = useSearch();
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Where the menu button sits, captured at press time — the drawer grows out
  // of that rectangle, so it has to be measured, not assumed.
  const menuRef = useRef<View>(null);
  const [drawerOrigin, setDrawerOrigin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // The garage opens the same way — measured off its own button.
  const garageRef = useRef<View>(null);
  const [garageOpen, setGarageOpen] = useState(false);
  const [garageOrigin, setGarageOrigin] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const openGarage = useCallback(() => {
    const node = garageRef.current;
    if (!node) { setGarageOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setGarageOrigin({ x, y, w, h });
      setGarageOpen(true);
    });
  }, []);
  const openDrawer = useCallback(() => {
    const node = menuRef.current;
    if (!node) { setDrawerOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setDrawerOrigin({ x, y, w, h });
      setDrawerOpen(true);
    });
  }, []);

  // Buttons carry the brand color; icons are black on top of it.
  const tint = useBrandColor();
  const isPro = useIsPro();
  const sheenTone = useSheenTone();

  // `headerOffset` is shared across screens, so a screen left mid-scroll would
  // otherwise hand the next one a header that's still slid off-screen.
  useEffect(() => { resetHeader(); }, []);

  // Any screen with somewhere to return to gets a back button ahead of the
  // logo. `canGoBack` isn't reactive, so it's re-read whenever this screen comes
  // into focus — tab screens stay mounted, and the tab history behind them can
  // change while they're out of view.
  const [hasHistory, setHasHistory] = useState(() => navigation.canGoBack());
  useFocusEffect(useCallback(() => { setHasHistory(navigation.canGoBack()); }, [navigation]));
  const canGoBack = SHOW_HEADER_BACK && hasHistory;

  // Starts collapsed so arriving on a screen pushes the button in from the edge
  // and eases the logo over to make room, rather than the logo simply being
  // there.
  // Width can't run on the native driver, and neither can anything sharing
  // this value with it.
  // Starts where it belongs. It used to start collapsed and run a 700ms,
  // JS-driven width animation on every screen arrival — the same moment the
  // screen was doing its first render, so both stuttered and the page read
  // as still arriving. It only moves now when a screen's history changes
  // under it, which is rare.
  const backProgress = useRef(new Animated.Value(canGoBack ? 1 : 0)).current;
  const firstBack = useRef(true);
  useEffect(() => {
    if (firstBack.current) { firstBack.current = false; return; }
    Animated.timing(backProgress, {
      toValue: canGoBack ? 1 : 0,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [canGoBack, backProgress]);

  const { data: garageData } = useGetUserGarageQuery(undefined, { skip: !isLoggedIn });
  const garageCars = garageData?.entries ?? [];

  // Bookmarked models, from the live profile — the button appears with the first.
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !isLoggedIn });
  // Posts and car models together — the button's panel has a tab for each.
  const bookmarkCount = (me?.modelBookmarks?.length ?? 0) + (me?.postBookmarks?.length ?? 0);
  const bookmarksRef = useRef<View>(null);
  const [bookmarks, setBookmarks] = useState<{ origin: SummaryOrigin | null } | null>(null);
  const openBookmarks = useCallback(() => {
    const node = bookmarksRef.current;
    if (!node) { setBookmarks({ origin: null }); return; }
    node.measureInWindow((x, y, w, h) => setBookmarks({ origin: { x, y, w, h } }));
  }, []);

  // Fully faded by the time it's travelled its own height — about where the
  // status bar would start to cut it off.
  const barFade = headerOffset.interpolate({
    inputRange: [-APP_HEADER_HEIGHT, 0],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const go = (screen: string, params?: object) =>
    (navigation as any).navigate('MainTabs', { screen, params });

  return (
    <>
      {/* The bar is transparent, so the status bar shows the screen behind it. */}
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {spacer && <View style={{ height: insets.top + APP_HEADER_HEIGHT + (tabs?.length ? HEADER_TABS_HEIGHT : 0) }} />}

      {tabs?.length ? <HeaderGround height={insets.top + APP_HEADER_HEIGHT + HEADER_TABS_HEIGHT} /> : null}

      {/* A scrim from the very top of the device down past the button row.
          The bar floats over whatever the screen is showing, and against a
          photo — which is most of this app — black icons on brand-coloured
          squares sat on top of the picture with nothing separating them, and
          the status bar's own clock and battery competed with it. It rides the
          same offset as the bar, so it leaves with it on scroll. */}
      <Animated.View
        style={[
          styles.scrim,
          {
            height: insets.top + APP_HEADER_HEIGHT + SCRIM_FADE,
            transform: [{ translateY: headerOffset }],
          },
        ]}
        pointerEvents="none"
      >
        <LinearGradient
          // The page's own ground (COLOR_GRAY_10) rather than black: over the
          // page it vanishes, so the header area and the screen read as one
          // surface, and over a photo it still darkens as before.
          colors={['rgba(10,10,10,0.72)', 'rgba(10,10,10,0.45)', 'rgba(10,10,10,0)']}
          locations={[0, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Sits below the status bar, not behind it. Slides up out of view when
          the screen is scrolled down, back in when scrolled up. */}
      <Animated.View
        style={[
          styles.bar,
          {
            top: insets.top + TOP_OFFSET,
            transform: [{ translateY: headerOffset }],
            // Fades as it slides, over the same stretch, so the buttons dissolve
            // on the way out rather than being cut off by the top of the screen.
            opacity: barFade,
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.leftActions}>
        {/* Back — collapses to nothing on a screen with no history. */}
        <Animated.View
          style={{ width: backProgress.interpolate({ inputRange: [0, 1], outputRange: [0, BACK_W + BACK_GAP], extrapolateLeft: 'clamp' }) }}
          pointerEvents={canGoBack ? 'box-none' : 'none'}
          accessibilityElementsHidden={!canGoBack}
          importantForAccessibility={canGoBack ? 'auto' : 'no-hide-descendants'}
        >
          <Animated.View
            style={{
              transform: [{ translateX: backProgress.interpolate({ inputRange: [0, 1], outputRange: [BACK_ENTER_FROM, 0] }) }],
            }}
          >
            <TouchableOpacity
              // Lands the screen it returns to at the top, header showing — see
              // useScrollTopOnBack. Swipe/hardware back keep their place.
              onPress={() => goBackToTop(navigation)}
              activeOpacity={0.75}
              hitSlop={{ top: 6, bottom: 6, left: 10, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={[styles.btn, styles.btnOutlined, styles.backBtn]}
            >
              <ChevronLeft size={22} color={COLOR_WHITE} strokeWidth={2.4} />
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Logo returns to the home feed — the Feed tab, at its top */}
        <FloatingButton
          label={isPro ? 'Home feed, Pro member' : 'Home feed'}
          tint={tint}
          // Only widened when there's a word to make room for; a basic account
          // keeps the square button it has always had.
          wide={isPro}
          sheen={sheenTone}
          onPress={() => {
            // A tap you can feel — no permissions or native setup behind it,
            // and a no-op on a device without a haptic engine.
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            if (onLogoPress) onLogoPress();
            else go('FeedTab', { screen: 'Feed', params: { tab: 'feed', at: Date.now() } });
          }}
        >
          <Image
            source={require('../../../assets/logo.png')}
            style={styles.logo}
            tintColor={ICON}
          />
          {/* Turned on its side and set tight against the mark — it's a
              qualifier on the logo rather than a second piece of branding, the
              gold fill behind it is already doing most of the saying, and
              upright it was the widest thing in the button. */}
          {isPro && (
            <View style={styles.proMark}>
              <Text style={styles.proMarkText}>PRO</Text>
            </View>
          )}
        </FloatingButton>
        </View>

        {/* Right — notifications unfilled, then profile, garage and menu.
            Search moved to the tab bar: it's something you do *while* looking
            at something, and the bar is on screen at all times where this row
            scrolls away with the header. */}
        <View style={styles.rightActions}>
          {/* Leads the row, and unfilled. The four buttons after it are places
              you choose to go; this one is the app telling you something, and
              a fifth identical pill made that indistinguishable. Always
              present — only its count bubble comes and goes. */}
          <NotificationsBell />

          {/* Your bookmarks — only once there's one. Opens in place, like the
              bell and the garage. */}
          {bookmarkCount > 0 && (
            <View ref={bookmarksRef} collapsable={false}>
              <FloatingButton label="Bookmarks" tint={tint} outlined onPress={openBookmarks}>
                <Bookmark size={19} color={COLOR_WHITE} strokeWidth={2.4} />
              </FloatingButton>
            </View>
          )}

          {/* Search, where the profile photo was — the two swapped places: your
              profile is the round photo in the bottom corner now (CreateFab). */}
          <FloatingButton
            label="Search"
            tint={tint}
            outlined
            onPress={openSearch}
          >
            <Search size={20} color={COLOR_WHITE} strokeWidth={2.4} />
          </FloatingButton>

          {/* A garage-door icon in place of the word: the row has five buttons
              to fit and the label was the widest thing in it. Only widened
              when there are thumbs to sit beside the icon. */}
          {/* Opens in place, like the bell and the menu beside it, rather
              than navigating to the garage tab. */}
          <View ref={garageRef} collapsable={false}>
            <FloatingButton
              label="Garage"
              tint={tint}
              outlined
              wide={garageCars.length > 0}
              onPress={openGarage}
            >
              <GarageDoor size={21} color={COLOR_WHITE} strokeWidth={2.4} />
              <GarageThumbs cars={garageCars} />
            </FloatingButton>
          </View>

          {/* No badge. An unread message raises a notice in the bell next to
              this button — a red dot on the menu could only say that something
              somewhere was waiting, and left you to open the drawer and hunt
              for it. The notice says who wrote and opens the conversation. */}
          <View ref={menuRef} collapsable={false}>
            <FloatingButton
              label="Menu"
              tint={tint}
              outlined
              onPress={openDrawer}
            >
              <MenuBars size={22} color={COLOR_WHITE} strokeWidth={2.2} />
            </FloatingButton>
          </View>
        </View>
      </Animated.View>

      {tabs?.length ? (
        <HeaderTabs
          tabs={tabs}
          activeTab={activeTab}
          onTabPress={onTabPress}
          top={insets.top + APP_HEADER_HEIGHT}
        />
      ) : null}

      <NavDrawer visible={drawerOpen} origin={drawerOrigin} onClose={() => setDrawerOpen(false)} />
      <GaragePanel visible={garageOpen} origin={garageOrigin} onClose={() => setGarageOpen(false)} />
      <SummaryModal visible={!!bookmarks} origin={bookmarks?.origin} onClose={() => setBookmarks(null)}>
        <BookmarksPanel />
      </SummaryModal>
    </>
  );
}

/** Blur strength behind the tab row. */
const TABS_BLUR = 60;

/**
 * Taken off the tab row's top padding once it sticks: under the status bar
 * the full padding read as a gap, where under the buttons it was breathing
 * room.
 */
const TABS_STUCK_TRIM = 6;
/** How far the tab row (and the ground behind it) travels up before it sticks. */
/**
 * How far the tab row rises when the header collapses — exported so a screen
 * that pins something under the header can rise with it, rather than leave a
 * gap where the buttons were.
 */
export const TABS_STUCK_RISE = APP_HEADER_HEIGHT + TABS_STUCK_TRIM;

/** The tabs' size once stuck, against 1 at rest. */
const TABS_STUCK_SCALE = 0.72;
/** Clear space after the last tab, at the end of the row's scroll. */
const TABS_END_SPACE = 24;
/** How much further in from the edge the tabs sit once stuck. */
const TABS_STUCK_INDENT = 12;
/**
 * Where a picked tab settles, in points from the screen's left edge — far
 * enough in that the tab before it peeks into view. Not the first tab, which
 * stays on the gutter.
 */
const TABS_ACTIVE_LEFT = 50;

/** Room before the first tab — a touch more than the GUTTER, so the row doesn't start hard on the edge. */
const TABS_START_PAD = 12;

/** An unlit tab — white, stepped back so the lit one leads. */
const TAB_IDLE = 'rgba(255,255,255,0.6)';

const styles = StyleSheet.create({
  // Over the scrim and level with the buttons, so it covers the content
  // scrolling under it once it sticks.
  tabs: {
    position: 'absolute',
    left: 0, right: 0,
    height: HEADER_TABS_HEIGHT,
    zIndex: 21,
  },
  // Scales from its left edge (see `shrink`), so the first tab stays put.
  // Plain GUTTER on Android, where GUTTER itself is three times iOS's — any
  // multiple of it spread the tabs there a thumb's width apart.
  tabsItems: {
    flexDirection: 'row', alignItems: 'center',
    gap: Platform.OS === 'android' ? GUTTER : 16,
    transformOrigin: 'left center',
  },
  // Full width, edge to edge — the row scrolls under both sides of the screen.
  tabsScroll: { width: '100%' },
  // Under the scrim and the buttons, over the screen's content.
  ground: { position: 'absolute', left: 0, right: 0, zIndex: 18 },
  // Black over the blur — enough that labels read over any photo, not so
  // much that the blur stops showing through.
  // The page's own ground (COLOR_GRAY_10), so at rest the header and the
  // content under it read as one surface; still a tint, so the blur shows
  // as things scroll beneath.
  groundTint: { backgroundColor: 'rgba(10,10,10,0.88)' },
  // The first tab starts TABS_START_PAD in; the padding is on the content,
  // not the scroll view, so the row itself still runs to both edges.
  tabsRow: {
    alignItems: 'center',
    paddingLeft: TABS_START_PAD,
    // Past the last tab: room for the stuck indent, so it can still scroll
    // fully into view, plus clear space so it doesn't end hard against the
    // screen edge when scrolled all the way along.
    paddingRight: GUTTER + TABS_STUCK_INDENT + TABS_END_SPACE,
    paddingVertical: 10,
    minHeight: HEADER_TABS_HEIGHT,
  },
  // Semibold at rest.
  tabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabLabel: { fontSize: 17, fontFamily: FONT_INTER.semibold, letterSpacing: 0.2 },
  // Stuck, and scaled down: a step heavier, so it reads as the same weight.
  tabLabelStuck: { fontFamily: FONT_INTER.bold },
  // The unlit tabs a weight lighter, at rest and stuck, so the lit one leads.
  tabLabelIdle: { fontFamily: FONT_INTER.medium },
  tabLabelIdleStuck: { fontFamily: FONT_INTER.semibold },
  // Always there, transparent when unlit, so every label sits at the same
  // height whichever tab is active.
  // A touch thicker than a hairline so its round ends show.
  tabUnderline: { height: 2, borderRadius: 999, marginTop: 3, overflow: 'hidden' },

  // Behind the bar, and starting at the physical top of the screen rather than
  // below the safe-area inset — the status bar is translucent, so the content
  // runs underneath it too.
  scrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 19,
  },

  bar: {
    position: 'absolute',
    left: 0, right: 0,
    zIndex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: BAR_PAD_H,
  },

  leftActions:  { flexDirection: 'row', alignItems: 'center' },
  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 7 },

  btn: {
    width: BTN, height: BTN,
    borderRadius: BTN_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLOR_BLACK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  btnIcon: {
    // Fills whatever the parent leaves — `BTN` on a plain button, two points
    // less on a bordered one. Fixed at `BTN` it overflowed the stroke.
    width: '100%', height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the avatar to the button's corners. Sits inside the shadowed view
    // so overflow:hidden can't crop the shadow.
    borderRadius: BTN_RADIUS,
    overflow: 'hidden',
  },
  btnRound: { borderRadius: BTN / 2 },
  // Labelled buttons size to their content instead of the fixed square.
  // Unfilled, and no rounded ground to fill — the radius would only show as a
  // pressed-state artefact on a button that has no surface.
  btnBare: { backgroundColor: 'transparent' },
  btnOutlined: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    // 40% rather than solid: at full white the stroke was the brightest thing
    // in the bar and read as a focus ring rather than an edge.
    borderColor: COLOR_BORDER,
  },
  backBtn:     { width: BACK_W },
  btnWide:     { width: undefined, paddingHorizontal: 11 },
  btnIconWide: {
    width: undefined, flexDirection: 'row', alignItems: 'center', gap: 6.5,
    overflow: 'visible',
  },

  logo: { width: 25, height: 25 },
  // A box the size of the *rotated* word, so the row lays out around what you
  // actually see. Pulled in tighter than the button's own gap: PRO belongs to
  // the mark, not beside it.
  proMark: {
    width: 11, height: PRO_LEN,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: -1,
  },
  proMarkText: {
    fontSize: 9.5, fontFamily: FONT_INTER.black, color: ICON,
    letterSpacing: 0.8,
    // Reads top-to-bottom. The width is the word's own length, overflowing the
    // box before the rotation swings it onto the short axis; both are centred
    // on the same point, so it lands centred.
    width: PRO_LEN, textAlign: 'center',
    transform: [{ rotate: '90deg' }],
  },

});
