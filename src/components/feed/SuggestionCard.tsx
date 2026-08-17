import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { X } from 'lucide-react-native';
import { useColors } from '../../hooks/useColors';

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
  children: React.ReactNode;
}

export const SUGGESTION_CARD_PAD = 12;

export default function SuggestionCard({ title, onClose, children }: SuggestionCardProps) {
  const colors = useColors();

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.fg }]}>{title}</Text>
        {onClose && (
          <TouchableOpacity
            onPress={onClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Hide ${title}`}
          >
            <X size={16} color={colors.grey} />
          </TouchableOpacity>
        )}
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
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SUGGESTION_CARD_PAD, marginBottom: 10,
  },
  heading: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
