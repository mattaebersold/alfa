import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { colors } from '../../constants/colors';
import { ProUpsell } from './ProUpsell';

/**
 * How much of an allowance is spent, as a bar.
 *
 * Shown before it matters rather than at the moment it bites — someone who can
 * see they're at 18 of 20 can pace themselves, where someone who finds out by
 * being refused has already lost the post they were writing.
 *
 * A Pro member has no allowance to spend, so they get the count and no bar:
 * a full-width bar reading "unlimited" is a progress indicator for something
 * that never progresses.
 */
export default function UsageMeter({
  label,
  used,
  limit,
  resetsAt,
  upsellTitle,
  upsellMessage,
  style,
}: {
  label: string;
  used: number;
  /** Null means unlimited — the bar is dropped rather than filled. */
  limit: number | null;
  /** ISO date the allowance renews. Only meaningful when limited. */
  resetsAt?: string | null;
  upsellTitle: string;
  upsellMessage: string;
  style?: any;
}) {
  const c = useColors();
  const brand = useBrandColor();

  const unlimited = limit === null;
  const ratio = unlimited ? 0 : Math.min(1, limit === 0 ? 1 : used / limit);
  const atLimit = !unlimited && used >= limit;
  // Warn before the wall, not at it.
  const nearLimit = !unlimited && !atLimit && ratio >= 0.8;

  const barColor = atLimit ? colors.red : nearLimit ? colors.pro : brand;

  const resets = resetsAt
    ? new Date(resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
    : null;

  return (
    <View style={[styles.wrap, { backgroundColor: c.card, borderColor: c.borderDark }, style]}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: c.fg }]}>{label}</Text>
        <Text style={[styles.count, { color: atLimit ? colors.red : c.grey }]}>
          {unlimited ? `${used}` : `${used} of ${limit}`}
        </Text>
      </View>

      {!unlimited && (
        <View style={[styles.track, { backgroundColor: c.secondary }]}>
          <View
            style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: barColor }]}
          />
        </View>
      )}

      <View style={styles.foot}>
        <Text style={[styles.hint, { color: c.grey }]}>
          {unlimited
            ? 'Unlimited with Pro'
            : atLimit
              ? `Limit reached${resets ? ` — resets ${resets}` : ''}`
              : resets
                ? `Resets ${resets}`
                : ''}
        </Text>

        {/* Nothing to sell someone who already has it. */}
        {!unlimited && (
          <ProUpsell title={upsellTitle} message={upsellMessage} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  head:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '700' },
  count: { fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 999, overflow: 'hidden' },
  fill:  { height: '100%', borderRadius: 999 },
  foot:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  hint:  { fontSize: 12, flexShrink: 1 },
});
