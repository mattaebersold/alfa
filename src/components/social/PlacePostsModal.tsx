import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Platform,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from 'expo-image';
import { MapPin, Navigation, Play, Image as ImageIcon } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import { PostSheet } from './PostSummaryModal';
import { CurrentPlaceContext } from './PostPlaceLine';
import { useGetPostsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { postThumb } from '../../utils/postMedia';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import { stripHtml } from '../../utils/text';
import type { Post, PostPlace } from '../../types/api';
import { COLOR_WHITE, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';

/** How many posts each page of a place's list brings. */
const PAGE = 20;
/** A row's thumbnail edge. */
const THUMB = 56;

// ── One post, compact ────────────────────────────────────────────────────────

/**
 * One post as a short row: its first picture, its words, who and when.
 *
 * For lists of posts that are all about one other thing — a place's posts here,
 * the posts map's carousel — where the post's own card would be too much to
 * scroll through and RecordRow's photo-led row too tall. A post with no picture
 * keeps a placeholder square, so the words in a column of these line up.
 *
 * Purely presentational: the host decides what a tap opens. `onPress` gets the
 * row's rectangle, for a summary to grow out of.
 */
export function PlacePostRow({ post, onPress, style }: {
  post: Post;
  onPress?: (origin: SummaryOrigin | null) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const { url, isVideo } = postThumb(post);
  const body = post.body ? stripHtml(post.body).trim() : '';
  const lead = post.title?.trim() || body || 'Post';
  // A line of the body under a title; nothing when the body already led.
  const sub = post.title?.trim() && body ? body : '';
  const author = (post.user ?? post.user_objectid)?.username;
  const when = shortTimeAgo(post.created_at);
  const byline = [author ? `@${author}` : null, when || null].filter(Boolean).join(' · ');

  return (
    <SummaryTouchable
      style={[styles.row, style]}
      onPress={(origin) => onPress?.(origin)}
      disabled={!onPress}
      activeOpacity={0.8}
      accessibilityLabel={lead}
    >
      {url ? (
        <View>
          <Image source={{ uri: url }} style={[styles.thumb, { backgroundColor: colors.segment }]} contentFit="cover" transition={120} />
          {isVideo ? (
            <View style={styles.play} pointerEvents="none">
              <Play size={12} color={COLOR_WHITE} fill={COLOR_WHITE} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: colors.segment }]}>
          <ImageIcon size={18} color={colors.grey} />
        </View>
      )}
      <View style={styles.rowText}>
        <Text style={[styles.lead, { color: colors.fg }]} numberOfLines={sub ? 1 : 2}>{lead}</Text>
        {sub ? <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{sub}</Text> : null}
        {byline ? <Text style={[styles.byline, { color: colors.grey }]} numberOfLines={1}>{byline}</Text> : null}
      </View>
    </SummaryTouchable>
  );
}

// ── A post opened from a list in a panel ─────────────────────────────────────

/**
 * A post's sheet, opened over the panel you're in.
 *
 * Returns `openPost` for the rows, and `stacked` to pass to the host panel's
 * SummaryModal as its `stacked` prop — rendered there and nowhere else, or iOS
 * won't present it (see SummaryModal's "Stacking"). Closing the sheet drops you
 * back on the list where you were. The useStackedUserSummary pattern, for posts.
 *
 * A host that is a screen rather than a panel (the posts map) has nothing to
 * stack on: it renders PostSummaryModal at its own level instead.
 *
 * @param hostVisible Whether the host panel is open. A post left open when it
 *   closes some other way is forgotten, so reopening the host doesn't bring it
 *   straight back up.
 */
export function useStackedPostSheet(hostVisible: boolean) {
  const [post, setPost] = useState<Post | null>(null);

  useEffect(() => { if (!hostVisible) setPost(null); }, [hostVisible]);

  const openPost = useCallback((p: Post) => setPost(p), []);
  const closePost = useCallback(() => setPost(null), []);

  const stacked = <PostSheet post={post} onClose={closePost} />;

  return { openPost, closePost, stacked };
}

// ── The place ────────────────────────────────────────────────────────────────

/** The place in the phone's maps app — Apple's on iOS, Google's elsewhere. */
function openInMaps(place: PostPlace) {
  const q = encodeURIComponent(place.name);
  const url = Platform.OS === 'ios'
    ? `https://maps.apple.com/?ll=${place.lat},${place.lng}&q=${q}`
    : `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}&query_place_id=${encodeURIComponent(place.place_id)}`;
  Linking.openURL(url).catch(() => {});
}

/**
 * Pages of a list, joined as they arrive — page 0 starts it again, any later
 * page adds what it doesn't already have. CarDetailScreen's, for one list.
 */
function useAccumulated(entries: Post[] | undefined, page: number): Post[] {
  const [all, setAll] = useState<Post[]>([]);
  useEffect(() => {
    if (!entries) return;
    setAll((prev) => {
      if (page === 0) return entries;
      const seen = new Set(prev.map((e) => e.internal_id));
      return [...prev, ...entries.filter((e) => !seen.has(e.internal_id))];
    });
  }, [entries, page]);
  return all;
}

/**
 * A place, and every post made there.
 *
 * Opened from the pin line on a post's card (PostPlaceLine). The place is what
 * the posts share, so it heads the panel — its name, its address, how many
 * posts — pinned while the list under it scrolls, with a small way out to the
 * phone's maps for directions.
 *
 * A row opens its post as a sheet over this panel (useStackedPostSheet), and
 * that post's own pin line goes quiet: it's this place, already open.
 */
export default function PlacePostsModal({ place, onClose, origin }: {
  /** The place to show; null while closed. */
  place: PostPlace | null;
  onClose: () => void;
  origin?: SummaryOrigin | null;
}) {
  const colors = useColors();

  // Kept through the close, so the panel fades out on its place rather than
  // emptying first.
  const last = useRef<PostPlace | null>(null);
  if (place) last.current = place;
  const shown = place ?? last.current;
  const visible = !!place;

  const [page, setPage] = useState(0);
  // Back to the first page for each place opened.
  useEffect(() => { if (place) setPage(0); }, [place?.place_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // `currentData`, not `data`: the latter holds the last place's page while the
  // next place's loads, and the list would open on the wrong posts.
  const { currentData, isFetching } = useGetPostsQuery(
    { place_id: shown?.place_id, page, limit: PAGE },
    { skip: !shown?.place_id },
  );
  const posts = useAccumulated(currentData?.entries, page);
  // Held while a later page loads, so "Load more" doesn't blink out under the tap.
  const totalRef = useRef(0);
  if (currentData) totalRef.current = currentData.total ?? currentData.entries.length;
  const total = Math.max(totalRef.current, posts.length);
  const isLoading = page === 0 && !currentData;

  const { openPost, stacked } = useStackedPostSheet(visible);

  const header = shown ? (
    <View style={styles.header}>
      <View style={styles.headTop}>
        <MapPin size={18} color={colors.fg} style={styles.headPin} />
        <View style={styles.headText}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={2}>{shown.name}</Text>
          {shown.address ? (
            <Text style={[styles.address, { color: colors.grey }]} numberOfLines={2}>{shown.address}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headMeta}>
        <Text style={[styles.count, { color: colors.grey }]}>
          {isLoading ? ' ' : `${total} ${total === 1 ? 'post' : 'posts'}`}
        </Text>
        <TouchableOpacity
          style={[styles.mapsBtn, { backgroundColor: colors.segment }]}
          onPress={() => openInMaps(shown)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open ${shown.name} in Maps`}
        >
          <Navigation size={12} color={colors.fg} />
          <Text style={[styles.mapsText, { color: colors.fg }]}>Open in Maps</Text>
        </TouchableOpacity>
      </View>
    </View>
  ) : null;

  return (
    <SummaryModal
      visible={visible}
      origin={origin}
      onClose={onClose}
      header={header}
      minHeightRatio={0.5}
      stacked={(
        <CurrentPlaceContext.Provider value={shown?.place_id ?? null}>
          {stacked}
        </CurrentPlaceContext.Provider>
      )}
    >
      <View style={styles.body}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.grey} />
        ) : posts.length === 0 ? (
          <Text style={[styles.empty, { color: colors.grey }]}>No posts here yet.</Text>
        ) : (
          // Mapped, not listed: SummaryModal brings its own scroller.
          posts.map((p, i) => (
            <PlacePostRow
              key={p.internal_id}
              post={p}
              onPress={() => openPost(p)}
              style={i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }}
            />
          ))
        )}

        {!isLoading && posts.length > 0 && posts.length < total ? (
          <TouchableOpacity
            style={[styles.more, { backgroundColor: colors.segment }]}
            onPress={() => setPage((p) => p + 1)}
            disabled={isFetching}
            activeOpacity={0.8}
          >
            {isFetching
              ? <ActivityIndicator size="small" color={colors.fg} />
              : <Text style={[styles.moreText, { color: colors.fg }]}>Load more ({total - posts.length})</Text>}
          </TouchableOpacity>
        ) : null}
      </View>
    </SummaryModal>
  );
}

const styles = StyleSheet.create({
  header:   { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 10 },
  headTop:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // Down a touch, onto the name's first line rather than above it.
  headPin:  { marginTop: 3 },
  headText: { flex: 1, minWidth: 0 },
  name:     { fontSize: 19, fontFamily: FONT_INTER.bold },
  address:  { fontSize: 13, marginTop: 2 },
  headMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  count:    { fontSize: 13, fontFamily: FONT_INTER.semibold },
  mapsBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: PILL_RADIUS,
  },
  mapsText: { fontSize: 12, fontFamily: FONT_INTER.semibold },

  body:     { paddingHorizontal: 16, paddingBottom: 16 },
  loader:   { marginVertical: 30 },
  empty:    { fontSize: 14, paddingVertical: 24, textAlign: 'center' },
  more:     {
    alignSelf: 'center', marginTop: 14, minWidth: 160, alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: PILL_RADIUS,
  },
  moreText: { fontSize: 13.5, fontFamily: FONT_INTER.semibold },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  thumb:    { width: THUMB, height: THUMB, borderRadius: 8 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  play: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:  { flex: 1, minWidth: 0, gap: 2 },
  lead:     { fontSize: 14, fontFamily: FONT_INTER.semibold },
  sub:      { fontSize: 13 },
  byline:   { fontSize: 12 },
});
