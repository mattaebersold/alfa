import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  useGetPostQuery,
  useCreateCommentMutation,
  useGetPostCountsQuery,
} from '../../api/apiService';
import { useCommentThread, type CommentRowItem } from '../../hooks/useCommentThread';
import { useAppSelector } from '../../store/store';
import Avatar from '../../components/ui/Avatar';
import Badge from '../../components/ui/Badge';
import LikeButton from '../../components/social/LikeButton';
import CommentRow, { type CommentData } from '../../components/social/CommentRow';
import LikersSheet from '../../components/social/LikersSheet';
import Spinner from '../../components/ui/Spinner';
import { firstGalleryUrl } from '../../utils/image';
import { colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { MarketScreenProps, AppStackParamList } from '../../navigation/types';
import { stripHtml } from '../../utils/text';
import { ss } from '../../styles/shared';
import { useRefreshControl } from '../../hooks/useRefreshControl';

export default function ListingDetailScreen({ route }: MarketScreenProps<'ListingDetail'>) {
  const { postId } = route.params;
  const colors = useColors();
  const { userInfo } = useAppSelector((s) => s.auth);
  const appNav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  const { data: postData, isLoading, refetch } = useGetPostQuery(postId);
  const refreshControl = useRefreshControl(refetch);
  const post = postData ? { ...postData.entry, user: postData.entry.user ?? postData.user } : undefined;
  const { rows: commentRows, comments } = useCommentThread(post?.entry_type ?? 'post', postId, { skip: !post });
  const { data: counts } = useGetPostCountsQuery(postId, { skip: !post });
  const [createComment, { isLoading: submitting }] = useCreateCommentMutation();
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<{ commentId: string; username: string } | null>(null);
  const [likersOpen, setLikersOpen] = useState(false);

  if (isLoading || !post) return <Spinner fullScreen />;

  const heroImage = firstGalleryUrl(post.gallery);
  const displayName = post.user?.username || 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'listing';

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    const fd = new FormData();
    fd.append('document_id', post.internal_id);
    fd.append('document_type', entryType);
    fd.append('body', commentText.trim());
    if (replyingTo) fd.append('reply_to', replyingTo.commentId);
    try {
      await createComment(fd).unwrap();
      setCommentText('');
      setReplyingTo(null);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  };

  return (
    <SafeAreaView style={[ss.fill, { backgroundColor: colors.cream }]} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={90}
      >
        <FlatList
          refreshControl={refreshControl}
          data={commentRows as any[]}
          keyExtractor={(item: any) => item.comment.internal_id ?? item.comment._id}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              <View style={[styles.postHeader, { backgroundColor: colors.card }]}>
                <Avatar
                  user={post.user}
                  size={40}
                />
                <View style={styles.postHeaderText}>
                  <Text style={[styles.author, { color: colors.fg }]}>@{displayName}</Text>
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

              {(post.price || post.sold) && (
                <View style={[styles.priceRow, { backgroundColor: colors.card }]}>
                  {post.price && !post.sold && (
                    <View style={styles.pricePill}>
                      <Text style={styles.priceText}>${Number(post.price).toLocaleString()}</Text>
                    </View>
                  )}
                  {post.sold && (
                    <View style={styles.soldPill}>
                      <Text style={styles.soldText}>SOLD</Text>
                    </View>
                  )}
                </View>
              )}

              {post.user && post.user.user_id !== userInfo?.user_id && (
                <TouchableOpacity
                  style={[styles.messageBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  activeOpacity={0.8}
                  onPress={() => appNav.navigate('ComposeMessage', {
                    userId: post.user!.user_id,
                    username: post.user!.username,
                    subject: `Re: ${post.title || 'your listing'}`,
                    initialBody: `I'm interested in your listing "${post.title}"…`,
                  })}
                >
                  <MessageCircle size={18} color={colors.primaryAlt} />
                  <Text style={[styles.messageBtnText, { color: colors.fg }]}>
                    Message {post.user.username ? `@${post.user.username}` : displayName} about this
                  </Text>
                </TouchableOpacity>
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
          renderItem={({ item }: { item: CommentRowItem }) => (
            <CommentRow
              comment={item.comment}
              currentUserId={userInfo?.user_id}
              isReply={item.isReply}
              isThreadStart={item.isThreadStart}
              isThreadEnd={item.isThreadEnd}
              threadId={item.threadId}
              onReply={(commentId, username) => {
                setReplyingTo({ commentId, username });
                setCommentText(`@${username} `);
              }}
            />
          )}
          ListEmptyComponent={
            <Text style={[styles.noComments, { color: colors.grey }]}>No comments yet.</Text>
          }
          contentContainerStyle={styles.list}
        />

        <View style={{ backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.border }}>
          {replyingTo && (
            <View style={[styles.replyBanner, { backgroundColor: colors.segment, borderBottomColor: colors.border }]}>
              <Text style={[styles.replyBannerText, { color: colors.grey }]}>
                Replying to <Text style={{ fontWeight: '700', color: colors.fg }}>@{replyingTo.username}</Text>
              </Text>
              <TouchableOpacity onPress={() => { setReplyingTo(null); setCommentText(''); }} hitSlop={8}>
                <Text style={{ fontSize: 18, color: colors.grey }}>×</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.inputRow}>
            <Avatar
              user={userInfo}
              size={32}
            />
            <TextInput
              style={[ss.chatInput, { borderColor: colors.border, color: colors.fg }]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={replyingTo ? `Reply to @${replyingTo.username}...` : 'Write a comment...'}
              placeholderTextColor={colors.grey}
              multiline
              autoFocus={!!replyingTo}
            />
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !commentText.trim()}
              style={[styles.sendBtn, (!commentText.trim() || submitting) && styles.sendBtnDisabled]}
            >
              <Text style={styles.sendText}>Post</Text>
            </TouchableOpacity>
          </View>
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
  priceRow:        { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  pricePill:       { backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
  priceText:       { color: '#FFFFFF', fontSize: 20, fontWeight: '800' },
  soldPill:        { backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, alignSelf: 'flex-start' },
  soldText:        { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  messageBtn:      {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  messageBtnText:  { fontSize: 15, fontWeight: '600', flex: 1 },
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
  replyBanner:     {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 7, borderBottomWidth: 1,
  },
  replyBannerText: { fontSize: 13 },
  inputRow:        {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },
  sendBtn:         { backgroundColor: colors.primaryAlt, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  sendBtnDisabled: { opacity: 0.4 },
  sendText:        { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
