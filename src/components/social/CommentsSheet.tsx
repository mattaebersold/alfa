import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Modal, Animated, Pressable,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { useGetCommentsQuery, useCreateCommentMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../ui/Avatar';
import MentionInput from '../ui/MentionInput';
import CommentRow, { type CommentData } from './CommentRow';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { ss } from '../../styles/shared';

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

  const { data: commentsData, isFetching } = useGetCommentsQuery(
    { type: entryType, id: postId, limit: 50 },
    { skip: !visible }
  );
  const comments = commentsData?.entries ?? [];

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();

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
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!rendered) return null;

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', postId);
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
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.48)', opacity: overlayOpacity }]}
          pointerEvents="none"
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: c.cream, transform: [{ translateY: slideY }] }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: c.border }]}>
            <Text style={[styles.headerTitle, { color: c.fg }]}>Comments</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <X size={22} color={c.grey} />
            </TouchableOpacity>
          </View>

          {/* Comments list */}
          {isFetching && comments.length === 0 ? (
            <ActivityIndicator size="large" color={c.primaryAlt} style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={comments}
              keyExtractor={(item: any) => item.internal_id ?? item._id}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }: { item: CommentData }) => (
                <CommentRow
                  comment={item}
                  currentUserId={userInfo?.user_id}
                  isReply={!!item.parent_id}
                  onReply={(commentId, username) => {
                    setReplyingTo({ commentId, username });
                    setCommentText(`@${username} `);
                  }}
                />
              )}
              ListEmptyComponent={
                <Text style={[styles.empty, { color: c.grey }]}>No comments yet. Be first!</Text>
              }
            />
          )}

          {/* Input area */}
          <View style={[styles.inputWrap, { backgroundColor: c.card, borderTopColor: c.border }]}>
            {replyingTo && (
              <View style={[styles.replyBanner, { backgroundColor: c.segment, borderBottomColor: c.border }]}>
                <Text style={[styles.replyText, { color: c.grey }]}>
                  Replying to <Text style={{ fontWeight: '700', color: c.fg }}>@{replyingTo.username}</Text>
                </Text>
                <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                  <X size={14} color={c.grey} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.username ?? '?'} size={32} />
              <MentionInput
                style={[ss.chatInput, { borderColor: c.border, color: c.fg }]}
                value={commentText}
                onChangeText={(text, ids) => { setCommentText(text); setMentionedUserIds(ids); }}
                placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
                placeholderTextColor={c.grey}
                multiline
              />
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={submitting || !commentText.trim()}
                style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendDisabled]}
              >
                <Text style={styles.sendText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet:       { maxHeight: '80%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  list:        { paddingTop: 4, paddingBottom: 16 },
  empty:       { textAlign: 'center', padding: 32, fontSize: 14 },
  inputWrap:   { borderTopWidth: 1 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1 },
  replyText:   { fontSize: 13 },
  inputRow:    { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  sendBtn:     { backgroundColor: colors.primaryAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendDisabled:{ opacity: 0.4 },
  sendText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
