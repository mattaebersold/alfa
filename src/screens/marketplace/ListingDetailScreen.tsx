import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGetPostQuery,
  useGetCommentsQuery,
  useCreateCommentMutation,
  useGetPostCountsQuery,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import CommentRow from '../../components/social/CommentRow';
import LikersSheet from '../../components/social/LikersSheet';
import Spinner from '../../components/ui/Spinner';
import { firstGalleryUrl } from '../../utils/image';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { MarketScreenProps } from '../../navigation/types';
import { stripHtml } from '../../utils/text';

export default function ListingDetailScreen({ route }: MarketScreenProps<'ListingDetail'>) {
  const { postId } = route.params;
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);

  const { data: postData, isLoading } = useGetPostQuery(postId);
  const post = postData ? { ...postData.entry, user: postData.entry.user ?? postData.user } : undefined;
  const { data: commentsData } = useGetCommentsQuery(
    { type: post?.entry_type ?? 'post', id: postId, limit: 50 },
    { skip: !post }
  );
  const comments = commentsData?.entries ?? [];
  const { data: counts } = useGetPostCountsQuery(postId, { skip: !post });
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  const [likersOpen, setLikersOpen] = useState(false);

  if (isLoading || !post) return <Spinner fullScreen />;

  const heroImage = firstGalleryUrl(post.gallery);
  const displayName = post.user
    ? `${post.user.firstName} ${post.user.lastName}`.trim() || post.user.username
    : 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'listing';

  const handleSubmit = async () => {
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
          data={comments as any[]}
          keyExtractor={(item: any) => item.internal_id ?? item._id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
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
                <Text style={[styles.postBody, { color: colors.muted, backgroundColor: colors.card }]}>{stripHtml(post.body)}</Text>
              )}

              {heroImage && (
                <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
              )}

              {post.price && (
                <Text style={[styles.price, { backgroundColor: colors.card }]}>${Number(post.price).toLocaleString()}</Text>
              )}

              {post.sold && (
                <View style={styles.soldBadge}>
                  <Text style={styles.soldText}>SOLD</Text>
                </View>
              )}

              {(post.make || post.model || post.year) && (
                <View style={[styles.specRow, { backgroundColor: colors.card }]}>
                  {post.year && <Text style={[styles.specText, { color: colors.grey, backgroundColor: colors.segment }]}>{post.year}</Text>}
                  {post.make && <Text style={[styles.specText, { color: colors.grey, backgroundColor: colors.segment }]}>{post.make}</Text>}
                  {post.model && <Text style={[styles.specText, { color: colors.grey, backgroundColor: colors.segment }]}>{post.model}</Text>}
                </View>
              )}

              {(counts?.likes ?? 0) > 0 && (
                <TouchableOpacity
                  style={[styles.likedByRow, { backgroundColor: colors.card }]}
                  onPress={() => setLikersOpen(true)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.likedByText, { color: colors.muted }]}>
                    Liked by {counts!.likes} {counts!.likes === 1 ? 'person' : 'people'}
                  </Text>
                </TouchableOpacity>
              )}

              <View style={[styles.likeRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <LikeButton
                  documentId={post.internal_id}
                  entryType={entryType}
                  initialCount={counts?.likes ?? post.like_count ?? 0}
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
            <CommentRow comment={item} />
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.grey }]}>No comments yet.</Text>
          }
          contentContainerStyle={styles.list}
        />

        <View style={[styles.inputRow, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <Avatar
            filename={userInfo?.gallery?.[0]?.filename}
            name={userInfo?.firstName ?? '?'}
            size={32}
          />
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.fg }]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={colors.grey}
            multiline
          />
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting || !commentText.trim()}
            style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
          >
            <Text style={styles.sendText}>Post</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <LikersSheet
        entryId={postId}
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1 },
  flex:            { flex: 1 },
  list:            { paddingBottom: 16 },
  postHeader:      {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12,
  },
  postHeaderText:  { flex: 1 },
  author:          { fontSize: 15, fontWeight: '700' },
  username:        { fontSize: 12 },
  postTitle:       {
    fontSize: 18, fontWeight: '800',
    paddingHorizontal: 16, paddingTop: 12,
  },
  postBody:        {
    fontSize: 15, lineHeight: 22,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  heroImage:       { width: '100%', height: 280 },
  price:           {
    fontSize: 24, fontWeight: '800', color: colors.cyan,
    paddingHorizontal: 16, paddingTop: 12,
  },
  soldBadge:       {
    backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6,
    marginHorizontal: 16, marginTop: 8, borderRadius: 6, alignSelf: 'flex-start',
  },
  soldText:        { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  specRow:         {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
  },
  specText:        {
    fontSize: 13,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: '600',
  },
  likedByRow:      { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4 },
  likedByText:     { fontSize: 13 },
  likeRow:         {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  commentsDivider: { paddingHorizontal: 16, paddingVertical: 12 },
  commentsLabel:   {
    fontSize: 13, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  noComments:      { textAlign: 'center', padding: 24, fontSize: 14 },
  inputRow:        {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, gap: 10,
  },
  input:           {
    flex: 1, borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 100,
  },
  sendBtn:         { backgroundColor: colors.cyan, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
