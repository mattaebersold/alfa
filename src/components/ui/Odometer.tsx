import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * A number on a mechanical odometer.
 *
 * Mileage is the one figure on a car that everyone reads the same way, and as
 * plain text in a row of fields it looked like any other number. Here it looks
 * like where it came from: white digits on separate drums, each with the
 * shading of a cylinder, in a housing with a hairline between every wheel.
 *
 * The last drum is set apart the way the tenths wheel is on a real one — half a
 * digit lower, as though caught mid-turn. That single detail is most of what
 * makes the whole thing read as an odometer rather than as a row of boxes.
 */
export default function Odometer({
  value,
  /** Sits to the right of the housing. Pass null for the bare instrument. */
  unit = 'miles',
  size = 'md',
}: {
  value: number | string;
  unit?: string | null;
  size?: 'sm' | 'md';
}) {
  const miles = Number(value);
  if (!Number.isFinite(miles) || miles <= 0) return null;

  const digits = String(Math.round(miles)).split('');
  const sm = size === 'sm';
  const cell = sm ? styles.cellSm : styles.cell;
  const digit = sm ? styles.digitSm : styles.digit;

  return (
    <View style={styles.wrap}>
      <View style={[styles.housing, sm && styles.housingSm]}>
        {digits.map((d, i) => {
          const isLast = i === digits.length - 1;
          return (
            <View
              key={i}
              style={[
                cell,
                // Hairlines between the wheels, not around the outside — the
                // housing supplies that edge.
                i > 0 && styles.divider,
                isLast && styles.cellLast,
              ]}
            >
              {/* Light along the top, shadow at the bottom: a drum lit from
                  above, which is what stops the cells reading as flat tiles. */}
              <LinearGradient
                colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.55)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
              />
              <Text style={[digit, isLast && styles.digitLast]}>{d}</Text>
            </View>
          );
        })}
      </View>
      {unit ? <Text style={styles.unit}>{unit}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  housing: {
    flexDirection: 'row',
    backgroundColor: '#0E0E0E',
    borderRadius: 4,
    borderWidth: 1, borderColor: '#3C3C3C',
    overflow: 'hidden',
  },
  housingSm: { borderRadius: 3 },

  cell:   { width: 24, height: 36, alignItems: 'center', justifyContent: 'center' },
  cellSm: { width: 17, height: 26, alignItems: 'center', justifyContent: 'center' },
  // The tenths wheel: paler housing, as on the instrument itself.
  cellLast: { backgroundColor: '#1A1A1A' },
  divider:  { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: '#4A4A4A' },

  digit: {
    fontSize: 22, fontWeight: '700', color: '#F4F4F4',
    fontVariant: ['tabular-nums'], letterSpacing: 0.5,
  },
  digitSm: {
    fontSize: 15, fontWeight: '700', color: '#F4F4F4',
    fontVariant: ['tabular-nums'], letterSpacing: 0.3,
  },
  // Caught mid-turn.
  digitLast: { transform: [{ translateY: 2 }] },

  unit: {
    fontSize: 11, fontWeight: '700', color: '#8A8A8A',
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
});
