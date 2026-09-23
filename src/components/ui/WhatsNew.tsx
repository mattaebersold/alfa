import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Sparkles, ChevronRight } from 'lucide-react-native';
import SharedModal from './SharedModal';
import OilSheen from './OilSheen';
import { APP_VERSION } from '../../utils/appVersion';
import { changelogFor, changelogBefore, EARLIEST_SHOWN, type ChangelogEntry } from '../../constants/changelog';
import { COMMON_RADIUS, PILL_RADIUS } from '../../constants/radius';

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
/** The sheet is true black, so its rules are solid greys rather than white at low alpha. */
const SHEET_BG = '#000000';
const DIVIDER = '#2A2A2A';
const DIVIDER_STRONG = '#3C3C3C';

/**
 * "What's new in 1.42", at the foot of the menu, and the panel it opens.
 *
 * Renders nothing at all when the running version has no notes written up (see
 * src/constants/changelog.ts) — an empty panel promising news is worse than no
 * button, and a button showing the *previous* version's list is worse than
 * both.
 *
 * The button owns its own modal so the drawer only has to place it. It used
 * to carry an unread dot, tracked per version in the keychain; that came out —
 * the button is at the foot of the menu, the version is in its label, and a
 * dot that everybody sees once and then has to dismiss was a chore, not a cue.
 */
export default function WhatsNewButton() {
  const entry = changelogFor(APP_VERSION);
  const [open, setOpen] = useState(false);
  if (!entry) return null;

  return (
    <>
      <TouchableOpacity
        style={styles.btn}
        onPress={() => setOpen(true)}
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
 * A release number, as a pill wearing the same film as the button that opens
 * the panel: the white surface, the pearl sheen over it, black text. So the
 * panel's badge and the menu's button read as the same object.
 */
function VersionPill({ version }: { version: string }) {
  return (
    <View style={styles.versionPill}>
      <OilSheen tone="pearl" radius={PILL_RADIUS} opacity={0.62} />
      <Text style={styles.versionText}>v{version}</Text>
    </View>
  );
}

/** One version's notes — one section per category, in the order the data lists them. */
function VersionNotes({ entry }: { entry: ChangelogEntry }) {
  return (
    <>
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
    </>
  );
}

/**
 * The notes themselves: this version's first, then every version back to
 * EARLIEST_SHOWN under an "Earlier" rule, each with its own version pill, so
 * someone who skipped a few updates still reads what changed.
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
  const earlier = changelogBefore(APP_VERSION);
  return (
    <SharedModal
      visible={visible}
      onClose={onClose}
      showClose
      surface={SHEET_BG}
      titleContent={(
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle} numberOfLines={1}>What's new</Text>
          <VersionPill version={APP_VERSION} />
        </View>
      )}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.date}>{entry.date}</Text>
        <VersionNotes entry={entry} />

        {earlier.length > 0 && (
          <>
            <Text style={styles.earlierTitle}>Earlier versions</Text>
            {earlier.map(({ version, entry: past }) => (
              <View key={version} style={styles.earlier}>
                <View style={styles.earlierHead}>
                  <VersionPill version={version} />
                  <Text style={styles.earlierDate}>{past.date}</Text>
                </View>
                <VersionNotes entry={past} />
              </View>
            ))}
          </>
        )}

        <Text style={styles.footNote}>
          {earlier.length > 0
            ? `That's everything since ${EARLIEST_SHOWN}. Thanks for riding with us.`
            : "That's everything in this release. Thanks for riding with us."}
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

  headerRow:     { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle:   { flexShrink: 1, fontSize: 17, fontWeight: '700', color: TEXT_HI },
  // The button's surface, at pill size. Clips the sheen to the corners.
  versionPill: {
    paddingHorizontal: 11, paddingVertical: 4,
    borderRadius: PILL_RADIUS,
    backgroundColor: BTN_BG,
    overflow: 'hidden',
  },
  versionText: {
    fontSize: 13, fontWeight: '800', letterSpacing: 0.2, color: BTN_FG,
    fontVariant: ['tabular-nums'],
  },

  scrollContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  date: {
    fontSize: 12, fontWeight: '600',
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
    fontSize: 16, fontWeight: '800', letterSpacing: -0.2,
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

  // The break between this release and the ones before it: a heavier rule
  // than the one between sections, and a heading, so the eye knows the
  // list has changed gear rather than just gone on.
  earlierTitle: {
    marginTop: 28, paddingTop: 18,
    borderTopWidth: 1, borderTopColor: DIVIDER_STRONG,
    fontSize: 12, fontWeight: '700', letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: TEXT_FAINT,
  },
  earlier:     { marginTop: 16 },
  // The pill, and the month under it.
  earlierHead: { alignItems: 'flex-start', gap: 6, marginBottom: 12 },
  earlierDate: {
    fontSize: 12, fontWeight: '600',
    color: TEXT_FAINT,
  },

  footNote: {
    marginTop: 22, paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER,
    fontSize: 12, color: TEXT_FAINT,
  },
});
