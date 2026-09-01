import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
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
import ImageLightbox from '../ui/ImageLightbox';
import MessageAboutListingButton from '../social/MessageAboutListingButton';
import { useGetUserByIdQuery, useGetLikeUsersQuery } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { imageUrl } from '../../utils/image';
import { postMediaList, type PostMedia } from '../../utils/postMedia';
import PostMediaCarousel from '../media/PostMediaCarousel';

import { colors, BADGE_COLORS, CATEGORY_BADGE_COLORS } from '../../constants/colors';
import { DIECAST_BLUE } from '../../constants/diecast';
import { useColors } from '../../hooks/useColors';
import type { FeedStackParamList } from '../../navigation/types';
import type { Post } from '../../types/api';
import { stripHtml } from '../../utils/text';
import GroupAttribution from '../groups/GroupAttribution';
import LikersSheet from '../social/LikersSheet';
import { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';

type NavProp = NativeStackNavigationProp<FeedStackParamList>;


interface FeedItemCardProps {
  post: Post;
  isLiked?: boolean;
  onPress?: () => void;
  onCommentPress?: () => void;
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
  // Non-null while the likers panel is open — it doubles as the rect the panel
  // grows out of.
  const [likersOrigin, setLikersOrigin] = useState<SummaryOrigin | null | undefined>(undefined);

  // Photos and videos are one ordered list — see utils/postMedia. This also
  // folds in posts whose video predates typed gallery entries, so the card
  // doesn't need a separate branch for them any more.
  const media = postMediaList(post);
  const hasMedia = media.length > 0;
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
  const displayName = user?.username || 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';  // for LikeButton API calls
  const badgeType = post.type ?? post.entry_type ?? 'post';  // what the user actually chose
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';
  const mediaCount = media.length;

  // Tap still opens the post — that's what a card in a feed is for. A pinch on
  // the photo opens the full-screen viewer instead, which is the gesture people
  // already reach for when they want a closer look, and it doesn't compete with
  // either the tap or the sideways swipe through the gallery.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  // The zoom viewer shows photos; a video has its own player and nothing to
  // pinch into.
  const galleryUrls = media
    .filter((m): m is Extract<PostMedia, { kind: 'image' }> => m.kind === 'image')
    .map((m) => m.url);
  const zoomGesture = Gesture.Pinch().onStart(() => {
    runOnJS(setZoomIndex)(0);
  });
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
    /**
     * A plain View, not a TouchableOpacity.
     *
     * The card used to be one big press target with the gallery inside it, and
     * on Android the outer touchable wins the responder negotiation against a
     * nested horizontal list often enough that swiping between a post's photos
     * mostly didn't work. Opening the post is now attached to the regions that
     * are only ever tapped — the words, and the single-image hero — leaving the
     * gallery's own gesture uncontested.
     */
    <View style={[styles.card, { backgroundColor: cardBg }]}>
      {/* Header — avatar/name tap navigates to profile */}
      <TouchableOpacity
        style={styles.header}
        onPress={() => user?.user_id && navigation.navigate('UserDetail', { userId: user.user_id, username: user.username })}
        activeOpacity={0.7}
      >
        <Avatar user={user} size={36} />
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
        <TouchableOpacity
          style={hasMedia ? styles.titleWrap : styles.titleAloneWrap}
          onPress={onPress}
          activeOpacity={0.95}
        >
          <MentionText
            text={post.title || bodyText}
            style={[hasMedia ? styles.title : styles.titleAlone, { color: fgColor }]}
            numberOfLines={hasMedia ? 2 : 5}
          />
        </TouchableOpacity>
      )}

      {/* A taste of the body under the title — enough to know whether to open
          it, not enough to be the post. Skipped when the body *is* the line
          above. */}
      {post.title && bodyText ? (
        <TouchableOpacity style={styles.bodyPreviewWrap} onPress={onPress} activeOpacity={0.95}>
          <MentionText
            text={bodyText}
            style={[styles.bodyPreview, { color: mutedColor }]}
            numberOfLines={2}
          />
        </TouchableOpacity>
      ) : null}

      {/* The post's media — photos and videos in one strip, drawn at one
          shape so swiping doesn't resize the card. */}
      {hasMedia && (
        <GestureDetector gesture={zoomGesture}>
          <View>
            <PostMediaCarousel
              media={media}
              // A tap on a photo opens the post, which is what a card in a feed
              // is for. A video's first tap is its own — it starts playback
              // rather than navigating away from it.
              onPressItem={onPress}
              overlay={
                <>
                  {/* Type + category badges — top left, color coded */}
                  <View style={styles.imageBadgesLeft} pointerEvents="none">
                    <View style={[styles.imgBadge, { backgroundColor: typeBadge.bg }]}>
                      <Text style={[styles.imgBadgeText, { color: typeBadge.fg }]}>{TYPE_LABELS[badgeType] ?? badgeType}</Text>
                    </View>
                    {categoryBadge ? (
                      <View style={[styles.imgBadge, { backgroundColor: categoryBadge.bg }]}>
                        <Text style={[styles.imgBadgeText, { color: categoryBadge.fg }]}>{CATEGORY_LABELS[post.category!] ?? post.category}</Text>
                      </View>
                    ) : null}
                  </View>
                  {/* Price + media count — top right column */}
                  <View style={styles.imageBadgesRight} pointerEvents="none">
                    {post.price ? (
                      <View style={styles.priceBadge}>
                        <Text style={styles.priceBadgeText}>${Number(post.price).toLocaleString()}</Text>
                      </View>
                    ) : null}
                    {mediaCount > 1 && (
                      <View style={styles.multiImgBadge}>
                        <View style={styles.multiImgIcon}>
                          <View style={[styles.miniImg, styles.miniImgBack]} />
                          <View style={[styles.miniImg, styles.miniImgFront]} />
                        </View>
                        <Text style={styles.multiImgCount}>{mediaCount}</Text>
                      </View>
                    )}
                  </View>
                </>
              }
            />
          </View>
        </GestureDetector>
      )}

      <ImageLightbox
        images={galleryUrls}
        initialIndex={zoomIndex ?? 0}
        visible={zoomIndex !== null}
        onClose={() => setZoomIndex(null)}
      />

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

      {/* The line opens the full list; the name inside it still goes straight
          to that person, since a nested Text's own press wins. */}
      {likeCount > 0 && (
        <SummaryTouchable
          onPress={(origin) => setLikersOrigin(origin)}
          accessibilityLabel={`See everyone who liked this`}
        >
          <LikedByLine
            likers={likers}
            total={likeCount}
            myId={userInfo?.user_id}
            color={mutedColor}
            style={styles.likedBy}
          />
        </SummaryTouchable>
      )}

      <LikersSheet
        entryId={post.internal_id}
        visible={likersOrigin !== undefined}
        origin={likersOrigin}
        onClose={() => setLikersOrigin(undefined)}
      />

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
    </View>
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
