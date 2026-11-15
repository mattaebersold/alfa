import React, { useCallback, useRef, useState } from 'react';
import {
  View, TouchableOpacity, StyleSheet, ScrollView, Linking, Dimensions, Platform, Alert, type ImageSourcePropType,
} from 'react-native';
import { Text } from '../theme/Text';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Constants from 'expo-constants';
import { Menu, X, ChevronRight, Settings, LogOut } from 'lucide-react-native';
import GrowPanel, { type GrowOrigin } from '../panels/GrowPanel';
import HeaderButton from './HeaderButton';
import Avatar from '../components/Avatar';
import { useOrsDispatch, useOrsSelector } from '../store/createStore';
import { logout } from '../auth/authSlice';
import { appConfig } from '../constants/appConfig';
import { colors } from '../theme/colors';
import { useIsPro, useBrandColor } from '../theme/useColors';
import { COMMON_RADIUS, PILL_RADIUS } from '../theme/radius';
import { FONT_INTER } from '../theme/fonts'

/**
 * alfa's menu, for any app: a header button that grows into a panel.
 *
 * The frame is shared — the app's mark and name across the top, the close X,
 * and a footer of small print (version, log out, privacy and terms) — and the
 * app fills the middle from the parts below: an account card, inbox pills, a
 * grid of tiles, and slabs. Each app's menu is its own because the apps are
 * different places; only how a menu looks and moves is the same.
 *
 * The children get `go(run)`, which closes the panel and runs `run` once it
 * has gone. Navigation belongs there: iOS won't present a screen over a modal
 * that's still dismissing.
 */

/** The panel is nine tenths of the screen; the tiles are sized off that. */
const PANEL_WIDTH = Dimensions.get('window').width * 0.9;
/** Half the row, minus the 8px gutter — and a pixel of slack, so rounding can't wrap the pair. */
const TILE_WIDTH = Math.floor((PANEL_WIDTH - 32 - 8) / 2) - 1;

const PANEL_BG   = '#000000';
const TEXT_HI    = '#FFFFFF';
const TEXT_MID   = 'rgba(255,255,255,0.6)';
const TEXT_FAINT = 'rgba(255,255,255,0.45)';
const DIVIDER    = 'rgba(255,255,255,0.1)';
const TILE_BG    = 'rgba(255,255,255,0.07)';
const CHIP_BG    = 'rgba(255,255,255,0.1)';
const BRASS      = '#E5C58E';
/** alfa's cream — the one light surface in a dark menu, so the account card leads the eye. */
const CREAM      = '#F7F1D9';

const TERMS_URL = 'https://openroadsociety.co/terms-of-service';

type Icon = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

export interface MenuApi {
  /** Close the menu, then run `run` once it has gone. */
  go: (run?: () => void) => void;
}

export default function MenuButton({ logo, title, privacyUrl, children }: {
  /** The app's mark, beside its name in the panel's header. */
  logo: ImageSourcePropType;
  /** Defaults to the shared appName. */
  title?: string;
  /** This app's privacy policy (murray's /apps/<slug>/privacy). */
  privacyUrl: string;
  children: (api: MenuApi) => React.ReactNode;
}) {
  const btnRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<GrowOrigin | null>(null);

  const openMenu = useCallback(() => {
    const node = btnRef.current;
    if (!node) { setOpen(true); return; }
    node.measureInWindow((x, y, w, h) => {
      setOrigin({ x, y, w, h });
      setOpen(true);
    });
  }, []);

  return (
    <>
      <HeaderButton ref={btnRef} label="Menu" onPress={openMenu}>
        <Menu size={22} color="#FFFFFF" strokeWidth={2.2} />
      </HeaderButton>
      <GrowPanel visible={open} origin={origin} onClose={() => setOpen(false)} surface={PANEL_BG}>
        {({ closeThen }) => (
          <MenuBody logo={logo} title={title ?? appConfig().appName} privacyUrl={privacyUrl} go={closeThen}>
            {children({ go: closeThen })}
          </MenuBody>
        )}
      </GrowPanel>
    </>
  );
}

