import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Polygon } from 'react-native-svg';
import { formatDistanceToNow } from 'date-fns';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import LikeButton from '../social/LikeButton';
import CommentButton from '../social/CommentButton';
import { imageUrl, firstGalleryUrl } from '../../utils/image';
import { Colors } from '../../constants/colors';
import { useColors } from '../../hooks/useColors';
import type { Post } from '../../types/api';

interface FeedItemCardProps {
  post: Post;
  onPress?: () => void;
  onCommentPress?: () => void;
}

function muxThumbnailUrl(videoId: string) {
  return `https://image.mux.com/${videoId}/thumbnail.jpg?width=720&fit_mode=smartcrop`;
}

export default function FeedItemCard({ post, onPress, onCommentPress }: FeedItemCardProps) {
  const colors = useColors();
  const heroImage = firstGalleryUrl(post.gallery);
  const videoThumbnail = !heroImage && post.video_id ? muxThumbnailUrl(post.video_id) : null;
  const avatarFilename = post.user?.gallery?.[0]?.filename ?? post.user?.profilePicture;
  const displayName = post.user
    ? `${post.user.firstName} ${post.user.lastName}`.trim() || post.user.username
    : 'Unknown';
  const entryType = post.entry_type ?? post.type ?? 'post';
  const timeAgo = post.created_at
    ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
    : '';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {/* Header */}
      <View style={styles.header}>
        <Avatar filename={avatarFilename} name={displayName} size={36} />
        <View style={styles.headerText}>
          <Text style={[styles.author, { color: colors.fg }]}>{displayName}</Text>
          {post.user?.username && (
            <Text style={[styles.username, { color: colors.grey }]}>@{post.user.username}</Text>
          )}
        </View>
        <View style={styles.headerRight}>
          <Badge variant={entryType} />
          <Text style={[styles.time, { color: colors.grey }]}>{timeAgo}</Text>
        </View>
      </View>

      {/* Title */}
      {post.title && (
        <Text style={[styles.title, { color: colors.fg }]} numberOfLines={2}>{post.title}</Text>
      )}

      {/* Body preview */}
      {post.body ? (
        <Text style={[styles.body, { color: colors.muted }]} numberOfLines={3}>
          {post.body.replace(/<[^>]*>/g, '')}
        </Text>
      ) : null}

      {/* Hero image */}
      {heroImage && (
        <Image
          source={{ uri: heroImage }}
          style={styles.image}
          contentFit="cover"
          transition={300}
          placeholder={{ blurhash: 'LGFFaXYk^6#M@-5c,1J5@[or[Q6.' }}
        />
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
          {/* Play button overlay */}
          <View style={styles.playOverlay}>
            <View style={styles.playCircle}>
              <Svg width={20} height={20} viewBox="0 0 20 20">
                <Polygon points="6,3 18,10 6,17" fill="#fff" />
              </Svg>
            </View>
          </View>
        </View>
      )}

      {/* Listing price */}
      {post.price && (
        <Text style={styles.price}>${Number(post.price).toLocaleString()}</Text>
      )}

      {/* Actions */}
      <View style={[styles.actions, { borderTopColor: colors.border }]}>
        <LikeButton
          documentId={post.internal_id}
          entryType={entryType}
          initialCount={post.likeCount ?? 0}
          initialLiked={post.isLiked ?? false}
        />
        <CommentButton count={post.commentCount ?? 0} onPress={onCommentPress} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  header:      { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  headerText:  { flex: 1 },
  author:      { fontSize: 14, fontWeight: '700' },
  username:    { fontSize: 12, marginTop: 1 },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  time:        { fontSize: 11 },
  title:       { fontSize: 16, fontWeight: '700', paddingHorizontal: 12, paddingBottom: 6, lineHeight: 22 },
  body:        { fontSize: 14, paddingHorizontal: 12, paddingBottom: 8, lineHeight: 20 },
  image:       { width: '100%', height: 220 },
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
  price:       { fontSize: 18, fontWeight: '800', color: Colors.brg, paddingHorizontal: 12, paddingTop: 8 },
  actions:     {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingVertical: 8,
    gap: 12, borderTopWidth: 1, marginTop: 4,
  },
});
