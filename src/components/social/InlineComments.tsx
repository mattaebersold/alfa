import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useCreateCommentMutation } from '../../api/apiService';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import MentionInput from '../ui/MentionInput';
import Avatar from '../ui/Avatar';
import CommentRow from './CommentRow';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';

interface InlineCommentsProps {
  /** internal_id of the thing being commented on. */
  documentId: string;
  /** Backend entry type, e.g. 'garagecar' or 'post'. */
  entryType: string;
  /** Section heading; omit to render none. */
  title?: string;
  /** Background for the section, so it can be set off from the page. */
  backgroundColor?: string;
}

/**
 * Comment thread rendered inline in a page rather than in a bottom sheet.
 *
 * Uses the same data hook as CommentsSheet, but plain Views instead of a
 * FlatList — this always sits inside a parent ScrollView, and nesting a
 * same-direction VirtualizedList inside one breaks scrolling and warns.
 */
export default function InlineComments({
  documentId, entryType, title = 'Comments', backgroundColor,
}: InlineCommentsProps) {
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [commentText, setCommentText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);

  const { rows, comments, isFetching } = useCommentThread(entryType, documentId, { skip: !documentId });
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();

  const onAccent = contrastText(c.primaryAlt);
  const bg = backgroundColor ?? c.bg;

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', documentId);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setMentionedUserIds([]);
      setReplyingTo(null);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderTopColor: c.border }]}>
      {title ? (
        <View style={styles.headingRow}>
          <Text style={[styles.heading, { color: c.grey }]}>{title.toUpperCase()}</Text>
          {comments.length > 0 && (
            <View style={[styles.countBadge, { backgroundColor: c.segment }]}>
              <Text style={[styles.countText, { color: c.fg }]}>{comments.length}</Text>
            </View>
          )}
        </View>
      ) : null}

      {isFetching && comments.length === 0 ? (
        <ActivityIndicator color={c.primaryAlt} style={{ marginVertical: 24 }} />
      ) : rows.length === 0 ? (
        <Text style={[styles.empty, { color: c.greyDark }]}>No comments yet. Be first!</Text>
      ) : (
        rows.map((item: any) => (
          <CommentRow
            key={item.comment.internal_id ?? item.comment._id}
            comment={item.comment}
            currentUserId={userInfo?.user_id}
            isReply={item.isReply}
            backgroundColor={bg}
            onReply={(commentId, username) => {
              setReplyingTo({ commentId, username });
              setCommentText(`@${username} `);
            }}
          />
        ))
      )}

      {replyingTo && (
        <View style={[styles.replyBanner, { backgroundColor: c.segment }]}>
          <Text style={[styles.replyBannerText, { color: c.grey }]}>
            Replying to <Text style={{ fontWeight: '700', color: c.fg }}>@{replyingTo.username}</Text>
          </Text>
          <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
            <X size={15} color={c.grey} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.username ?? '?'} size={30} />
        <View style={styles.inputFlex}>
          <MentionInput
            value={commentText}
            onChangeText={(text, ids) => { setCommentText(text); setMentionedUserIds(ids); }}
            placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
            multiline
          />
        </View>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting || !commentText.trim()}
          style={[
            styles.sendBtn,
            { backgroundColor: c.primaryAlt },
            (!commentText.trim() || submitting) && styles.sendBtnDisabled,
          ]}
          activeOpacity={0.85}
        >
          <Text style={[styles.sendText, { color: onAccent }]}>Post</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  heading:    { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:  { fontSize: 11, fontWeight: '800' },

  empty:      { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 8, marginTop: 8,
  },
  replyBannerText: { fontSize: 12 },

  inputRow:  {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16,
  },
  inputFlex: { flex: 1 },
  sendBtn:   { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:  { fontWeight: '700', fontSize: 13 },
});