function MenuBody({ logo, title, privacyUrl, go, children }: {
  logo: ImageSourcePropType;
  title: string;
  privacyUrl: string;
  go: MenuApi['go'];
  children: React.ReactNode;
}) {
  const dispatch = useOrsDispatch();
  const isPro = useIsPro();
  // Measured: the list has to start below whatever the header adds up to.
  const [headerH, setHeaderH] = useState(60);
  const version = Constants.expoConfig?.version;

  /** Confirmed — it's an icon-sized control beside others, and getting back in means a password. */
  const signOut = () => Alert.alert('Log out?', "You'll need to sign in again.", [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Log out', style: 'destructive', onPress: () => go(() => dispatch(logout())) },
  ]);

  return (
    <View style={styles.fill}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.scrollContent, { paddingTop: headerH + 10 }]}
        showsVerticalScrollIndicator={false}
      >
        {children}

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            {version ? <Text style={styles.footerVersion}>v{version}</Text> : <View />}
            {/* Quietly, as text: the least-used control in the menu shouldn't
                carry the most weight in it. The dialog protects the tap. */}
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={signOut}
              activeOpacity={0.7}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Log out"
            >
              <LogOut size={14} color={TEXT_MID} />
              <Text style={styles.logoutText}>Log out</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerCopy}>© {new Date().getFullYear()} Open Road Society</Text>
            <View style={styles.footerLinks}>
              <TouchableOpacity onPress={() => Linking.openURL(privacyUrl)} hitSlop={8}>
                <Text style={styles.footerLink}>Privacy</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Linking.openURL(TERMS_URL)} hitSlop={8}>
                <Text style={styles.footerLink}>Terms</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* After the list so it paints on top: the blur samples what passes under it. */}
      <View style={styles.panelHeader} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        {Platform.OS === 'ios' && <BlurView tint="dark" intensity={55} style={StyleSheet.absoluteFill} />}
        <View style={[StyleSheet.absoluteFill, styles.panelHeaderTint]} />
        <View style={styles.titleRow}>
          <Image source={logo} style={styles.titleLogo} contentFit="contain" />
          <Text style={[styles.titleText, isPro && { color: colors.pro }]} numberOfLines={1}>{title}</Text>
          {isPro && (
            <View style={styles.proPill}>
              <Text style={styles.proPillText}>PRO</Text>
            </View>
          )}
          <View style={styles.fill} />
          <TouchableOpacity onPress={() => go()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close menu">
            <X size={22} color={TEXT_HI} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * You — avatar, a title, your handle, and a cog. Cream, so it's found first
 * in a dark menu.
 */
export function MenuUserCard({ title, onPress }: { title: string; onPress: () => void }) {
  const me = useOrsSelector((s) => s.auth.userInfo);
  if (!me) return null;
  return (
    <TouchableOpacity
      style={styles.userCard}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Avatar user={me} size={44} />
      <View style={styles.userCardText}>
        <Text style={styles.userCardName} numberOfLines={1}>{title}</Text>
        <Text style={styles.userCardSub} numberOfLines={1}>@{me.username}</Text>
      </View>
      <View style={styles.userCardCog}>
        <Settings size={19} color={CREAM} strokeWidth={2.2} />
      </View>
    </TouchableOpacity>
  );
}

/** A row of MenuPills, sharing it evenly. */
export function MenuPillRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.pillRow}>{children}</View>;
}

/**
 * Something that might be waiting for you — outlined and inline, so it reads
 * as a different kind of thing from the grid of places under it.
 */
