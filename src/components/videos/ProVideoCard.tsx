import React from 'react';
import { View, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Heart, MessageCircle, Bookmark, Eye, RotateCcw, X, Trash2, Clapperboard, Play } from 'lucide-react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import Avatar from '../ui/Avatar';
import { useLikeState } from '../../hooks/useLikeState';
import { formatActionCount } from '../../utils/text';
import { colors } from '../../constants/colors';
import { COMMON_RADIUS, COLOR_WHITE, SURFACE_MID, COLOR_GRAY_160 } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import { muxPoster, formatDuration, formatViewCount, type ProVideo } from '../../types/proVideos';
import type { ProVideoUpload } from '../../utils/proVideoUpload';

/**
 * The strip of a card that shows while it's tucked under the one above —
 * title, member, length, counts. Everything a card says in the stack has to
 * fit in here, since that's all of it most cards ever show until they rise.
 */
export const CARD_PEEK = 84;

/** "Jo Smith", or the username when there's no name. */
export function authorName(u: ProVideo['user']): string {
  if (!u) return 'A member';
  const full = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
  return full || u.username || 'A member';
}

const STATUS_LABEL: Record<ProVideo['status'], string> = {
  uploading: 'Uploading',
  processing: 'Processing',
  ready: '',
  errored: "Couldn't process",
  cancelled: 'Cancelled',
};

/**
 * One video's face in the stack: Mux's poster full bleed, and over its foot
 * — the part that peeks — the title, who posted it, its length and counts.
 *
 * Your own uploads (My uploads) can be anything but ready: no poster yet, so
 * the card says where it's got to instead, with what can be done about it —
 * Retry for one that failed, Cancel for one still going up, Delete.
 */
