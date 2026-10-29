import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@ors/kit';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS, GUTTER, COLOR_GRAY_30 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts'

/**
 * The shell both suggestion rows sit in.
 *
 * They used to be full-bleed bands separated by hairlines, which read as more
 * feed rather than as something the app was offering. This is the same contained
 * card as the "What's on your mind..." prompt above them — inset from the screen
 * edges, rounded, on `card` — so the whole top of the feed is one family of
 * objects.
 *
 * Horizontal padding is deliberately not applied to the children: the rows
 * scroll horizontally and need to run to the card's edge, so each supplies its
 * own leading inset and end spacer.
 */
interface SuggestionCardProps {
  title: string;
  /** Opens the hide dialog. Omit to render the card without a close button. */
  onClose?: () => void;
  /**
   * No card: full screen width, straight on the feed's ground. For a row whose
   * own cards already carry a surface — boxing cards inside a card is one frame
   * too many. The heading and the row keep the same GUTTER inset either way.
   */
  bare?: boolean;
  /** A small text link beside the heading — "View all". */
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}

/**
 * The rows' inset inside the card — wider than the app's GUTTER, which on iOS
 * left the heading and the first tile nearly touching the card's edge.
 */
export const SUGGESTION_CARD_PAD = 14;
/** A `bare` row has no card to be inset from: it keeps the feed's GUTTER. */
export const SUGGESTION_BARE_PAD = GUTTER;

export default function SuggestionCard({ title, onClose, bare, action, children }: SuggestionCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, bare && styles.bare]}>
      <View style={[styles.header, bare && styles.headerBare]}>
        <Text style={[styles.heading, { color: colors.fg }]}>{title}</Text>
        <View style={styles.headerEnd}>
          {action && (
            <TouchableOpacity
              onPress={action.onPress}
              hitSlop={12}
              accessibilityRole="link"
            >
              {/* Grey, not the brand colour: a way through to the full list,
                  not the row's point — the members and cars are. */}
              <Text style={[styles.action, { color: colors.grey }]}>{action.label}</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            // Says what it does: an X read as "close this for now", where it
            // opens the choice to hide the row.
            <TouchableOpacity
              style={[styles.close, { backgroundColor: colors.segment }]}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Hide ${title}`}
            >
              <Text style={[styles.closeText, { color: colors.fg }]}>Hide</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  // The same grey box as the feed's post cards (FeedItemCard), on the same
  // GUTTER, so a suggestion row reads as one more card in the feed. Clipped,
  // so the row scrolling sideways inside stops at the box's rounded edge.
  card: {
    marginHorizontal: GUTTER,
    marginTop: 8,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: COMMON_RADIUS,
    backgroundColor: COLOR_GRAY_30,
    overflow: 'hidden',
  },
  // With no surface to sit inside, the card's padding was only empty space
  // above the heading and below the row.
  bare: { marginHorizontal: 0, marginTop: 4, borderRadius: 0, paddingTop: 4, paddingBottom: 4, backgroundColor: 'transparent', overflow: 'visible' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SUGGESTION_CARD_PAD, marginBottom: 10,
  },
  headerBare: { paddingHorizontal: SUGGESTION_BARE_PAD },
  heading: { fontSize: 15, fontFamily: FONT_INTER.bold, letterSpacing: 0.3 },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { height: 28, paddingHorizontal: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 12, fontFamily: FONT_INTER.bold },
  action: { fontSize: 12, fontFamily: FONT_INTER.bold },
});
