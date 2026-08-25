import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Avatar from '../ui/Avatar';
import SummaryModal, { type SummaryOrigin } from '../ui/SummaryModal';
import { useGetLikeUsersQuery, useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

function LikerRow({ userId, onPress }: { userId: string; onPress: (userId: string) => void }) {
  const colors = useColors();
  const { data: user } = useGetUserByIdQuery(userId, { skip: !userId });
  if (!user) return null;

  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={() => onPress(userId)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`View @${user.username}`}
    >
      <Avatar filename={user.gallery?.[0]?.filename} name={user.username ?? '?'} size={40} />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: colors.fg }]} numberOfLines={1}>@{user.username}</Text>
        {[user.firstName, user.lastName].filter(Boolean).length > 0 && (
          <Text style={[styles.fullName, { color: colors.grey }]} numberOfLines={1}>
            {[user.firstName, user.lastName].filter(Boolean).join(' ')}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

/**
 * Who liked this.
 *
 * Built on SummaryModal, like every other "tell me more about this without
 * leaving where I am" panel — it used to be a slide-up sheet of its own, which
 * meant the same question got a different answer depending on whether you
 * asked it from a feed card or from the post.
 *
 * Rows lead to profiles, and they close the panel on the way: a screen pushed
 * from under an open modal ends up behind it.
 */
export default function LikersSheet({
  entryId,
  visible,
  onClose,
  origin,
}: {
  entryId: string;
  visible: boolean;
  onClose: () => void;
  /** The row this grew out of — see SummaryTouchable. */
  origin?: SummaryOrigin | null;
}) {
  const colors = useColors();
  const nav = useNavigation<any>();
  const { data, isLoading } = useGetLikeUsersQuery(entryId, { skip: !visible || !entryId });
  const userIds = data?.users ?? [];

  const openProfile = (userId: string) => {
    onClose();
    requestAnimationFrame(() => nav.navigate('UserDetail', { userId }));
  };

  return (
    <SummaryModal visible={visible} onClose={onClose} origin={origin}>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.fg }]}>
          Liked by{data?.total ? ` · ${data.total}` : ''}
        </Text>

        {isLoading ? (
          <ActivityIndicator size="large" color={colors.primaryAlt} style={styles.loader} />
        ) : userIds.length === 0 ? (
          <Text style={[styles.empty, { color: colors.grey }]}>No likes yet. Be the first!</Text>
        ) : (
          // Mapped, not listed: SummaryModal brings its own scroller, and the
          // like count on a post never runs to the length where virtualising
          // would earn its keep.
          userIds.map((id) => <LikerRow key={id} userId={id} onPress={openProfile} />)
        )}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  body:   { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12 },
  title:  { fontSize: 19, fontWeight: '800', marginBottom: 6 },
  loader: { marginTop: 30 },
  empty:  { fontSize: 14, paddingVertical: 24, textAlign: 'center' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText:  { flex: 1, minWidth: 0 },
  name:     { fontSize: 15, fontWeight: '700' },
  fullName: { fontSize: 12, marginTop: 1 },
});