export function MenuPill({ label, Icon, count, onPress }: {
  label: string;
  Icon: Icon;
  count?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.pill} onPress={onPress} activeOpacity={0.75}>
      <Icon size={15} color={TEXT_MID} />
      <Text style={styles.pillLabel} numberOfLines={1}>{label}</Text>
      {count != null && count > 0 && (
        <View style={[styles.count, styles.countInline]}>
          <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/** Two-column grid of MenuTiles. */
export function MenuGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** A place to go: icon over label, half a row (or all of it, `wide`). */
export function MenuTile({ label, Icon, onPress, count, wide }: {
  label: string;
  Icon: Icon;
  onPress: () => void;
  count?: number;
  wide?: boolean;
}) {
  return (
    <TouchableOpacity style={[styles.tile, wide && styles.tileWide]} onPress={onPress} activeOpacity={0.75}>
      <Icon size={19} color={TEXT_MID} />
      <Text style={styles.tileLabel} numberOfLines={1}>{label}</Text>
      {count != null && count > 0 && (
        <View style={[styles.count, styles.countCorner]}>
          <Text style={styles.countText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * A full-width slab in the account's colour — gold for Pro, blue otherwise —
 * for things that aren't somewhere you browse: support, the wider society.
 * Slabs after the first sit closer to it.
 */
export function MenuSlab({ label, Icon, onPress, first }: {
  label: string;
  Icon: Icon;
  onPress: () => void;
  /** The first of a run: a wider gap above it. */
  first?: boolean;
}) {
  const fill = useBrandColor();
  return (
    <TouchableOpacity
      style={[styles.slab, { backgroundColor: fill, marginTop: first ? 20 : 8 }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Icon size={20} color="#000000" />
      <Text style={styles.slabText}>{label}</Text>
      <ChevronRight size={18} color="#000000" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },

  panelHeader: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 14,
    overflow: 'hidden',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER,
  },
  panelHeaderTint: { backgroundColor: 'rgba(0,0,0,0.62)' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  titleLogo: { width: 30, height: 30, borderRadius: 7 },
  titleText: { flexShrink: 1, fontSize: 19, fontFamily: FONT_INTER.semibold, letterSpacing: 0.3, color: CREAM },
  proPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: PILL_RADIUS, backgroundColor: colors.pro },
  proPillText: { fontSize: 10, fontFamily: FONT_INTER.extrabold, color: '#000000', letterSpacing: 0.8 },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginBottom: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: COMMON_RADIUS, backgroundColor: CREAM,
  },
  userCardText: { flex: 1, minWidth: 0 },
  userCardName: { fontSize: 15, fontFamily: FONT_INTER.extrabold, color: '#000000' },
  userCardSub: { fontSize: 13, fontFamily: FONT_INTER.semibold, color: 'rgba(0,0,0,0.6)', marginTop: 1 },
  userCardCog: {
    width: 36, height: 36, borderRadius: COMMON_RADIUS,
    backgroundColor: '#121212',
    alignItems: 'center', justifyContent: 'center',
  },

  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  pill: {
    flex: 1, minWidth: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: PILL_RADIUS,
    borderWidth: 1, borderColor: DIVIDER,
  },
  pillLabel: { fontSize: 13, fontFamily: FONT_INTER.semibold, color: TEXT_HI, flexShrink: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 12 },
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 10, paddingVertical: 16, borderRadius: 12,
    backgroundColor: TILE_BG,
  },
  tileWide: { width: undefined, flexGrow: 1, flexBasis: '100%' },
  tileLabel: { fontSize: 12.5, fontFamily: FONT_INTER.bold, color: TEXT_HI, textAlign: 'center', flexShrink: 1 },

  count: {
    minWidth: 20, height: 20, borderRadius: PILL_RADIUS, paddingHorizontal: 6,
    backgroundColor: BRASS,
    alignItems: 'center', justifyContent: 'center',
  },
  countCorner: { position: 'absolute', top: 7, right: 7 },
  countInline: { marginLeft: 2 },
  countText: { fontSize: 11, fontFamily: FONT_INTER.bold, color: '#000000' },

  slab: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 14, borderRadius: COMMON_RADIUS,
  },
  slabText: { flex: 1, fontSize: 14, fontFamily: FONT_INTER.medium, color: '#000000' },

  footer: {
    marginTop: 20, paddingTop: 16, gap: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
  },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerVersion: {
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: PILL_RADIUS, overflow: 'hidden',
    backgroundColor: CHIP_BG,
    // Inter with even-width digits — monospace is kept for What's New alone.
    fontSize: 11, letterSpacing: 0.2, color: TEXT_MID,
    fontVariant: ['tabular-nums'],
  },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 8 },
  logoutText: { fontSize: 13, fontFamily: FONT_INTER.semibold, color: TEXT_MID },
  footerCopy: { fontSize: 12, color: TEXT_FAINT },
  footerLinks: { flexDirection: 'row', gap: 12 },
  footerLink: { fontSize: 12, color: TEXT_MID },
});
