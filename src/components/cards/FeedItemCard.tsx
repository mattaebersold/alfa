import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Polygon } from 'react-native-svg';
import { formatDistanceToNow } from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Avatar from '../ui/Avatar';
import MentionText from '../ui/MentionText';
import Badge, { TYPE_LABELS, CATEGORY_LABELS } from '../ui/Badge';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import ReportButton from '../ui/ReportButton';
import PostOwnerMenu from '../social/PostOwnerMenu';
import MessageAboutListingButton from '../social/MessageAboutListingButton';
import { useGetUserByIdQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { firstGalleryUrl } from '../../utils/image';

import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { DIECAST_BLUE } from '../../constants/diecast';
import { useColors } from '../../hooks/useColors';
import type { FeedStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { stripHtml } from '../../utils/text';

type NavProp = NativeStackNavigationProp<FeedStackParamList>;

interface FeedItemCardProps {
  post: Post;
  isLiked?: boolean;
  onPress?: () => void;
  onCommentPress?: () => void;
}

function muxThumbnailUrl(videoId: string) {
  return `https://image.mux.com/${videoId}/thumbnail.jpg?width=720&fit_mode=smartcrop`;
}

export default function FeedItemCard({ post, isLiked, onPress, onCommentPress }: FeedItemCardProps) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  const [imgAspectRatio, setImgAspectRatio] = useState(16 / 9);

  const heroImage = firstGalleryUrl(post.gallery);
  const videoThumbnail = !heroImage && post.video_id ? muxThumbnailUrl(post.video_id) : null;

  const { data: fetchedUser } = useGetUserByIdQuery(post.user_id, { skip: !post.user_id });
  const user = fetchedUser ?? post.user ?? post.user_objectid;
  const avatarFilename = user?.gallery?.[0]?.filename ?? user?.profilePicture;
  const displayName = user?.username || 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';  // for LikeButton API calls
  const badgeType = post.type ?? post.entry_type ?? 'post';  // what the user actually chose
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  const galleryCount = post.gallery?.length ?? 0;
  const isListing = post.type === 'listing' || post.type === 'want';
  const isDiecast = post.category === 'diecast';
  const cardBg = isDiecast ? DIECAST_BLUE : colors.card;
  const fgColor = isDiecast ? '#FFFFFF' : colors.fg;
  const mutedColor = isDiecast ? 'rgba(255,255,255,0.7)' : colors.muted;
  const timeColor = isDiecast ? 'rgba(255,255,255,0.6)' : colors.grey;
  const typeBadge = BADGE_COLORS[badgeType] ?? BADGE_COLORS.default;
  const categoryBadge = post.category
    ? (CATEGORY_BADGE_COLORS[post.category] ?? CATEGORY_BADGE_COLORS.default)
    : null;

  // Hidden (reported) or from a blocked user — return after all hooks to keep hook order stable.
  if (hiddenIds.includes(post.internal_id) || (post.user_id && blockedUserIds.includes(post.user_id))) return null;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: cardBg }]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Header — avatar/name tap navigates to profile */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => user?.user_id && navigation.navigate('UserDetail', { userId: user.user_id, username: user.username })}
        activeOpacity={0.7}
      >
        <Avatar filename={avatarFilename} name={displayName} size={36} />
        <View style={styles.headerText}>
          <Text style={[styles.author, { color: fgColor }]}>@{displayName}</Text>
        </View>
        <Text style={[styles.time, { color: timeColor }]}>{timeAgo}</Text>
        {userInfo?.user_id === post.user_id ? (
          <PostOwnerMenu postId={post.internal_id} color={isDiecast ? '#FFFFFF' : colors.grey} />
        ) : (
          <ReportButton contentType="post" contentId={post.internal_id} size={18} />
        )}
      </TouchableOpacity>

      {post.title && (
        <Text style={[styles.title, { color: fgColor }]} numberOfLines={2}>{post.title}</Text>
      )}

      {/* Hero image with overlays */}
      {heroImage && (
        <View style={styles.imageWrap}>
          <Image
            source={{ uri: heroImage }}
            style={[styles.image, { aspectRatio: imgAspectRatio }]}
            contentFit="cover"
            transition={300}
            placeholder={{ blurhash: 'LGFFaXYk^6#M@-5c,1J5@[or[Q6.' }}
            onLoad={(e) => setImgAspectRatio(e.source.width / e.source.height)}
          />
          {/* Type + category badges — top left, color coded */}
          <View style={styles.imageBadgesLeft}>
            <View style={[styles.imgBadge, { backgroundColor: typeBadge.bg }]}>
              <Text style={[styles.imgBadgeText, { color: typeBadge.fg }]}>{TYPE_LABELS[badgeType] ?? badgeType}</Text>
            </View>
            {categoryBadge ? (
              <View style={[styles.imgBadge, { backgroundColor: categoryBadge.bg }]}>
                <Text style={[styles.imgBadgeText, { color: categoryBadge.fg }]}>{CATEGORY_LABELS[post.category!] ?? post.category}</Text>
              </View>
            ) : null}
          </View>
          {/* Price + multi-image — top right column */}
          <View style={styles.imageBadgesRight}>
            {post.price ? (
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>${Number(post.price).toLocaleString()}</Text>
              </View>
            ) : null}
            {galleryCount > 1 && (
              <View style={styles.multiImgBadge}>
                <View style={styles.multiImgIcon}>
                  <View style={[styles.miniImg, styles.miniImgBack]} />
                  <View style={[styles.miniImg, styles.miniImgFront]} />
                </View>
                <Text style={styles.multiImgCount}>{galleryCount}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Video thumbnail (when no gallery image) */}
      {videoThumbnail && (
        <View style={styles.videoThumb}>
          <Image
            source={{ uri: videoThumbnail }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <Polygon points="6,3 18,10 6,17" fill="#fff" />
              </Svg>
            </View>
          </View>
        </View>
      )}

      {/* Message the seller about a marketplace listing */}
      {isListing && user?.user_id && userInfo?.user_id !== post.user_id && (
        <View style={styles.messageWrap}>
          <MessageAboutListingButton sellerId={user.user_id} sellerUsername={user.username} listingTitle={post.title} />
        </View>
      )}

      {/* Liked-by row */}
      {(post.like_count ?? post.likeCount ?? 0) > 0 && (
        <Text style={[styles.likedBy, { color: mutedColor }]}>
          Liked by {post.like_count ?? post.likeCount} {(post.like_count ?? post.likeCount ?? 0) === 1 ? 'person' : 'people'}
        </Text>
      )}

      {/* Actions */}
      <View style={[styles.actions, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
        <LikeButton
          documentId={post.internal_id}
          entryType={entryType}
          initialCount={post.like_count ?? post.likeCount ?? 0}
          initialLiked={isLiked ?? post.isLiked ?? false}
        />
        <CommentButton count={post.comment_count ?? post.commentCount ?? 0} onPress={onCommentPress} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    // borderRadius: 12,
    // marginHorizontal: 12,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 12, paddingBottom: 10, gap: 10 },
  headerText:  { flex: 1 },
  author:      { fontSize: 14, fontWeight: '700' },
  username:    { fontSize: 12, marginTop: 1 },
  time:        { fontSize: 11, fontStyle: 'italic' },
  title:       { fontSize: 14, fontWeight: '600', paddingHorizontal: 12, paddingBottom: 10, lineHeight: 20 },

  imageWrap:   { position: 'relative' },
  image:       { width: '100%' },

  imageBadgesLeft: {
    position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 5, flexWrap: 'wrap',
  },
  imgBadge:   {
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5,
  },
  imgBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  imageBadgesRight: {
    position: 'absolute', top: 10, right: 10, alignItems: 'flex-end', gap: 5,
  },
  priceBadge:    {
    backgroundColor: '#3a8a3a',
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4
  },
  priceBadgeText: { fontSize: 13, fontWeight: '800', color: '#000' },
  multiImgBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 5,
  },
  multiImgIcon:  { width: 16, height: 13, position: 'relative' },
  miniImg:       {
    position: 'absolute', width: 11, height: 10,
    borderRadius: 2, borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  miniImgBack:   { top: 0, left: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  miniImgFront:  { bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.55)' },
  multiImgCount: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },

  videoThumb:  { width: '100%', height: 220, overflow: 'hidden', position: 'relative' },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playCircle:  {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    paddingLeft: 4,
  },
  messageWrap: { paddingHorizontal: 12, paddingTop: 10 },
  likedBy:     { fontSize: 13, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  actions:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 12, borderTopWidth: 1, marginTop: 4,
  },
});
