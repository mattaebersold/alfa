import React, { useRef } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '../theme/Text';
import SummaryModal, { measureOrigin, type SummaryOrigin } from '../components/SummaryModal';
import Avatar, { type AvatarUser } from '../components/Avatar';
import { useColors } from '../theme/useColors';
import type { PhotoSpot } from '../types/ors';
import { FONT_INTER } from '../theme/fonts'

/** Everyone with a photo on the spot, once each, in the order their first photo appears. */
export function contributorsOf(spot: PhotoSpot): AvatarUser[] {
  const seen = new Set<string>();
  const out: AvatarUser[] = [];
  for (const photo of spot.gallery ?? []) {
    // A photo with no credit is the pinner's own.
    const id = photo.user_id ?? spot.user_id;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const user = photo.user_id && photo.user ? photo.user : spot.user;
    out.push({
      user_id: id,
      username: user?.username,
      gallery: user?.gallery ?? (user?.profile?.[0] ? [{ filename: user.profile[0] }] : undefined),
    });
  }
  return out;
}

/**
 * One person, in the list. The handle alone, and the whole row opens their
 * preview when the host provides one — the same row as alfa's members lists.
 */
function Row({ user, onOpen }: {
  user: AvatarUser;
  onOpen?: (userId: string, origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const ref = useRef<View>(null);
  const open = () => user.user_id && measureOrigin(ref.current, (origin) => onOpen?.(user.user_id!, origin));
  return (
    <TouchableOpacity
      ref={ref}
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={open}
      disabled={!onOpen}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={user.username ? `View @${user.username}` : 'View member'}
    >
      <Avatar user={user} size={40} />
      <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>@{user.username ?? 'member'}</Text>
      {onOpen && (
        <View style={[styles.viewBtn, { backgroundColor: colors.segment }]}>
          <Text style={[styles.viewText, { color: colors.fg }]}>View</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

/**
 * Who added photos to a spot — a list over the spot's summary, the way a
 * group's summary lists its members. A row opens that person's preview over
 * this one when `onOpenUser` is given; `stacked` is where the host renders
 * that preview, so iOS presents it over this panel.
 */
export default function SpotContributorsSheet({ users, visible, origin, onClose, onOpenUser, stacked }: {
  users: AvatarUser[];
  visible: boolean;
  origin?: SummaryOrigin | null;
  onClose: () => void;
  onOpenUser?: (userId: string, origin: SummaryOrigin | null) => void;
  stacked?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <SummaryModal visible={visible} onClose={onClose} origin={origin} stacked={stacked}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.fg }]}>Photos from · {users.length}</Text>
        {users.map((u) => <Row key={u.user_id} user={u} onOpen={onOpenUser} />)}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  body:  { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  title: { fontSize: 19, fontFamily: FONT_INTER.bold, marginBottom: 6 },
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  name:  { flex: 1, fontSize: 14, fontFamily: FONT_INTER.semibold },
  viewBtn:  { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  viewText: { fontSize: 12, fontFamily: FONT_INTER.bold },
});
