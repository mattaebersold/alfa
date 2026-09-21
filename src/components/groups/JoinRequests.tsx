import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { formatDistanceToNow } from 'date-fns';
import { MapPin } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import SummaryModal, { measureOrigin, type SummaryOrigin } from '../ui/SummaryModal';
import { useStackedUserSummary } from '../members/useStackedUserSummary';
import { useApproveGroupMemberMutation, useRejectGroupMemberMutation } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { useBrandColor } from '../../hooks/useBrandColor';
import type { GroupMember } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/**
 * One person asking to join, with the two answers beside them.
 *
 * The row opens their profile summary, and that is the point of it: a group
 * like PNW Cars or Transaxle has a bar to clear — where you are, what you
 * drive — and an admin can't judge that from a username. The summary shows
 * their location and their cars, stacked over whatever this list is in, so
 * checking someone costs a tap and comes straight back to the decision.
 *
 * Approve and Deny stay on the row rather than moving into the summary: the
 * summary is for looking, and an admin working through five requests wants to
 * answer from the list once they've looked.
 */
function JoinRequestRow({ groupId, member, onOpenUser }: {
  groupId: string;
  member: GroupMember;
  onOpenUser: (userId: string, origin: SummaryOrigin | null) => void;
}) {
  const colors = useColors();
  const brand = useBrandColor();
  const rowRef = useRef<View>(null);
  const [approve] = useApproveGroupMemberMutation();
  const [reject] = useRejectGroupMemberMutation();
  // Which answer is mid-flight — the row holds its shape while it lands.
  const [busy, setBusy] = useState<'approve' | 'deny' | null>(null);

  const answer = async (kind: 'approve' | 'deny') => {
    if (busy) return;
    setBusy(kind);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await (kind === 'approve' ? approve : reject)({ groupId, userId: member.user_id }).unwrap();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // No local "done" state: the members query refetches and the row leaves.
    } catch (err: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        kind === 'approve' ? "Couldn't approve that" : "Couldn't deny that",
        err?.data?.error ?? 'Please try again.',
      );
      setBusy(null);
    }
  };

  const username = member.user?.username;
  const place = (member.user as any)?.cityState as string | undefined;
  const asked = member.created_at
    ? formatDistanceToNow(new Date(member.created_at), { addSuffix: true })
    : '';

  return (
    <View ref={rowRef} style={[styles.row, { borderTopColor: colors.borderDark }]}>
      <TouchableOpacity
        style={styles.who}
        onPress={() => measureOrigin(rowRef.current, (origin) => onOpenUser(member.user_id, origin))}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={username ? `View @${username}'s profile` : 'View profile'}
      >
        <Avatar user={member.user} size={40} />
        <View style={styles.whoText}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>@{username ?? 'member'}</Text>
          {/* Where they are is half the question for a regional group, so it's
              on the row and doesn't need the tap. */}
          {place ? (
            <View style={styles.placeRow}>
              <MapPin size={11} color={colors.grey} />
              <Text style={[styles.place, { color: colors.grey }]} numberOfLines={1}>{place}</Text>
            </View>
          ) : null}
          <Text style={[styles.viewHint, { color: brand }]}>
            View profile{asked ? ` · asked ${asked}` : ''}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={styles.answers}>
        <TouchableOpacity
          style={[styles.approveBtn, { backgroundColor: brand }, busy && styles.btnOff]}
          onPress={() => answer('approve')}
          disabled={!!busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Approve @${username ?? 'member'}`}
        >
          {busy === 'approve'
            ? <ActivityIndicator size="small" color="#000000" />
            : <Text style={styles.approveText}>Approve</Text>}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.denyBtn, { borderColor: colors.borderDark }, busy && styles.btnOff]}
          onPress={() => answer('deny')}
          disabled={!!busy}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Deny @${username ?? 'member'}`}
        >
          {busy === 'deny'
            ? <ActivityIndicator size="small" color={colors.fg} />
            : <Text style={[styles.denyText, { color: colors.fg }]}>Deny</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * The pending requests, as rows. For a host that already has a surface to put
 * them on and its own way of showing a profile over it — the settings sheet.
 */
export function JoinRequestsList({ groupId, pending, onOpenUser }: {
  groupId: string;
  pending: GroupMember[];
  onOpenUser: (userId: string, origin: SummaryOrigin | null) => void;
}) {
  return (
    <View>
      {pending.map((m) => (
        <JoinRequestRow key={m.user_id} groupId={groupId} member={m} onOpenUser={onOpenUser} />
      ))}
    </View>
  );
}

/**
 * The admin's join-request panel: everyone waiting, answerable in place.
 *
 * Built on SummaryModal so a requester's profile stacks over it (see
 * useStackedUserSummary) and closing that lands back here, on the same
 * request, with Approve and Deny still under your thumb.
 */
export default function JoinRequestsPanel({ groupId, pending, visible, origin, onClose }: {
  groupId: string;
  pending: GroupMember[];
  visible: boolean;
  origin?: SummaryOrigin | null;
  onClose: () => void;
}) {
  const colors = useColors();
  const { openUser, stacked } = useStackedUserSummary(visible);

  return (
    <SummaryModal visible={visible} onClose={onClose} origin={origin} stacked={stacked}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>
          {pending.length === 0
            ? 'Join requests'
            : `${pending.length} join request${pending.length === 1 ? '' : 's'}`}
        </Text>
        <Text style={[styles.sub, { color: colors.grey }]}>
          Tap someone to see their profile — where they are and what they drive.
        </Text>
      </View>

      {pending.length === 0 ? (
        // The last answer empties the list while the panel is still open.
        <Text style={[styles.empty, { color: colors.grey }]}>All caught up — nobody is waiting.</Text>
      ) : (
        <JoinRequestsList groupId={groupId} pending={pending} onOpenUser={openUser} />
      )}
      <View style={styles.foot} />
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  head:  { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, gap: 4 },
  title: { fontSize: 19, fontWeight: '800' },
  sub:   { fontSize: 12.5, lineHeight: 17 },
  empty: { fontSize: 13, paddingHorizontal: 16, paddingVertical: 18 },
  foot:  { height: 10 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  who:     { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  whoText: { flex: 1, minWidth: 0, gap: 1 },
  name:    { fontSize: 15, fontWeight: '700' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  place:   { fontSize: 12, flexShrink: 1 },
  viewHint: { fontSize: 11.5, fontWeight: '600', marginTop: 1 },

  answers: { flexDirection: 'row', gap: 6 },
  approveBtn: {
    minWidth: 74, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: COMMON_RADIUS, alignItems: 'center', justifyContent: 'center',
  },
  approveText: { fontSize: 13, fontWeight: '800', color: '#000000' },
  denyBtn: {
    minWidth: 58, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: COMMON_RADIUS, borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  denyText: { fontSize: 13, fontWeight: '700' },
  btnOff:  { opacity: 0.55 },
});
