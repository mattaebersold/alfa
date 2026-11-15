import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { Text } from '../../theme/Text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, UserRound } from 'lucide-react-native';
import SlideSheet from '../ui/SlideSheet';
import { Image } from '../ui/AppImage';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import { carHeroUrl } from '../../utils/image';
import type { GarageCar } from '../../types/api';
import { PANE_BG, SHEET_RADIUS } from '../../constants/config';
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
  const insets = useSafeAreaInsets();
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
    <SlideSheet
      visible={visible}
      onClose={onClose}
      onDismissed={runChosen}
      sheetStyle={[
        styles.sheet,
        { backgroundColor: PANE_BG, paddingBottom: Math.max(insets.bottom, Platform.OS === 'android' ? 48 : 12) + 8 },
      ]}
    >
      <View style={styles.grabber} />
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
    </SlideSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: 12, paddingTop: 8, maxHeight: '80%',
  },
  grabber: {
    alignSelf: 'center', width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: 8,
  },
  head:    { paddingHorizontal: 6, paddingVertical: 10 },
  title:   { fontSize: 15, fontFamily: FONT_INTER.bold },
  list:    { flexGrow: 0 },
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
