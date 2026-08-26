import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { MoreVertical, Trash2 } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import ReportButton from '../ui/ReportButton';
import ActionSheet from '../ui/ActionSheet';
import { useGetUserByIdQuery, useDeleteCommentMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { useColors } from '../../hooks/useColors';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';

/**
 * The ground comments sit on, wherever they appear.
 *
 * Exported so the sheet and the post detail can't drift apart: the two used
 * different greys (#161616 and #101010) for the same thing, alongside a third
 * for the composer and a fourth for the header.
 */
export const COMMENT_SURFACE = '#0B0B0B';

export interface CommentData {
  internal_id?: string;
  _id?: string;
  user_id: string;
  body?: string;
  created_at?: string;
  /**
   * The author deleted it, but replies hang off it — so the row stays and the
   * words go. See the server's deleteEntry.
   */
  removed?: boolean;
}

interface CommentRowProps {
  comment: CommentData;
  currentUserId?: string;
  onReply?: (commentId: string, username: string) => void;
  isReply?: boolean;
  /**
   * Where this row sits in its thread. A thread — a comment and its replies —
   * is drawn as one card: the first row caps it, the last closes it, and the
   * rows between share its sides. Left unset, a row is a card on its own.
   */
  isThreadStart?: boolean;
  isThreadEnd?: boolean;
  /**
   * The top-level comment of this row's thread. Replies attach to it rather
   * than to each other, so answering a reply lands in the same thread instead
   * of starting a new level of indentation.
   */
  threadId?: string;
  /**
   * Open a summary of whoever wrote this. Passed up rather than owned here:
   * one panel for a list of comments, not one per row.
   */
  onOpenUser?: (userId: string, origin: SummaryOrigin | null) => void;
  /** Override the row background, e.g. to set comments off from a post body. */
  backgroundColor?: string;
}

export default function CommentRow({
  comment, currentUserId, onReply, isReply,
  isThreadStart = true, isThreadEnd = true, threadId, onOpenUser, backgroundColor,
}: CommentRowProps) {
  const colors = useColors();
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const { data: user } = useGetUserByIdQuery(comment.user_id, { skip: !comment.user_id });

  const [deleteComment, { isLoading: deleting }] = useDeleteCommentMutation();
  const [menuOpen, setMenuOpen] = useState(false);

  const commentId = comment.internal_id ?? comment._id ?? '';
  if (hiddenIds.includes(commentId)) return null;

  const confirmDelete = () => {
    Alert.alert(
      'Delete comment?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteComment(commentId).unwrap();
            } catch {
              Alert.alert("Couldn't delete", 'Please try again.');
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const displayName = user?.username || '…';
  const timeAgo = comment.created_at
    ? formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })
    : '';

  const isOwn = currentUserId && currentUserId === comment.user_id;

  // Kept only so its replies still have something to hang off, so it carries
  // none of a comment's furniture — no avatar, no name, nothing to press.
  if (comment.removed) {
    return (
      <View style={[
        styles.container,
        styles.removed,
        { backgroundColor: backgroundColor ?? colors.card, borderColor: colors.borderDark },
        isThreadStart && styles.threadStart,
        isThreadEnd && styles.threadEnd,
        isReply && styles.replyContainer,
      ]}>
        {isReply && <View style={[styles.replyLine, { backgroundColor: colors.borderDark }]} />}
        <Text style={[styles.removedText, { color: colors.greyDark }]}>Comment removed</Text>
      </View>
    );
  }

  return (
    <View style={[
      styles.container,
      { backgroundColor: backgroundColor ?? colors.card, borderColor: colors.borderDark },
      isThreadStart && styles.threadStart,
      isThreadEnd && styles.threadEnd,
      isReply && styles.replyContainer,
    ]}>
      {/* A hairline in the border colour, not the brand one: it marks the
          indent, it isn't a thing to look at. */}
      {isReply && <View style={[styles.replyLine, { backgroundColor: colors.borderDark }]} />}
      {/* Initials come from the username, not the first name: the label under
          it says "@username", and two people whose first names start with the
          same letter produced identical circles — which reads as one person's
          photo repeated rather than as two people. */}
      <SummaryTouchable
        onPress={(origin) => onOpenUser?.(comment.user_id, origin)}
        disabled={!onOpenUser || !comment.user_id}
        accessibilityLabel={`View @${displayName}`}
      >
        <Avatar
          user={user}
          size={isReply ? 28 : 32}
        />
      </SummaryTouchable>
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <SummaryTouchable
            onPress={(origin) => onOpenUser?.(comment.user_id, origin)}
            disabled={!onOpenUser || !comment.user_id}
            accessibilityLabel={`View @${displayName}`}
          >
            <Text style={[styles.name, { color: colors.fg }]}>@{displayName}</Text>
          </SummaryTouchable>
        </View>
        {/* Full white: a comment is something someone said, not a caption
            about it, and at `muted` it sat quieter than the timestamps. */}
        <MentionText text={comment.body ?? ''} style={[styles.text, { color: colors.fg }]} />
        <View style={styles.footer}>
          <Text style={[styles.time, { color: colors.greyDark }]}>{timeAgo}</Text>
          {/* Replies can be replied to as well — the answer joins this thread
              rather than opening one under it. */}
          {onReply && commentId && (
            <TouchableOpacity
              onPress={() => onReply(threadId ?? commentId, user?.username ?? displayName ?? '')}
              hitSlop={8}
            >
              <Text style={[styles.replyBtn, { color: colors.primaryAlt }]}>Reply</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Yours to delete, anyone else's to report — one dim ⋮ either way. */}
      {commentId && (isOwn ? (
        <>
          <TouchableOpacity
            onPress={() => setMenuOpen(true)}
            hitSlop={8}
            style={styles.menuBtn}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Comment options"
          >
            <MoreVertical size={16} color="rgba(255,255,255,0.34)" />
          </TouchableOpacity>
          <ActionSheet
            visible={menuOpen}
            onClose={() => setMenuOpen(false)}
            title="Your comment"
            options={[
              { label: 'Delete Comment', Icon: Trash2, destructive: true, onPress: confirmDelete },
            ]}
          />
        </>
      ) : (
        <ReportButton contentType="comment" contentId={commentId} size={16} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    // Sides on every row; the caps come from the thread flags, so a comment
    // and its replies are enclosed by one outline rather than stacked as
    // separate slabs divided by seams.
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  threadStart: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: 14, borderTopRightRadius: 14,
    paddingTop: 12,
  },
  threadEnd: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
    paddingBottom: 12,
    // The gap goes between threads, rather than between every row.
    marginBottom: 10,
  },
  // Half the old inset: a reply is a step in, not a column of its own.
  replyContainer: {
    paddingLeft: 30,
    position: 'relative',
  },
  replyLine: {
    position: 'absolute',
    left: 14,
    top: 6,
    bottom: 6,
    width: 1.5,
    borderRadius: 1,
  },
  // The tombstone is a single line, so it centres rather than sitting where an
  // avatar would have put it.
  removed:     { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  removedText: { fontSize: 12.5, fontStyle: 'italic' },
  menuBtn:  { padding: 4 },

  body:     { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  // The comment is the thing being read; the name is a label on it and the
  // time is a footnote. The weights say so.
  name:     { fontSize: 13, fontWeight: '500' },
  text:     { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  footer:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  time:     { fontSize: 11, fontStyle: 'italic' },
  replyBtn: { fontSize: 12, fontWeight: '700' },
});
