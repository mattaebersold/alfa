import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
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
import { useGetUserByIdQuery, useGetLikeUsersQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { firstGalleryUrl, imageUrl } from '../../utils/image';

import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { DIECAST_BLUE } from '../../constants/diecast';
import { useColors } from '../../hooks/useColors';
import type { FeedStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { stripHtml } from '../../utils/text';

type NavProp = NativeStackNavigationProp<FeedStackParamList>;

const SCREEN_WIDTH = Dimensions.get('window').width;

interface FeedItemCardProps {
  post: Post;
  isLiked?: boolean;
  onPress?: () => void;
  onCommentPress?: () => void;
}

function muxThumbnailUrl(videoId: string) {
  return `https://image.mux.com/${videoId}/thumbnail.jpg?width=720&fit_mode=smartcrop`;
}

// "Liked by matt and 3 others" — resolves the username of a representative liker
// (preferring someone other than the viewer) and appends the remaining count.
function LikedByLine({ likers, total, myId, color, style }: {
  likers: string[]; total: number; myId?: string; color: string; style: any;
}) {
  const featuredId = likers.find((id) => id !== myId) ?? likers[0];
  const { data: user } = useGetUserByIdQuery(featuredId, { skip: !featuredId });
  if (total <= 0) return null;

  const name = user?.username;
  let text: string;
  if (!name) {
    text = total === 1 ? 'Liked by someone' : `Liked by ${total} people`;
  } else if (total === 1) {
    text = `Liked by ${name}`;
  } else {
    const others = total - 1;
    text = `Liked by ${name} and ${others} ${others === 1 ? 'other' : 'others'}`;
  }
  return <Text style={[style, { color }]}>{text}</Text>;
}

export default function FeedItemCard({ post, isLiked, onPress, onCommentPress }: FeedItemCardProps) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  const [imgAspectRatio, setImgAspectRatio] = useState(16 / 9);
  const [activeIndex, setActiveIndex] = useState(0);

  const gallery = post.gallery ?? [];
  const heroImage = firstGalleryUrl(post.gallery);
  const videoThumbnail = !heroImage && post.video_id ? muxThumbnailUrl(post.video_id) : null;

  // Live like state — tells us whether *I* liked this (so the heart shows filled and
  // tapping un-likes) and the true like count, rather than trusting a stale flag.
  const { data: likeData } = useGetLikeUsersQuery(post.internal_id, { skip: !post.internal_id });
  const likers = likeData?.users ?? [];
  const likeCount = likeData?.total ?? post.like_count ?? post.likeCount ?? 0;
  const iLiked = userInfo?.user_id
    ? likers.includes(userInfo.user_id)
    : (isLiked ?? post.isLiked ?? false);

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

      {/* Hero image(s) with overlays — swipes through the gallery like the post modal */}
      {gallery.length > 0 && (
        <View style={[styles.imageWrap, { aspectRatio: imgAspectRatio }]}>
          {gallery.length > 1 ? (
            <FlatList
              data={gallery}
              keyExtractor={(g, i) => g.filename ?? String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              style={StyleSheet.absoluteFill}
              onMomentumScrollEnd={(e) => setActiveIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
              getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
              renderItem={({ item, index }) => (
                <Image
                  source={{ uri: imageUrl(item.filename)! }}
                  style={{ width: SCREEN_WIDTH, height: '100%' }}
                  contentFit="cover"
                  transition={200}
                  onLoad={index === 0 ? (e) => setImgAspectRatio(e.source.width / e.source.height) : undefined}
                />
              )}
            />
          ) : (
            <Image
              source={{ uri: heroImage! }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={300}
              placeholder={{ blurhash: 'LGFFaXYk^6#M@-5c,1J5@[or[Q6.' }}
              onLoad={(e) => setImgAspectRatio(e.source.width / e.source.height)}
            />
          )}
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
          {/* Swipe position dots */}
          {gallery.length > 1 && (
            <View style={styles.dots} pointerEvents="none">
              {gallery.map((_, i) => (
                <View key={i} style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]} />
              ))}
            </View>
          )}
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
      {likeCount > 0 && (
        <LikedByLine
          likers={likers}
          total={likeCount}
          myId={userInfo?.user_id}
          color={mutedColor}
          style={styles.likedBy}
        />
      )}

      {/* Actions */}
      <View style={[styles.actions, { borderTopColor: 'rgba(255,255,255,0.06)' }]}>
        <LikeButton
          documentId={post.internal_id}
          entryType={entryType}
          initialCount={likeCount}
          initialLiked={iLiked}
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

  imageWrap:   { position: 'relative', width: '100%', overflow: 'hidden' },
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
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 8,
  },
  multiImgIcon:  { width: 22, height: 18, position: 'relative' },
  miniImg:       {
    position: 'absolute', width: 15, height: 13,
    borderRadius: 3, borderWidth: 2, borderColor: '#FFFFFF',
  },
  miniImgBack:   { top: 0, left: 6, backgroundColor: 'rgba(255,255,255,0.25)' },
  miniImgFront:  { bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.55)' },
  multiImgCount: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },

  dots:          {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot:           { width: 6, height: 6, borderRadius: 3 },
  dotActive:     { backgroundColor: '#FFFFFF' },
  dotInactive:   { backgroundColor: 'rgba(255,255,255,0.45)' },

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
