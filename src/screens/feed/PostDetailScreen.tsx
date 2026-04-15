import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { formatDistanceToNow } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useGetPostQuery, useGetCommentsQuery, useCreateCommentMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import Spinner from '../../components/ui/Spinner';
import { firstGalleryUrl, imageUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { FeedScreenProps } from '../../navigation/types';

export default function PostDetailScreen({ route }: FeedScreenProps<'PostDetail'>) {
  const { postId } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);
  const colors = useColors();

  const { data: post, isLoading } = useGetPostQuery(postId);
  const { data: comments = [] } = useGetCommentsQuery(
    { type: post?.entry_type ?? 'post', id: postId, limit: 50 },
    { skip: !post }
  );

  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');

  if (isLoading || !post) return <Spinner fullScreen />;

  const heroImage = firstGalleryUrl(post.gallery);
  const displayName = post.user
    ? `${post.user.firstName} ${post.user.lastName}`.trim() || post.user.username
    : 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';

  const handleSubmitComment = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', post.internal_id);
    fd.append('document_entry_type', entryType);
    fd.append('body', commentText.trim());
    try {
      await createComment(fd).unwrap();
      setCommentText('');
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <FlatList
          data={comments}
          keyExtractor={(item: any) => item.internal_id ?? item._id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* Post content */}
              <View style={[styles.postHeader, { backgroundColor: colors.card }]}>
                <Avatar
                  filename={post.user?.gallery?.[0]?.filename ?? post.user?.profilePicture}
                  name={displayName}
                  size={40}
                />
                <View style={styles.postHeaderText}>
                  <Text style={[styles.author, { color: colors.fg }]}>{displayName}</Text>
                  {post.user?.username && (
                    <Text style={[styles.username, { color: colors.grey }]}>@{post.user.username}</Text>
                  )}
                </View>
                <Badge variant={entryType} />
              </View>

              {post.title && <Text style={[styles.postTitle, { color: colors.fg, backgroundColor: colors.card }]}>{post.title}</Text>}
              {post.body && (
                <Text style={[styles.postBody, { color: colors.muted, backgroundColor: colors.card }]}>{post.body.replace(/<[^>]*>/g, '')}</Text>
              )}

              {heroImage && (
                <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
              )}

              {post.price && (
                <Text style={[styles.price, { backgroundColor: colors.card }]}>${Number(post.price).toLocaleString()}</Text>
              )}

              <View style={[styles.likeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <LikeButton
                  documentId={post.internal_id}
                  entryType={entryType}
                  initialCount={post.likeCount ?? 0}
                  initialLiked={post.isLiked ?? false}
                />
              </View>

              <View style={styles.commentsDivider}>
                <Text style={[styles.commentsLabel, { color: colors.grey }]}>
                  Comments {comments.length > 0 ? `(${comments.length})` : ''}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <View style={[styles.comment, { backgroundColor: colors.card }]}>
              <Avatar
                filename={item.user?.gallery?.[0]?.filename}
                name={item.user?.firstName ?? '?'}
                size={32}
              />
              <View style={styles.commentBody}>
                <Text style={[styles.commentAuthor, { color: colors.fg }]}>
                  {item.user?.firstName} {item.user?.lastName}
                </Text>
                <Text style={[styles.commentText, { color: colors.muted }]}>{item.body}</Text>
                <Text style={[styles.commentTime, { color: colors.grey }]}>
                  {item.created_at
                    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                    : ''}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.grey }]}>No comments yet. Be first!</Text>
          }
          contentContainerStyle={styles.list}
        />

        {/* Comment input */}
        <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Avatar filename={userInfo?.gallery?.[0]?.filename} name={userInfo?.firstName ?? '?'} size={32} />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.fg }]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={colors.grey}
            multiline
          />
          <TouchableOpacity
            onPress={handleSubmitComment}
            disabled={submitting || !commentText.trim()}
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
          >
            <Text style={styles.sendText}>Post</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  list: { paddingBottom: 16 },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  postHeaderText: { flex: 1 },
  author: { fontSize: 15, fontWeight: '700' },
  username: { fontSize: 12 },
  postTitle: {
    fontSize: 18, fontWeight: '800',
    paddingHorizontal: 16, paddingTop: 12,
  },
  postBody: {
    fontSize: 15, lineHeight: 22,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  heroImage: { width: '100%', height: 280 },
  price: {
    fontSize: 22, fontWeight: '800', color: Colors.brg,
    paddingHorizontal: 16, paddingTop: 12,
  },
  likeRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  commentsDivider: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  commentsLabel: {
    fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  comment: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    marginBottom: 1,
  },
  commentBody: { flex: 1 },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentText: { fontSize: 14, marginTop: 2, lineHeight: 20 },
  commentTime: { fontSize: 11, marginTop: 4 },
  noComments: {
    textAlign: 'center', padding: 24,
    fontSize: 14,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    backgroundColor: Colors.brg,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
