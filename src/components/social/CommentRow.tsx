import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import ReportButton from '../ui/ReportButton';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';

export interface CommentData {
  internal_id?: string;
  _id?: string;
  user_id: string;
  body?: string;
  created_at?: string;
}

interface CommentRowProps {
  comment: CommentData;
  currentUserId?: string;
  onReply?: (commentId: string, username: string) => void;
  isReply?: boolean;
}

export default function CommentRow({ comment, currentUserId, onReply, isReply }: CommentRowProps) {
  const colors = useColors();
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const { data: user } = useGetUserByIdQuery(comment.user_id, { skip: !comment.user_id });

  const commentId = comment.internal_id ?? comment._id ?? '';
  if (hiddenIds.includes(commentId)) return null;

  const displayName = user?.username || '…';
  const timeAgo = comment.created_at
    ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
    : '';

  const isOwn = currentUserId && currentUserId === comment.user_id;

  return (
    <View style={[
      styles.container,
      { backgroundColor: colors.card },
      isReply && styles.replyContainer,
    ]}>
      {isReply && <View style={[styles.replyLine, { backgroundColor: colors.primaryAlt }]} />}
      <Avatar
        filename={user?.gallery?.[0]?.filename}
        name={user?.firstName ?? '?'}
        size={isReply ? 28 : 32}
      />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.fg }]}>@{displayName}</Text>
        </View>
        <MentionText text={comment.body ?? ''} style={[styles.text, { color: colors.muted }]} />
        <View style={styles.footer}>
          <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
          {onReply && commentId && !isReply && (
            <TouchableOpacity
              onPress={() => onReply(commentId, user?.username ?? displayName ?? '')}
              hitSlop={8}
            >
              <Text style={[styles.replyBtn, { color: colors.primaryAlt }]}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {!isOwn && commentId && (
        <ReportButton contentType="comment" contentId={commentId} size={16} />
      )}
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
  replyContainer: {
    paddingLeft: 44,
    marginLeft: 16,
    position: 'relative',
  },
  replyLine: {
    position: 'absolute',
    left: 16,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 2,
  },
  body:     { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  name:     { fontSize: 13, fontWeight: '700' },
  text:     { fontSize: 14, lineHeight: 20 },
  footer:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  time:     { fontSize: 11 },
  replyBtn: { fontSize: 12, fontWeight: '700' },
});
