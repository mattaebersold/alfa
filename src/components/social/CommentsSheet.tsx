import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, Animated, Pressable, Alert, ActivityIndicator,
  Keyboard,
} from 'react-native';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Dimensions } from 'react-native';
import { useCreateCommentMutation } from '../../api/apiService';
import { useCommentThread, type CommentRowItem } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import CommentRow, { COMMENT_SURFACE } from './CommentRow';
import Composer from './Composer';
import { useComposerPhotos } from '../../hooks/useComposerPhotos';
import { useColors } from '../../hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardInset, useComposerBottomPad } from '../../hooks/useKeyboardHeight';
import { colors } from '../../constants/colors';
import UserSummaryModal from '../members/UserSummaryModal';
import { type SummaryOrigin } from '../ui/SummaryModal';

/**
 * One ground for the whole sheet — header, list and composer alike.
 *
 * It used to be three: a black header, a #161616 body and a #0B0B0B composer,
 * which read as three panels stacked rather than as one surface with comments
 * on it. The comment cards supply the only other tone.
 */
const SHEET_BG = COMMENT_SURFACE;

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface CommentsSheetProps {
  postId: string;
  entryType: string;
  visible: boolean;
  onClose: () => void;
}

export default function CommentsSheet({ postId, entryType, visible, onClose }: CommentsSheetProps) {
  const c = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const [commentText, setCommentText] = useState('');
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const photos = useComposerPhotos();
  // Whose summary is open, and the row it grew out of.
  const [userSummary, setUserSummary] = useState<{ userId: string; origin: SummaryOrigin | null } | null>(null);

  const { rows, comments, isFetching } = useCommentThread(entryType, postId, { skip: !visible });

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();

  // Lifts the whole sheet clear of the keyboard — see the note at the shell.
  const { height: keyboardHeight } = useKeyboardInset();
  const bottomPad = useComposerBottomPad();
  const insets = useSafeAreaInsets();

  /**
   * The sheet is *resized* by the keyboard, not pushed by it.
   *
   * It used to sit in a container padded by the keyboard's height, which moves
   * the whole sheet — header, list and composer together — up the screen as one
   * block. With a sheet 88% of the screen tall and a keyboard taking 40% of it,
   * there is nowhere for that block to go: it ends up jammed against the top
   * with its composer stranded in the middle of the screen, which is exactly
   * what the keyboard was covering up.
   *
   * Resizing instead keeps the bottom edge on top of the keyboard and lets the
   * comment list absorb the loss, which is what a list is for. The composer
   * never moves relative to the keyboard, and nothing needs to slide.
   */
  const sheetHeight = Math.min(
    SCREEN_HEIGHT * 0.88,
    // Never taller than what's left above the keyboard, and never under the
    // status bar.
    SCREEN_HEIGHT - keyboardHeight - insets.top - 8,
  );

  const slideY = useRef(new Animated.Value(600)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const mountedRef = useRef(false);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      mountedRef.current = true;
      setRendered(true);
      slideY.setValue(600);
      overlayOpacity.setValue(0);
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else if (mountedRef.current) {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }),
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => {
        mountedRef.current = false;
        setRendered(false);
        setCommentText('');
        setMentionedUserIds([]);
        setReplyingTo(null);
        photos.clear();
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;

  const handleSubmit = async () => {
    const fd = new FormData();
    fd.append('document_id', postId);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    photos.appendTo(fd);
    // A reply is a comment whose reply_to is the parent's internal_id. The backend
    // returns these separately (getReplies) and we nest them under the parent.
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    if (mentionedUserIds.length > 0) fd.append('mentioned_users', mentionedUserIds.join(','));
    try {
      await createComment(fd).unwrap();
      // Posting is the end of the visit: keyboard and sheet go together. The
      // composer state is cleared by the close animation above.
      Keyboard.dismiss();
      onClose();
    } catch {
      Alert.alert('Error', 'Could not post comment.');
      // Keeps the composer open with the words still in it.
      return false;
    }
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* The sheet sits on the bottom of the screen, which is exactly what the
          keyboard covers, so padding the stack by the keyboard's height puts
          the composer directly on top of it. KeyboardAvoidingView did this on
          iOS only — Android got `behavior="height"`, which has no window resize
          to act on in an edge-to-edge app, so the keyboard simply covered the
          field you were typing in. See useKeyboardInset. */}
      <Animated.View style={styles.stack}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
          pointerEvents="none"
        >
          <BlurView tint="dark" intensity={28} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: SHEET_BG,
              height: sheetHeight,
              // Sits the sheet directly on top of the keyboard.
              marginBottom: keyboardHeight,
              transform: [{ translateY: slideY }],
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { backgroundColor: SHEET_BG }]}>
            <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {isFetching && comments.length === 0 ? (
            <ActivityIndicator size="large" color={c.primaryAlt} style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(item: any) => item.comment.internal_id ?? item.comment._id}
              style={{ flex: 1 }}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: CommentRowItem }) => (
                <CommentRow
                  comment={item.comment}
                  currentUserId={userInfo?.user_id}
                  isReply={item.isReply}
                  isThreadStart={item.isThreadStart}
                  isThreadEnd={item.isThreadEnd}
                  threadId={item.threadId}
                  onOpenUser={(userId, origin) => setUserSummary({ userId, origin })}
                  onReply={(commentId, username) => {
                    setReplyingTo({ commentId, username });
                    setCommentText(`@${username} `);
                  }}
                  // Opening the sheet to delete one comment and being left
                  // staring at the thread with a gap in it is a second step
                  // you'd take anyway. The post underneath keeps its count in
                  // step through the mutation's invalidation, so there's
                  // nothing behind here that needs the sheet to stay up.
                  onDeleted={onClose}
                />
              )}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: c.grey }]}>No comments yet. Be first!</Text>
              }
            />
          )}

          {/* Composer. Collapsed it's this bar; tapped, it opens over the
              sheet on the keyboard — see Composer. */}
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
            tone={{ surface: SHEET_BG, field: SHEET_BG, border: '#2A2A2A', text: '#ECECEC', accent: colors.primaryAlt }}
            barStyle={{ paddingHorizontal: 4, paddingTop: 4, paddingBottom: bottomPad }}
            banner={replyingTo ? (
              <View style={[styles.replyBanner, { backgroundColor: '#1E1E1E', borderBottomColor: '#000000' }]}>
                <Text style={[styles.replyText, { color: 'rgba(255,255,255,0.7)' }]}>
                  Replying to <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>@{replyingTo.username}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => { setReplyingTo(null); setCommentText(''); }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Stop replying"
                >
                  <X size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            ) : null}
          />

          {/* Inside the sheet's own tree, so it presents over it rather than
              needing the sheet closed first. */}
          <UserSummaryModal
            userId={userSummary?.userId ?? null}
            origin={userSummary?.origin}
            onClose={() => setUserSummary(null)}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Comments are a place you settle into, not a peek — it opens near
  // full-height rather than growing into it as the thread gets long.
  stack:       { flex: 1, justifyContent: 'flex-end' },
  sheet:       { borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  // No rules against the list: header, comments and composer are one surface,
  // and a line across it made them read as separate panels again.
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  list:        { paddingTop: 4, paddingBottom: 16 },
  empty:       { textAlign: 'center', padding: 32, fontSize: 14 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1 },
  replyText:   { fontSize: 13 },
});
