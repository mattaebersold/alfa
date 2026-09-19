import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { sentenceToneColor, type SentencePart } from './alertFormat';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { withAlpha } from '../../constants/colors';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * A rule, read as a sentence, with each choice as an inline badge.
 *
 * The badges are the point. A member with six alerts is scanning for the one
 * about wheels, and colour finds it faster than reading six sentences to the
 * end — what you're watching, what has to happen, the price cap and the place
 * each keep their own tint wherever the sentence appears. The words between
 * them stay plain, because grammar isn't a choice anyone made.
 *
 * Laid out as wrapping rows rather than one run of nested Text: a background
 * on nested Text can't take a corner radius or padding on Android, which is
 * the difference between a badge and a highlighter pen.
 */
export default function AlertSentence({ parts, textStyle }: {
  parts: SentencePart[];
  /** Type scale from the host — the list and the preview size it differently. */
  textStyle?: StyleProp<TextStyle>;
}) {
  const colors = useColors();
  const brand = useBrandColor();

  return (
    <View style={styles.row}>
      {parts.map((part, i) => {
        if (!part.strong) {
          // Plain grammar, split on words so a long sentence wraps where
          // English would rather than pushing a whole clause to the next line.
          return part.text
            .split(/(\s+)/)
            .filter((w) => w.trim())
            .map((word, j) => (
              <Text key={`${i}-${j}`} style={[styles.plain, { color: colors.muted }, textStyle]}>
                {word}
              </Text>
            ));
        }

        const tint = sentenceToneColor(part.tone, { brand, fg: colors.fg });
        return (
          <View
            key={i}
            style={[styles.badge, { backgroundColor: withAlpha(tint, 0.16), borderColor: withAlpha(tint, 0.5) }]}
          >
            <Text style={[styles.badgeText, { color: tint }, textStyle]} numberOfLines={1}>
              {part.text}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Baseline rather than centre: a badge is taller than a bare word, and
  // centring would leave the plain words floating between them.
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  plain: { fontSize: 15, lineHeight: 22 },
  badge: {
    paddingHorizontal: 7, paddingVertical: 1,
    borderRadius: COMMON_RADIUS, borderWidth: 1,
    maxWidth: '100%',
  },
  badgeText: { fontSize: 14, lineHeight: 20, fontWeight: '800' },
});
