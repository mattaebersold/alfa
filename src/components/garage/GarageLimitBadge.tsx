import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { GetProButton, ProUpsellModal } from '../pro/ProUpsell';
import { CAR_LIMIT_BASIC } from '../../constants/limits';

/**
 * How much of the garage is used, and what Pro would change about that.
 *
 * A basic member sees "3 of 5 cars" — a count and a boundary in the same
 * breath. The point is that the limit is legible *before* they run into it,
 * rather than being announced by a button that has stopped working. A Pro
 * member has no boundary to state, so they just get the count.
 *
 * The upsell sits behind the info button rather than on the screen. Someone
 * with two cars doesn't need to be sold anything; someone at four will look.
 * Making it a question the member asks keeps the screen about their garage.
 */
export default function GarageLimitBadge({
  count,
  isPro,
  style,
}: {
  count: number;
  isPro: boolean;
  style?: any;
}) {
  const c = useColors();
  const brand = useBrandColor();
  const [open, setOpen] = useState(false);

  const atLimit = !isPro && count >= CAR_LIMIT_BASIC;
  const label = isPro
    ? `${count} ${count === 1 ? 'car' : 'cars'}`
    : `${count} of ${CAR_LIMIT_BASIC} cars`;

  return (
    <>
      <View style={[styles.row, style]}>
        <View
          style={[
            styles.chip,
            { backgroundColor: c.secondary, borderColor: c.borderDark },
            atLimit && { borderColor: brand },
          ]}
        >
          <Text style={[styles.chipText, { color: atLimit ? brand : c.grey }]}>{label}</Text>
        </View>

        {/* Pro members have nothing to be told here — the button would open a
            modal explaining a benefit they already have.

            Labelled rather than an info glyph: an (i) asks the member to be
            curious before it will tell them anything, and the gold says which
            kind of answer is behind it. */}
        {!isPro && <GetProButton onPress={() => setOpen(true)} />}
      </View>

      <ProUpsellModal
        visible={open}
        onClose={() => setOpen(false)}
        title="Unlimited garage with Pro"
        message={`A basic membership holds ${CAR_LIMIT_BASIC} cars. Pro removes the limit — every car you've owned, kept in one place.`}
      />
    </>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 7 },
  chip:     { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
