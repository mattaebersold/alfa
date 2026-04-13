import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { formatDistanceToNow } from 'date-fns';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useGetPostQuery,
  useGetCommentsQuery,
  useCreateCommentMutation,
} from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import Spinner from '../../components/ui/Spinner';
import { firstGalleryUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import type { MarketScreenProps } from '../../navigation/types';

export default function ListingDetailScreen({ route }: MarketScreenProps<'ListingDetail'>) {
  const { postId } = route.params;
  const { userInfo } = useAppSelector((s) => s.auth);

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
    <SafeAreaView style={styles.safe} edges={['bottom']}>
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
              <View style={styles.postHeader}>
                <Avatar
                  filename={post.user?.gallery?.[0]?.filename ?? post.user?.profilePicture}
                  name={displayName}
                  size={40}
                />
                <View style={styles.postHeaderText}>
                  <Text style={styles.author}>{displayName}</Text>
                  {post.user?.username && (
                    <Text style={styles.username}>@{post.user.username}</Text>
                  )}
                </View>
                <Badge variant={entryType} />
              </View>

              {post.title && <Text style={styles.postTitle}>{post.title}</Text>}
              {post.body && (
                <Text style={styles.postBody}>{post.body.replace(/<[^>]*>/g, '')}</Text>
              )}

              {heroImage && (
                <Image source={{ uri: heroImage }} style={styles.heroImage} contentFit="cover" />
              )}

              {post.price && (
                <Text style={styles.price}>${Number(post.price).toLocaleString()}</Text>
              )}

              {post.sold && (
                <View style={styles.soldBadge}>
                  <Text style={styles.soldText}>SOLD</Text>
                </View>
              )}

              {(post.make || post.model || post.year) && (
                <View style={styles.specRow}>
                  {post.year && <Text style={styles.specText}>{post.year}</Text>}
                  {post.make && <Text style={styles.specText}>{post.make}</Text>}
                  {post.model && <Text style={styles.specText}>{post.model}</Text>}
                </View>
              )}

              <View style={styles.likeRow}>
                <LikeButton
                  documentId={post.internal_id}
                  entryType={entryType}
                  initialCount={post.likeCount ?? 0}
                  initialLiked={post.isLiked ?? false}
                />
              </View>

              <View style={styles.commentsDivider}>
                <Text style={styles.commentsLabel}>
                  Comments {comments.length > 0 ? `(${comments.length})` : ''}
                </Text>
              </View>
            </View>
          }
          renderItem={({ item }: { item: any }) => (
            <View style={styles.comment}>
              <Avatar
                filename={item.user?.gallery?.[0]?.filename}
                name={item.user?.firstName ?? '?'}
                size={32}
              />
              <View style={styles.commentBody}>
                <Text style={styles.commentAuthor}>
                  {item.user?.firstName} {item.user?.lastName}
                </Text>
                <Text style={styles.commentText}>{item.body}</Text>
                <Text style={styles.commentTime}>
                  {item.created_at
                    ? formatDistanceToNow(new Date(item.created_at), { addSuffix: true })
                    : ''}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.noComments}>No comments yet.</Text>
          }
          contentContainerStyle={styles.list}
        />

        <View style={styles.inputRow}>
          <Avatar
            filename={userInfo?.gallery?.[0]?.filename}
            name={userInfo?.firstName ?? '?'}
            size={32}
          />
          <TextInput
            style={styles.input}
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment..."
            placeholderTextColor={Colors.grey}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.cream },
  flex:            { flex: 1 },
  list:            { paddingBottom: 16 },
  postHeader:      {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, gap: 12, backgroundColor: '#FFFFFF',
  },
  postHeaderText:  { flex: 1 },
  author:          { fontSize: 15, fontWeight: '700', color: Colors.fg },
  username:        { fontSize: 12, color: Colors.grey },
  postTitle:       {
    fontSize: 18, fontWeight: '800', color: Colors.fg,
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF',
  },
  postBody:        {
    fontSize: 15, color: Colors.muted, lineHeight: 22,
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF',
  },
  heroImage:       { width: '100%', height: 280 },
  price:           {
    fontSize: 24, fontWeight: '800', color: Colors.brg,
    paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF',
  },
  soldBadge:       {
    backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 6,
    marginHorizontal: 16, marginTop: 8, borderRadius: 6, alignSelf: 'flex-start',
  },
  soldText:        { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  specRow:         {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  specText:        {
    fontSize: 13, color: Colors.grey, backgroundColor: Colors.segment,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, fontWeight: '600',
  },
  likeRow:         {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  commentsDivider: { paddingHorizontal: 16, paddingVertical: 12 },
  commentsLabel:   {
    fontSize: 13, fontWeight: '700', color: Colors.grey,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  comment:         {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    gap: 10, backgroundColor: '#FFFFFF', marginBottom: 1,
  },
  commentBody:     { flex: 1 },
  commentAuthor:   { fontSize: 13, fontWeight: '700', color: Colors.fg },
  commentText:     { fontSize: 14, color: Colors.muted, marginTop: 2, lineHeight: 20 },
  commentTime:     { fontSize: 11, color: Colors.grey, marginTop: 4 },
  noComments:      { textAlign: 'center', padding: 24, color: Colors.grey, fontSize: 14 },
  inputRow:        {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 10,
  },
  input:           {
    flex: 1, borderWidth: 1, borderColor: Colors.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, color: Colors.fg, maxHeight: 100,
  },
  sendBtn:         { backgroundColor: Colors.brg, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
