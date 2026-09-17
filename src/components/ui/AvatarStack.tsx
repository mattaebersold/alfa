import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Avatar, { type AvatarUser } from './Avatar';
import { useColors } from '../../hooks/useColors';
import { PILL_RADIUS } from '../../constants/radius';

/** Faces shown before the rest collapse into the "+N" circle. */
export const AVATAR_STACK_MAX = 8;

/**
 * A row of overlapping faces, then "+N" for everyone past the cap.
 *
 * Who's in a group, at a glance — on the group's page and in its summary, which
 * used to carry two copies of this with different caps. The "+N" circle is one
 * more face in the stack: same size, same overlap.
 */
export default function AvatarStack({
  users,
  max = AVATAR_STACK_MAX,
  size = 30,
  /**
   * Everyone, when `users` is only some of them — a count from the server
   * against a page of faces. Defaults to `users.length`.
   */
  total,
  /** A ring in the surface colour behind the stack, so each overlap reads. */
  ringColor,
}: {
  users: (AvatarUser | undefined)[];
  max?: number;
  size?: number;
  total?: number;
  ringColor?: string;
}) {
  const colors = useColors();
  const shown = users.slice(0, max);
  const rest = (total ?? users.length) - shown.length;
  const ring = ringColor ? { borderWidth: 2, borderColor: ringColor, borderRadius: PILL_RADIUS } : null;
  const overlap = { marginRight: -Math.round(size * 0.22) };

  return (
    <View style={styles.row}>
      {shown.map((user, i) => (
        <View key={user?.user_id ?? i} style={[overlap, ring]}>
          <Avatar user={user} size={size} />
        </View>
      ))}
      {rest > 0 && (
        <View
          style={[
            overlap,
            ring,
            styles.more,
            { width: size, height: size, backgroundColor: colors.segment },
            // The ring adds to the box, so the circle grows to match a ringed face.
            ringColor ? { width: size + 4, height: size + 4 } : null,
          ]}
        >
          <Text style={[styles.moreText, { color: colors.fg, fontSize: Math.round(size * 0.36) }]}>
            +{rest}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center' },
  more:     { borderRadius: PILL_RADIUS, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontWeight: '800' },
});
