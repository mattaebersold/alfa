import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Keyboard,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useCreateCommentMutation } from '../../api/apiService';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import CommentRow from './CommentRow';
import Composer from './Composer';
import { useComposerPhotos } from '../../hooks/useComposerPhotos';
import UserSummaryModal from '../members/UserSummaryModal';
import { type SummaryOrigin } from '../ui/SummaryModal';
import { useColors } from '../../hooks/useColors';
import { contrastText } from '../../hooks/useBrandColor';
import { PILL_RADIUS } from '../../constants/radius';

interface InlineCommentsProps {
  /** internal_id of the thing being commented on. */
  documentId: string;
  /** Backend entry type, e.g. 'garagecar' or 'post'. */
  entryType: string;
  /** Section heading; omit to render none. */
  title?: string;
  /**
   * Fired when the composer opens.
   *
   * This component lives inside a parent ScrollView. The focused composer
   * covers the page while it's open, but when it folds back the parent wants
   * the thread in view under what was just written — and only the parent owns
   * that scroll position.
   */
  onInputFocus?: () => void;
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
  documentId, entryType, title = 'Comments', backgroundColor, onInputFocus,
}: InlineCommentsProps) {
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [commentText, setCommentText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const photos = useComposerPhotos();
  // Tapping a commenter summarises them in place, as it does in the sheet.
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);

  const { rows, comments, isFetching } = useCommentThread(entryType, documentId, { skip: !documentId });
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();

  const onAccent = contrastText(c.primaryAlt);
  const bg = backgroundColor ?? c.bg;

  const handleSubmit = async () => {
    const fd = new FormData();
    fd.append('document_id', documentId);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    photos.appendTo(fd);
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setMentionedUserIds([]);
      setReplyingTo(null);
      photos.clear();
      // Inline, so there's no pane to close — just clear the keyboard off the
      // comment you just posted.
      Keyboard.dismiss();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
      // Keeps the composer open with the words still in it.
      return false;
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
            // A thread is one card: without these every reply drew its own
            // outline, so an answer read as a separate comment that happened
            // to mention someone.
            isThreadStart={item.isThreadStart}
            isThreadEnd={item.isThreadEnd}
            threadId={item.threadId}
            onOpenUser={(userId, origin) => setUserSummary({ userId, origin })}
            backgroundColor={bg}
            onReply={(commentId, username) => {
              setReplyingTo({ commentId, username });
              setCommentText(`@${username} `);
            }}
          />
        ))
      )}

      <Composer
        value={commentText}
        onChangeText={(text, ids) => { setCommentText(text); setMentionedUserIds(ids); }}
        placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
        title={replyingTo ? `Reply to @${replyingTo.username}` : 'Comment'}
        photos={photos}
        onSend={handleSubmit}
        sending={submitting}
        mentions
        sendLabel="Post"
        tone={{ surface: bg, field: c.card, border: c.borderDark, text: c.fg, accent: c.primaryAlt, onAccent: onAccent }}
        barStyle={styles.composer}
        onOpenChange={(open) => { if (open) onInputFocus?.(); }}
        // Boxed at a fixed size: in a row whose other child grows, the avatar
        // was picking up the leftover width and drawing as a wide rectangle
        // instead of a circle.
        leading={(
          <View style={styles.avatarBox}>
            <Avatar user={userInfo} size={30} />
          </View>
        )}
        banner={replyingTo ? (
          <View style={[styles.replyBanner, { backgroundColor: c.segment, borderColor: c.borderDark }]}>
            <Text style={[styles.replyBannerText, { color: c.grey }]}>
              Replying to <Text style={{ fontWeight: '700', color: c.fg }}>@{replyingTo.username}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => { setReplyingTo(null); setCommentText(''); }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Stop replying"
            >
              <X size={15} color={c.grey} />
            </TouchableOpacity>
          </View>
        ) : null}
      />

      <UserSummaryModal
        userId={userSummary?.userId ?? null}
        origin={userSummary?.origin}
        onClose={() => setUserSummary(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:       { paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  heading:    { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  countBadge: {
    minWidth: 22, height: 22, borderRadius: PILL_RADIUS, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  countText:  { fontSize: 11, fontWeight: '800' },

  empty:      { fontSize: 13, fontStyle: 'italic', textAlign: 'center', paddingVertical: 20 },

  // Inset and rounded like the comment cards above it — full-bleed, it read as
  // a bar cutting across the thread rather than as a note on the box below.
  replyBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 12, marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  replyBannerText: { fontSize: 12 },

  composer:  { paddingBottom: 6 },
  avatarBox: { width: 30, height: 30, flexGrow: 0, flexShrink: 0 },
});
