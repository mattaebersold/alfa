import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { Text } from '@ors/kit';
import Avatar, { type AvatarUser } from '../ui/Avatar';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { FONT_INTER } from '../../constants/fonts';

/**
 * A member's photo with their username beside it — every byline, owner chip
 * and member row in the app, so they can't drift apart.
 *
 * The handle bare, without its "@", and the photo without Avatar's light
 * edge: next to a name the "@" was noise, and the ring a second border round
 * a small circle. `at` and `edge` bring either back where a place needs it.
 *
 * Tappable when given `onPress`, which is handed the row's rect so a summary
 * can grow out of the person (see SummaryModal).
 */
export default function UserByline({
  user,
  size = 26,
  name,
  fallback = 'member',
  meta,
  sub,
  color,
  subColor,
  nameStyle,
  subStyle,
  numberOfLines = 1,
  gap,
  at = false,
  edge = false,
  fill = false,
  onPress,
  disabled,
  activeOpacity = 0.7,
  accessibilityLabel,
  style,
  children,
}: {
  user?: AvatarUser | null;
  /** The photo's diameter. */
  size?: number;
  /** In place of the username — a display name, "You". */
  name?: string;
  /** When there's no username to show. */
  fallback?: string;
  /** On the name's line after a " · " — a time, a count. */
  meta?: string | null;
  /** A second line under the name — "added a car", a city. */
  sub?: React.ReactNode;
  /** The name's ink. Defaults to the foreground. */
  color?: string;
  /** The second line's ink. Defaults to grey. */
  subColor?: string;
  nameStyle?: StyleProp<TextStyle>;
  subStyle?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /** Between the photo and the name. Scales with the photo by default. */
  gap?: number;
  /** The username with its "@". */
  at?: boolean;
  /** Avatar's 1pt edge. */
  edge?: boolean;
  /** The name takes the row's spare width — for a row with something pinned at its end. */
  fill?: boolean;
  onPress?: (origin: SummaryOrigin | null) => void;
  disabled?: boolean;
  activeOpacity?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  /** After the name — a badge, a button. */
  children?: React.ReactNode;
}) {
  const colors = useColors();
  const ref = useRef<View>(null);
  const label = name ?? (user?.username ? `${at ? '@' : ''}${user.username}` : fallback);

  const content = (
    <>
      <Avatar user={user} size={size} edge={edge} />
      <View style={[styles.text, fill && styles.fill]}>
        <Text style={[styles.name, { color: color ?? colors.fg }, nameStyle]} numberOfLines={numberOfLines}>
          {label}{meta ? ` · ${meta}` : ''}
        </Text>
        {sub == null || sub === '' ? null : typeof sub === 'string' ? (
          <Text style={[styles.sub, { color: subColor ?? colors.grey }, subStyle]} numberOfLines={1}>{sub}</Text>
        ) : sub}
      </View>
      {children}
    </>
  );
  const rowStyle = [styles.row, { gap: gap ?? Math.max(6, Math.round(size * 0.3)) }, style];

  if (!onPress) return <View style={rowStyle}>{content}</View>;
  return (
    <TouchableOpacity
      ref={ref}
      style={rowStyle}
      onPress={() => measureOrigin(ref.current, onPress)}
      disabled={disabled}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (user?.username ? `View ${user.username}` : undefined)}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  // Shrinks before the photo does, and lets a long name truncate.
  text: { flexShrink: 1, minWidth: 0 },
  fill: { flex: 1 },
  name: { fontSize: 14, fontFamily: FONT_INTER.bold },
  sub:  { fontSize: 12, marginTop: 1 },
});
