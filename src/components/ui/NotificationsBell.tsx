import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { Bell, Mail, ChevronRight } from 'lucide-react-native';
import NotificationsList from '../notifications/NotificationsList';
import SummaryModal, { measureOrigin, useSummaryPanel, type SummaryOrigin } from './SummaryModal';
import { useGetBadgesQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { CONFIG, PILL_RADIUS, COLOR_BLACK, COLOR_COUNT_BADGE, COLOR_WHITE, COLOR_ON_ALERT } from '../../constants/config';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { useBrandColor, contrastText } from '../../hooks/useBrandColor';
import { FONT_INTER } from '../../constants/fonts';

/** Matches the other header buttons, so the row stays even. */
const BTN = 42;
/** Past this the badge stops counting and starts saying "lots". */
const BADGE_MAX = 10;

/**
 * Unread notifications, as a header button that opens into the list.
 *
 * The button is always there while something is waiting; only the count
 * bubble comes and goes.
 *
 * The list opens in the summary panel every other panel in the app uses
 * (SummaryModal) — the same box, close button, backdrop and tabs (PanelTabs)
 * as a post's likes and comments. It used to be a panel of its own, grown out
 * of the bell, and it had drifted into looking like a different thing.
 *
 * The list inside is the same component the full-screen notifications route
 * renders, so nothing about a notification behaves differently depending on
 * which way you opened it.
 */
/**
 * The bell in the header on screen, while there is one — so the menu's
 * Notifications can open this same panel rather than a pane of its own. Each
 * header's bell registers itself while its screen is focused; a screen behind
 * (frozen, see freezeOnBlur) never answers.
 */
let openFocusedBell: (() => void) | null = null;

/** Opens the on-screen header's notifications panel. False if no bell is showing to open it. */
export function openNotificationsPanel(): boolean {
  if (!openFocusedBell) return false;
  openFocusedBell();
  return true;
}

export default function NotificationsBell() {
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);

  // One poll for every badge the chrome draws — see getBadges.
  const { data: badges } = useGetBadgesQuery(undefined, {
    skip: !isLoggedIn,
    pollingInterval: CONFIG.NOTIFICATION_POLL_INTERVAL,
  });

  /**
   * Unread messages count towards the bell too.
   *
   * A message was the one thing that could be waiting for you with nothing on
   * screen to say so. They're both "something arrived for you", so they're
   * both on the badge, and the panel lists them together.
   */
  const notificationCount = badges?.notifications ?? 0;
  const messageCount = badges?.messages ?? 0;
  const count = notificationCount + messageCount;

  const btnRef = useRef<View>(null);
  /** The panel is asked to show. */
  const [open, setOpen] = useState(false);
  /** The panel is on screen — still true while it animates away. */
  const [up, setUp] = useState(false);
  const [origin, setOrigin] = useState<SummaryOrigin | null>(null);

  const openPanel = useCallback(() => {
    measureOrigin(btnRef.current, (o) => {
      setOrigin(o);
      setUp(true);
      setOpen(true);
    });
  }, []);

  // The menu's way in — see openNotificationsPanel.
  const isFocused = useIsFocused();
  useEffect(() => {
    if (!isFocused || !isLoggedIn) return;
    const open = () => openPanel();
    openFocusedBell = open;
    return () => { if (openFocusedBell === open) openFocusedBell = null; };
  }, [isFocused, isLoggedIn, openPanel]);

  if (!isLoggedIn) return null;

  /**
   * No bell when nothing is waiting.
   *
   * `count` is notifications *and* unread messages, so this only disappears
   * when both are clear. Notifications remain reachable from the drawer
   * either way.
   *
   * `up` keeps it mounted while the panel is showing (and closing):
   * archiving the last notification takes the count to zero, and without
   * this the panel would be pulled out from under whoever was reading it.
   */
  if (count === 0 && !up) return null;

  return (
    <>
      <TouchableOpacity
        ref={btnRef}
        style={styles.btn}
        onPress={openPanel}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Notifications, ${count} unread`}
      >
        <Bell size={24} color={COLOR_WHITE} strokeWidth={2.2} />
        {count > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {count > BADGE_MAX ? `${BADGE_MAX}+` : count}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {up && (
        <SummaryModal
          visible={open}
          origin={origin}
          onClose={() => setOpen(false)}
          onClosed={() => setUp(false)}
        >
          <NotificationsPanelBody messageCount={messageCount} />
        </SummaryModal>
      )}
    </>
  );
}

/**
 * What's in the panel: unread messages first, when there are any, then the
 * list. Inside the panel so it can close it before going anywhere — iOS won't
 * present a screen over a modal still on its way out (closeThen).
 */
function NotificationsPanelBody({ messageCount }: { messageCount: number }) {
  const panel = useSummaryPanel();
  const navigation = useNavigation<any>();
  const tint = useBrandColor();
  const dismiss = useCallback((after?: () => void) => panel?.closeThen(after), [panel]);

  return (
    <>
      {/* Messages first, and only when there are unread ones. A standing
          "Messages" row on a panel about what's new would be navigation
          wearing a notification's clothes. */}
      {messageCount > 0 && (
        <TouchableOpacity
          style={styles.messagesRow}
          onPress={() => dismiss(() => navigation.navigate('Messages'))}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`${messageCount} unread ${messageCount === 1 ? 'message' : 'messages'}`}
        >
          <View style={[styles.messagesIcon, { backgroundColor: tint }]}>
            <Mail size={16} color={contrastText(tint)} strokeWidth={2.4} />
          </View>
          <View style={styles.messagesText}>
            <Text style={styles.messagesTitle}>
              {messageCount} unread {messageCount === 1 ? 'message' : 'messages'}
            </Text>
            <Text style={styles.messagesHint}>Open your inbox</Text>
          </View>
          <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      )}

      <NotificationsList onDismiss={dismiss} inPanel />
    </>
  );
}

const styles = StyleSheet.create({
  /**
   * No fill, no pill — just the glyph.
   *
   * The other four buttons in the row are destinations, and giving this one
   * the same brand-filled shape made "you have something waiting" read as a
   * fifth place to go. White on the header's own scrim, with the shadow kept:
   * the bar floats over content of any brightness, and an unbacked white icon
   * needs it to stay legible over a pale photo.
   */
  btn: {
    width: BTN, height: BTN,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLOR_BLACK,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    // The badge hangs off this button's top-right corner, over the menu button
    // next to it. zIndex/elevation on the badge alone can't fix that — a child
    // only stacks within its own parent, and the menu button is a later sibling
    // that paints over this whole button, badge included. Lifting the *button*
    // above its neighbour is what puts the badge on top: iOS reads the zIndex,
    // Android the elevation, and the elevation has to actually exceed the
    // header buttons' 6 rather than tie with it — a tie falls back to draw
    // order, which is exactly the case being fixed.
    zIndex: 5,
    elevation: 9,
  },
  // Bigger than the plain dot it replaces, because it now has to carry a
  // number.
  /**
   * Tucked against the glyph rather than hung off the button's corner.
   *
   * The button is a 44pt touch target around a 22pt bell, so a badge pinned to
   * the button's edge floated in the padding with a visible gap — it read as
   * belonging to the row, not to the bell. These offsets bring it to the
   * glyph's own top-right, and it shrinks to suit sitting that close.
   */
  badge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 19, height: 19, borderRadius: PILL_RADIUS,
    paddingHorizontal: 4,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLOR_COUNT_BADGE,
    zIndex: 10, elevation: 12,
  },
  badgeText: { fontSize: 10.5, fontFamily: FONT_INTER.extrabold, color: COLOR_ON_ALERT },

  messagesRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    // The panel's top room above it, as the tabs have when they lead.
    marginHorizontal: 16, marginTop: 18, marginBottom: -6,
    paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  messagesIcon: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
  },
  messagesText:  { flex: 1 },
  messagesTitle: { fontSize: 14, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  messagesHint:  { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 1 },
});
