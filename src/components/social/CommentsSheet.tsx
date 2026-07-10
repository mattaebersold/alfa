import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, Modal, Animated, Pressable,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { X } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { Dimensions } from 'react-native';
import { useCreateCommentMutation } from '../../api/apiService';
import { useCommentThread } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import MentionInput from '../ui/MentionInput';
import CommentRow, { type CommentData } from './CommentRow';
import { useColors } from '../../hooks/useColors';
import { colors } from '../../constants/colors';
import { ss } from '../../styles/shared';

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
  const [inputFocused, setInputFocused] = useState(false);

  const { rows, comments, isFetching } = useCommentThread(entryType, postId, { skip: !visible });

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
    // A reply is a comment whose reply_to is the parent's internal_id. The backend
    // returns these separately (getReplies) and we nest them under the parent.
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
          style={[StyleSheet.absoluteFill, { opacity: overlayOpacity }]}
          pointerEvents="none"
        >
          <BlurView tint="dark" intensity={28} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        </Animated.View>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View style={[styles.sheet, { backgroundColor: '#161616', transform: [{ translateY: slideY }] }]}>
          {/* Header */}
          <View style={[styles.header, { backgroundColor: '#000000', borderBottomColor: '#000000' }]}>
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
              renderItem={({ item }: { item: { comment: CommentData; isReply: boolean } }) => (
                <CommentRow
                  comment={item.comment}
                  currentUserId={userInfo?.user_id}
                  isReply={item.isReply}
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
          <View style={[styles.inputWrap, { backgroundColor: '#0B0B0B', borderTopColor: '#000000' }]}>
            {replyingTo && (
              <View style={[styles.replyBanner, { backgroundColor: '#1E1E1E', borderBottomColor: '#000000' }]}>
                <Text style={[styles.replyText, { color: 'rgba(255,255,255,0.7)' }]}>
                  Replying to <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>@{replyingTo.username}</Text>
                </Text>
                <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                  <X size={14} color="rgba(255,255,255,0.7)" />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <MentionInput
                containerStyle={styles.inputContainer}
                style={[ss.chatInput, styles.input, inputFocused && styles.inputFocused, { borderColor: '#2A2A2A', color: '#ECECEC' }]}
                value={commentText}
                onChangeText={(text, ids) => { setCommentText(text); setMentionedUserIds(ids); }}
                placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
                placeholderTextColor={c.grey}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
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
  sheet:       { minHeight: SCREEN_HEIGHT * 0.5, maxHeight: '85%', borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  list:        { paddingTop: 4, paddingBottom: 16 },
  empty:       { textAlign: 'center', padding: 32, fontSize: 14 },
  inputWrap:   { borderTopWidth: 1 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1 },
  replyText:   { fontSize: 13 },
  inputRow:      { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  inputContainer:{ flex: 1 },
  input:         { width: '100%', maxHeight: 120 },
  // On focus, open up to ~3 lines so there's room to write.
  inputFocused:  { minHeight: 76 },
  sendBtn:     { backgroundColor: colors.primaryAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendDisabled:{ opacity: 0.4 },
  sendText:    { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
