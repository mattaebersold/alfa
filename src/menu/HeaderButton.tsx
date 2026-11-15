import React, { forwardRef } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Avatar from '../components/Avatar';
import { useOrsSelector } from '../store/createStore';

/** alfa's header button: a 42pt square, so the row stays even. */
export const HEADER_BTN = 42;
/** Its corner radius — also where GrowPanel's box starts from. */
export const HEADER_BTN_RADIUS = 14;

/**
 * One of the header's outlined buttons — alfa's profile, garage and menu.
 *
 * A dark wash with a 40% white stroke rather than a brand fill: at full white
 * the stroke read as a focus ring, and a filled row of them made every button
 * as loud as the next. Forwarded ref so a panel can measure it and grow out
 * of it.
 */
const HeaderButton = forwardRef<View, {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}>(function HeaderButton({ label, onPress, children, style }, ref) {
  return (
    <View ref={ref} collapsable={false} style={[styles.shadow, style]}>
      <TouchableOpacity
        style={styles.btn}
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {children}
      </TouchableOpacity>
    </View>
  );
});

export default HeaderButton;

/**
 * Your own photo, as alfa's header carries it — the way to your profile.
 * Sized inside the stroke rather than under it, so the corners clip cleanly.
 */
export function ProfileButton({ onPress }: { onPress: () => void }) {
  const me = useOrsSelector((s) => s.auth.userInfo);
  return (
    <HeaderButton label="Your profile" onPress={onPress}>
      <Avatar user={me} size={HEADER_BTN - 2} radius={HEADER_BTN_RADIUS - 1} />
    </HeaderButton>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  btn: {
    width: HEADER_BTN, height: HEADER_BTN,
    borderRadius: HEADER_BTN_RADIUS,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
});
