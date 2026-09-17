import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import SharedModal from './SharedModal';
import OilSheen from './OilSheen';
import { APP_VERSION } from '../../utils/appVersion';
import { changelogFor, type ChangelogEntry } from '../../constants/changelog';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';
import { useBrandColor } from '../../hooks/useBrandColor';

/**
 * Which version's notes have been read.
 *
 * SecureStore rather than AsyncStorage, which isn't a dependency of this app —
 * see CarCreateScreen's draft, which stays in memory for the same reason. A
 * version string is not a secret, but this is the only key/value store on
 * disk here, and one short string in it is cheaper than a new native module.
 *
 * Stores the version rather than a boolean, so the next release is unseen
 * again without anything having to clear the flag.
 */
const SEEN_KEY = 'whatsNewSeenVersion';

/**
 * The white surface, and the ink on it. Deliberately not from `useColors`: the
 * drawer is white-on-dark throughout, and this is the one light slab in its
 * footer, so its colours are the button's rather than the theme's.
 */
const BTN_BG = '#FFFFFF';
const BTN_FG = '#0A0A0A';
const BTN_FG_MID = 'rgba(0,0,0,0.55)';

/** Sheet colours, matched to SharedModal's near-black ground. */
const TEXT_HI = '#FFFFFF';
const TEXT_MID = 'rgba(255,255,255,0.72)';
const TEXT_FAINT = 'rgba(255,255,255,0.45)';
const DIVIDER = 'rgba(255,255,255,0.1)';

/**
 * "What's new in 1.42", at the foot of the menu, and the panel it opens.
 *
 * Renders nothing at all when the running version has no notes written up (see
 * src/constants/changelog.ts) — an empty panel promising news is worse than no
 * button, and a button showing the *previous* version's list is worse than
 * both.
 *
 * The button owns its own modal and its own seen/unseen state so the drawer
 * only has to place it.
 */
export default function WhatsNewButton() {
  const entry = changelogFor(APP_VERSION);
  const brand = useBrandColor();
  const [open, setOpen] = useState(false);
  /**
   * Starts true — unread until proven read.
   *
   * The read happens a frame or two after mount, and starting at `false` meant
   * the badge popped in after the menu had already been drawn. Starting at
   * `true` it fades out instead, which is the less noticeable of the two, and
   * it's also the right answer when the store can't be read at all.
   */
  const [unseen, setUnseen] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const seen = await SecureStore.getItemAsync(SEEN_KEY);
        if (alive) setUnseen(seen !== APP_VERSION);
      } catch {
        // No store, or a keychain that won't open — the badge stays on. A dot
        // nobody can dismiss is a small annoyance; a crash in the menu is not.
      }
    })();
    return () => { alive = false; };
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    // Cleared on open rather than on close: the point at which you've seen it
    // is the point at which it's on screen, and a close that never fires —
    // backgrounding the app from the open panel — shouldn't keep the dot.
    setUnseen(false);
    SecureStore.setItemAsync(SEEN_KEY, APP_VERSION).catch(() => {
      // Nothing to do about it. Worst case the dot is back next launch.
    });
  }, []);

  if (!entry) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={handleOpen}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={`What's new in version ${APP_VERSION}`}
      >
        {/* The same film as the logo and the add button, in its pale tone and
            at a little more strength — there's no brand fill under this one to
            tint it. First child, so the label and icons sit on top of it. */}
        <OilSheen tone="pearl" radius={COMMON_RADIUS} opacity={0.62} />
        <Sparkles size={17} color={BTN_FG} strokeWidth={2.2} />
        <View style={styles.btnText}>
          <Text style={styles.btnLabel} numberOfLines={1}>
            What's new in {APP_VERSION}
          </Text>
        </View>
        {/* The unread mark. A dot rather than a count: there's one thing behind
            this button, so a number would only ever say "1". */}
        {unseen && <View style={[styles.dot, { backgroundColor: brand }]} />}
        <ChevronRight size={16} color={BTN_FG_MID} strokeWidth={2.5} />
      </TouchableOpacity>

      <WhatsNewSheet
        visible={open}
        onClose={() => setOpen(false)}
        entry={entry}
      />
    </>
  );
}

/**
 * The notes themselves — one section per category, in the order the data lists
 * them.
 *
 * A sized sheet rather than full height: a short version's notes shouldn't open
 * a screen-tall panel with a hand's worth of empty black under them, and
 * SharedModal caps a long one at 90% and lets the list scroll.
 */
function WhatsNewSheet({ visible, onClose, entry }: {
  visible: boolean;
  onClose: () => void;
  entry: ChangelogEntry;
}) {
  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      showClose
      titleContent={(
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle} numberOfLines={1}>What's new</Text>
          <Text style={styles.headerVersion}>v{APP_VERSION}</Text>
        </View>
      )}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.date}>{entry.date}</Text>

        {entry.groups.map((group, gi) => (
          <View key={group.title} style={[styles.group, gi > 0 && styles.groupSpaced]}>
            <Text style={styles.groupTitle}>{group.title}</Text>
            {group.items.map((item) => (
              <View key={item} style={styles.item}>
                {/* A rule rather than a bullet glyph: the lines are sentences
                    and several of them wrap, and a dot leaves the second line
                    hanging under the marker instead of under the text. */}
                <View style={styles.itemRule} />
                <Text style={styles.itemText}>{item}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footNote}>
          That's everything in this release. Thanks for riding with us.
        </Text>
      </ScrollView>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderRadius: COMMON_RADIUS,
    backgroundColor: BTN_BG,
    // Clips the film to the corners, whatever the sheen's own radius rounds to.
    overflow: 'hidden',
  },
  btnText:  { flex: 1, minWidth: 0 },
  btnLabel: { fontSize: 14, fontWeight: '600', color: BTN_FG },
  dot: {
    width: 9, height: 9, borderRadius: PILL_RADIUS,
  },

  headerRow:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:   { flexShrink: 1, fontSize: 17, fontWeight: '700', color: TEXT_HI },
  headerVersion: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.1)',
    fontSize: 11, fontWeight: '700', letterSpacing: 0.2, color: TEXT_MID,
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  date: {
    fontSize: 12, fontWeight: '600', letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: TEXT_FAINT,
    marginBottom: 14,
  },

  group:       { gap: 8 },
  // A rule between sections, so a long list reads as parts rather than as one
  // run of sentences.
  groupSpaced: {
    marginTop: 18, paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
  },
  groupTitle: {
    fontSize: 13, fontWeight: '800', letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: TEXT_HI,
    marginBottom: 2,
  },
  item: { flexDirection: 'row', gap: 10 },
  itemRule: {
    // Aligned with the middle of the first line rather than its top, which is
    // where the eye reads a marker as belonging to the line.
    width: 10, height: 1, marginTop: 9,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  itemText: { flex: 1, fontSize: 14, lineHeight: 20, color: TEXT_MID },

  footNote: {
    marginTop: 22, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
    fontSize: 12, color: TEXT_FAINT,
  },
});
