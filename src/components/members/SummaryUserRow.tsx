import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Avatar, { type AvatarUser } from '../ui/Avatar';
import { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * One person, in a list that lives inside a summary panel — a group's members,
 * a post's likers.
 *
 * The handle alone, never a real name: in a list of people you mostly don't
 * know, a first and last name under each handle was a second name for the same
 * person, and it's the handle that's used everywhere else in the app.
 *
 * The whole row and its View button do the same thing — open that person's
 * summary over this one (see useStackedUserSummary). The button is there
 * because a bare row inside a panel doesn't look like it goes anywhere.
 */
export default function SummaryUserRow({
  userId,
  user,
  onOpen,
  avatarSize = 34,
  badge,
  style,
}: {
  userId: string;
  user?: AvatarUser;
  onOpen: (userId: string, origin: SummaryOrigin | null) => void;
  avatarSize?: number;
  /** Beside the handle — the Admin pill, say. */
  badge?: React.ReactNode;
  /** Borders and spacing, which differ with the list the row is in. */
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const rowRef = useRef<View>(null);
  const username = user?.username;

  // Measured off the row, whichever was tapped, so the stacked panel grows out
  // of the person rather than out of a small button at the row's edge.
  const open = () => measureOrigin(rowRef.current, (origin) => onOpen(userId, origin));

  return (
    <TouchableOpacity
      ref={rowRef}
      style={[styles.row, style]}
      onPress={open}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={username ? `View @${username}` : 'View member'}
    >
      <Avatar user={user} size={avatarSize} />
      <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>
        @{username ?? 'member'}
      </Text>
      {badge}
      <TouchableOpacity
        style={styles.viewBtn}
        onPress={open}
        activeOpacity={0.85}
        hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        // The row already announces itself; a second button saying the same
        // thing would be read out twice for every person in the list.
        accessible={false}
        importantForAccessibility="no"
      >
        <Text style={styles.viewText}>View</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  name: { flex: 1, fontSize: 14, fontWeight: '600' },
  // The same grey as the summaries' other secondary buttons (Message, Follow):
  // it's something you can do to this row, not the panel's main action.
  viewBtn: {
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: COMMON_RADIUS,
    backgroundColor: '#2A2A2A',
  },
  viewText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
});
