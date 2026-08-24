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
import GroupAttribution from '../groups/GroupAttribution';

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
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const featuredId = likers.find((id) => id !== myId) ?? likers[0];
  const { data: user } = useGetUserByIdQuery(featuredId, { skip: !featuredId });
  if (total <= 0) return null;

  const name = user?.username;
  if (!name) {
    return (
      <Text style={[style, { color }]}>
        {total === 1 ? 'Liked by someone' : `Liked by ${total} people`}
      </Text>
    );
  }

  // The name is the one part of this line that leads somewhere, so it's the
  // part you can press. Colour alone says so — it keeps the weight of the
  // sentence it sits in.
  const others = total - 1;
  return (
    <Text style={[style, { color }]}>
      Liked by{' '}
      <Text
        style={{ color: colors.blueLight }}
        onPress={() => navigation.navigate('UserDetail', { userId: user.user_id, username: name })}
        suppressHighlighting
      >
        {name}
      </Text>
      {total > 1 ? ` and ${others} ${others === 1 ? 'other' : 'others'}` : ''}
    </Text>
  );
}

export default function FeedItemCard({ post, isLiked, onPress, onCommentPress }: FeedItemCardProps) {
  const colors = useColors();
  const navigation = useNavigation<NavProp>();
  const { userInfo } = useAppSelector((s) => s.auth);
  const hiddenIds = useAppSelector((s) => (s as any).moderation?.hiddenContentIds ?? []);
  const blockedUserIds = useAppSelector((s) => (s as any).moderation?.blockedUserIds ?? []);
  const [imgAspectRatio, setImgAspectRatio] = useState(16 / 9);

  const gallery = post.gallery ?? [];
  const heroImage = firstGalleryUrl(post.gallery);
  const videoThumbnail = !heroImage && post.video_id ? muxThumbnailUrl(post.video_id) : null;
  const hasMedia = gallery.length > 0 || !!videoThumbnail;
  const bodyText = post.body ? stripHtml(post.body).trim() : '';

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

      {/* The title, or the body standing in for it when there isn't one.
          Without a picture the words are the whole card, and at the size that
          sits under a photo they read as a caption for something missing.

          Padding lives on the wrapper, not the text: MentionText hands its
          style down to each inline segment, and a mention carrying the card's
          horizontal padding would sit in a gap of its own. */}
      {(post.title || bodyText) && (
        <View style={hasMedia ? styles.titleWrap : styles.titleAloneWrap}>
          <MentionText
            text={post.title || bodyText}
            style={[hasMedia ? styles.title : styles.titleAlone, { color: fgColor }]}
            numberOfLines={hasMedia ? 2 : 5}
          />
        </View>
      )}

      {/* A taste of the body under the title — enough to know whether to open
          it, not enough to be the post. Skipped when the body *is* the line
          above. */}
      {post.title && bodyText ? (
        <View style={styles.bodyPreviewWrap}>
          <MentionText
            text={bodyText}
            style={[styles.bodyPreview, { color: mutedColor }]}
            numberOfLines={2}
          />
        </View>
      ) : null}

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
      {/* Where this came from, when it came from somewhere. Below the post
          rather than above it: the post is what you came to read, and this
          lands where "and where was this?" actually occurs to you. Above the
          likes, which belong with the actions they came from. */}
      <GroupAttribution groupId={post.group_ids?.[0] ?? post.group_id} />

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
      <View style={styles.actions}>
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
  titleWrap:      { paddingHorizontal: 12, paddingBottom: 10 },
  title:          { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  titleAloneWrap: { paddingHorizontal: 12, paddingTop: 2, paddingBottom: 12 },
  titleAlone:     { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  bodyPreviewWrap:{ paddingHorizontal: 12, paddingBottom: 10, marginTop: -4 },
  bodyPreview:    { fontSize: 13, lineHeight: 18 },

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

  videoThumb:  { width: '100%', aspectRatio: 4 / 5, overflow: 'hidden', position: 'relative' },
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
  likedBy:     { fontSize: 12, fontWeight: '600', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 2 },
  // No rule above the actions: the card already ends here, and a line across
  // it read as a divider between two things rather than as the foot of one.
  actions:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingTop: 3, paddingBottom: 10,
    gap: 6, marginTop: 0,
  },
});
