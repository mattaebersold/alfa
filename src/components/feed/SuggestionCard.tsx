import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COMMON_RADIUS } from '../../constants/radius';

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
   * too many. The heading and the row keep the same 12 inset either way.
   */
  bare?: boolean;
  /** A small text link beside the heading — "View all". */
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
}

export const SUGGESTION_CARD_PAD = 12;

export default function SuggestionCard({ title, onClose, bare, action, children }: SuggestionCardProps) {
  const colors = useColors();
  const brand = useBrandColor();

  return (
    <View style={[styles.card, bare ? styles.bare : { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.fg }]}>{title}</Text>
        <View style={styles.headerEnd}>
          {action && (
            <TouchableOpacity
              onPress={action.onPress}
              hitSlop={12}
              accessibilityRole="link"
            >
              <Text style={[styles.action, { color: brand }]}>{action.label}</Text>
            </TouchableOpacity>
          )}
          {onClose && (
            // A round button rather than a bare glyph, so it reads as a control
            // beside the "View all" text rather than as punctuation after it.
            <TouchableOpacity
              style={[styles.close, { backgroundColor: colors.segment }]}
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Hide ${title}`}
            >
              <X size={13} color={colors.fg} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 8,
    marginTop: 8,
    paddingTop: 12,
    paddingBottom: 12,
    borderRadius: COMMON_RADIUS,
  },
  // With no surface to sit inside, the card's padding was only empty space
  // above the heading and below the row.
  bare: { marginHorizontal: 0, marginTop: 4, borderRadius: 0, paddingTop: 4, paddingBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SUGGESTION_CARD_PAD, marginBottom: 10,
  },
  heading: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  headerEnd: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  action: { fontSize: 12, fontWeight: '700' },
});
