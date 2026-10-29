import React from 'react';
import { TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { Bookmark } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useGetLoggedInUserQuery, useToggleCarBookmarkMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useBrandColor } from '../../hooks/useBrandColor';
import { COLOR_WHITE } from '../../constants/config';

/**
 * Save someone's car to come back to — the cars part of the bookmarks panel,
 * beside posts (PostBookmarkButton) and models (the button on a model's page).
 *
 * Whether it's saved is read from your profile (`carBookmarks`), which the
 * toggle updates in the cache on the tap, so every place showing this car
 * agrees at once. Not for your own cars: the caller leaves it out for those,
 * and the server refuses them anyway.
 */
export default function CarBookmarkButton({ carId, size = 20, color = COLOR_WHITE, style }: {
  carId: string;
  size?: number;
  /** The unsaved outline's colour; saved, it fills in the brand colour. */
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const brand = useBrandColor();
  const isLoggedIn = useAppSelector((s) => s.auth.isLoggedIn);
  const { data: me } = useGetLoggedInUserQuery(undefined, { skip: !isLoggedIn });
  const saved = !!me?.carBookmarks?.includes(carId);
  const [toggle] = useToggleCarBookmarkMutation();

  const onPress = () => {
    if (!isLoggedIn || !carId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggle({ car_id: carId });
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.btn, style]}
      hitSlop={8}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove car from bookmarks' : 'Bookmark this car'}
      accessibilityState={{ selected: saved }}
    >
      <Bookmark
        size={size}
        color={saved ? brand : color}
        fill={saved ? brand : 'transparent'}
        strokeWidth={1.8}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
});
