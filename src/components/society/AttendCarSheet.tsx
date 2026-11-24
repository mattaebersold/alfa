import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text } from '../../theme/Text';
import { Check, UserRound } from 'lucide-react-native';
import SharedModal, { PANE_GRABBER_H } from '../ui/SharedModal';
import { Image } from '../ui/AppImage';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { carHeroUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { FONT_INTER } from '../../constants/fonts';

export const carName = (car: Pick<GarageCar, 'title' | 'year' | 'make' | 'model'>) =>
  car.title || [car.year, car.make, car.model].filter(Boolean).join(' ') || 'Car';

/**
 * "Which car are you bringing?" — raised by Attend when you have cars in your
 * garage, and again by "Change" once you're going. One row per car, then
 * "Just me" for turning up without one.
 *
 * The choice runs once the sheet has slid away, like ActionSheet: the attend
 * call refetches the pane under it, and iOS won't present over a closing modal.
 */
export default function AttendCarSheet({ visible, cars, selectedId, title = 'Which car are you bringing?', onChoose, onClose }: {
  visible: boolean;
  cars: GarageCar[];
  /** Ticked — the car you already said, when changing. */
  selectedId?: string | null;
  title?: string;
  /** The car's internal_id, or null for "Just me". */
  onChoose: (carId: string | null) => void;
  onClose: () => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const chosen = useRef<(() => void) | null>(null);

  const choose = (carId: string | null) => {
    chosen.current = () => onChoose(carId);
    onClose();
  };
  const runChosen = () => {
    const run = chosen.current;
    chosen.current = null;
    if (run) requestAnimationFrame(run);
  };

  const row = (key: string, carId: string | null, label: string, thumb: React.ReactNode) => {
    const selected = selectedId !== undefined && (selectedId ?? null) === carId;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.option, { borderTopColor: colors.border }]}
        onPress={() => choose(carId)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ selected }}
      >
        {thumb}
        <View style={styles.optionText}>
          <Text style={[styles.optionTitle, { color: colors.fg }]} numberOfLines={1}>{label}</Text>
        </View>
        {selected ? <Check size={18} color={brand} strokeWidth={2.6} /> : null}
      </TouchableOpacity>
    );
  };

  return (
    // The app's one pane (SharedModal), sized to the list — its grabber
    // floats over the top, and it clears the home indicator itself.
    <SharedModal
      visible={visible}
      onClose={onClose}
      onDismissed={runChosen}
      hideHeader
      fitContent
    >
      <View style={styles.sheet}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
      </View>
      <ScrollView style={styles.list} bounces={false}>
        {cars.map((car) => {
          const uri = carHeroUrl(car, 'thumb');
          return row(
            car.internal_id,
            car.internal_id,
            carName(car),
            uri
              ? <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
              : <View style={[styles.thumb, { backgroundColor: colors.secondary }]} />,
          );
        })}
        {row('none', null, 'Just me', (
          <View style={[styles.thumb, styles.thumbIcon, { backgroundColor: colors.secondary }]}>
            <UserRound size={18} color={colors.fg} />
          </View>
        ))}
      </ScrollView>
      </View>
    </SharedModal>
  );
}

const styles = StyleSheet.create({
  // Clear of the grabber floating over the top; shrinks so a long garage
  // scrolls once the pane hits its cap.
  sheet: { flexShrink: 1, paddingHorizontal: 12, paddingTop: PANE_GRABBER_H, paddingBottom: 8 },
  head:    { paddingHorizontal: 6, paddingVertical: 10 },
  title:   { fontSize: 15, fontFamily: FONT_INTER.bold },
  list:    { flexGrow: 0, flexShrink: 1 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 6, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  thumb:       { width: 56, height: 40, borderRadius: 8 },
  thumbIcon:   { alignItems: 'center', justifyContent: 'center' },
  optionText:  { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: 15, fontFamily: FONT_INTER.semibold },
});
