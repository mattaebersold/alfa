import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../ui/Avatar';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';

interface CommentRowProps {
  comment: {
    internal_id?: string;
    _id?: string;
    user_id: string;
    body?: string;
    created_at?: string;
  };
}

export default function CommentRow({ comment }: CommentRowProps) {
  const colors = useColors();
  const { data: user } = useGetUserByIdQuery(comment.user_id, { skip: !comment.user_id });

  const displayName = user
    ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username
    : '…';
  const timeAgo = comment.created_at
    ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <Avatar
        filename={user?.gallery?.[0]?.filename}
        name={user?.firstName ?? '?'}
        size={32}
      />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.fg }]}>{displayName}</Text>
          {user?.username && (
            <Text style={[styles.username, { color: colors.grey }]}>@{user.username}</Text>
          )}
        </View>
        <Text style={[styles.text, { color: colors.muted }]}>{comment.body}</Text>
        <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 1,
  },
  body:     { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name:     { fontSize: 13, fontWeight: '700' },
  username: { fontSize: 12 },
  text:     { fontSize: 14, lineHeight: 20 },
  time:     { fontSize: 11, marginTop: 4 },
});