export default React.memo(function ProVideoCard({
  video, height, onPress, upload, canRetry, onRetry, onCancel, onDelete, tucked = false, playable = false,
}: {
  video: ProVideo;
  height: number;
  onPress: (video: ProVideo) => void;
  /** Under another card in the deck, only its strip showing: the picture's darkened so the title reads. */
  tucked?: boolean;
  /** Showing whole in the deck: a play button over the middle. */
  playable?: boolean;
  /** This phone's upload of it, when it's going up from here. */
  upload?: ProVideoUpload | null;
  canRetry?: boolean;
  onRetry?: (video: ProVideo) => void;
  onCancel?: (video: ProVideo) => void;
  onDelete?: (video: ProVideo) => void;
}) {
  const ready = video.status === 'ready' && !!video.playback_id;
  // The like count follows taps made on the player (LikeButton's store).
  const liked = useLikeState(video.internal_id);
  const likes = liked?.count ?? video.like_count ?? 0;
  const duration = formatDuration(video.duration);
  const status = upload && video.status === 'uploading'
    ? `Uploading · ${upload.total ? Math.floor((upload.sent / upload.total) * 100) : 0}%`
    : STATUS_LABEL[video.status];

  return (
    <Pressable
      onPress={() => onPress(video)}
      style={({ pressed }) => [styles.card, { height }, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${video.title}, by ${authorName(video.user)}${duration ? `, ${duration}` : ''}`}
    >
      {ready ? (
        <Image
          source={{ uri: muxPoster(video.playback_id!) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          recyclingKey={video.internal_id}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.pending]}>
          <Clapperboard size={30} color={COLOR_GRAY_160} strokeWidth={1.6} />
          <Text style={styles.pendingLabel}>{status}</Text>
          {video.status === 'errored' && video.error?.message ? (
            <Text style={styles.pendingNote} numberOfLines={2}>{video.error.message}</Text>
          ) : null}
          {video.status === 'processing' ? (
            <Text style={styles.pendingNote}>Mux is getting it ready to stream — this card updates on its own.</Text>
          ) : null}
          <View style={styles.actions}>
            {video.status === 'errored' && canRetry && onRetry ? (
              <SmallAction label="Retry" Icon={RotateCcw} onPress={() => onRetry(video)} />
            ) : null}
            {video.status === 'uploading' && onCancel ? (
              <SmallAction label="Cancel" Icon={X} onPress={() => onCancel(video)} />
            ) : null}
            {video.status !== 'uploading' && onDelete ? (
              <SmallAction label="Delete" Icon={Trash2} onPress={() => onDelete(video)} />
            ) : null}
          </View>
        </View>
      )}

      {/* Who posted it: just their photo, top-left, in a dark ring — as the
          Pro screen's videos row draws it. Their name is in the label. */}
      {video.user ? (
        <View style={styles.avatar} pointerEvents="none">
          <Avatar user={video.user ?? undefined} size={26} edge={false} />
        </View>
      ) : null}

      {/* Tucked under another card: a veil over the picture. */}
      {tucked ? <View style={[StyleSheet.absoluteFill, styles.veil]} pointerEvents="none" /> : null}

      {/* Showing whole and ready: play, in the middle of the picture above the strip. */}
      {playable && ready ? (
        <View style={styles.playWrap} pointerEvents="none">
          <View style={styles.play}>
            <Play size={24} color={COLOR_WHITE} fill={COLOR_WHITE} style={styles.playIcon} />
          </View>
        </View>
      ) : null}

      {/* The strip: darkened under the words so they read on any poster —
          a taller fade, reaching above the strip. */}
      <LinearGradient
        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.92)']}
        locations={[0, 0.45, 1]}
        style={styles.strip}
        pointerEvents="none"
      >
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{video.title}</Text>
          {duration ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{duration}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.metaRow}>
          {ready ? (
            <View style={styles.counts}>
              <Count Icon={Eye} n={video.views} format={formatViewCount} />
              <Count Icon={Heart} n={likes} />
              <Count Icon={MessageCircle} n={video.comment_count} />
              {video.bookmarked ? <Bookmark size={12} color={colors.pro} fill={colors.pro} /> : null}
            </View>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
});

function Count({ Icon, n, format = formatActionCount }: {
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  n: number;
  format?: (n: number) => string;
}) {
  if (!n) return null;
  return (
    <View style={styles.count}>
      <Icon size={12} color={COLOR_WHITE} strokeWidth={2.2} />
      <Text style={styles.countText}>{format(n)}</Text>
    </View>
  );
}

function SmallAction({ label, Icon, onPress }: { label: string; Icon: React.ComponentType<{ size?: number; color?: string }>; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.action} onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Icon size={14} color={COLOR_WHITE} />
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: SURFACE_MID,
    // Each card casts onto the one beneath it, so the cascade reads as layers.
    shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { opacity: 0.9 },
  pending: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, paddingBottom: CARD_PEEK },
  pendingLabel: { color: COLOR_WHITE, fontSize: 16, fontFamily: FONT_INTER.bold },
  pendingNote: { color: COLOR_GRAY_160, fontSize: 12.5, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)',
  },
  actionText: { color: COLOR_WHITE, fontSize: 13, fontFamily: FONT_INTER.semibold },
  veil: { backgroundColor: 'rgba(0,0,0,0.6)' },
  playWrap: { position: 'absolute', left: 0, right: 0, top: 0, bottom: CARD_PEEK, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  playIcon: { marginLeft: 4 },
  strip: {
    position: 'absolute', left: 0, right: 0, bottom: 0, height: CARD_PEEK + 40,
    paddingHorizontal: 14, paddingBottom: 12, justifyContent: 'flex-end', gap: 7,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, color: COLOR_WHITE, fontSize: 16, fontFamily: FONT_INTER.bold },
  badge: { backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: COLOR_WHITE, fontSize: 11.5, fontFamily: FONT_INTER.semibold, fontVariant: ['tabular-nums'] },
  // Just the counts now, from the left.
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 16 },
  // A 3px black/40 ring round the photo, no shadow — NewProVideosShelf's.
  avatar: { position: 'absolute', top: 10, left: 10, borderRadius: 16, borderWidth: 3, borderColor: 'rgba(0,0,0,0.4)' },
  counts: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  count: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  countText: { color: COLOR_WHITE, fontSize: 11.5, fontFamily: FONT_INTER.semibold },
});
