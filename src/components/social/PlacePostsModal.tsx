import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Platform,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '@ors/kit';
import { Image } from '../ui/AppImage';
import { MapPin, Navigation, Play, Image as ImageIcon } from 'lucide-react-native';
import SummaryModal, { SummaryTouchable, useSummaryPanel, type SummaryOrigin } from '../ui/SummaryModal';
import Avatar from '../ui/Avatar';
import { PostSheet } from './PostSummaryModal';
import { CurrentPlaceContext } from './PostPlaceLine';
import { useGetPostsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { postThumb } from '../../utils/postMedia';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import { stripHtml } from '../../utils/text';
import type { Post, PostPlace } from '../../types/api';
import { COLOR_WHITE, COMMON_RADIUS, PILL_RADIUS, SURFACE_MID } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import PanelEmpty from '../ui/PanelEmpty';

/** How many posts each page of a place's list brings. */
const PAGE = 20;
/** A row's thumbnail edge. */
const THUMB = 76;
/** The author's photo beside their name. */
const AUTHOR_AVATAR = 18;

// ── One post, compact ────────────────────────────────────────────────────────

/**
 * One post as a short row: its first picture, then who and when over its words.
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
  const authorUser = post.user ?? post.user_objectid;
  const author = authorUser?.username;
  const when = shortTimeAgo(post.created_at);

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
        {/* Who, with their photo, and when beside the name — over the words. */}
        {author || when ? (
          <View style={styles.byline}>
            {author ? (
              <>
                <Avatar user={authorUser} size={AUTHOR_AVATAR} edge={false} />
                <Text style={[styles.authorName, { color: COLOR_WHITE }]} numberOfLines={1}>{author}</Text>
              </>
            ) : null}
            {when ? <Text style={[styles.when, { color: colors.greyDark }]}>{when}</Text> : null}
          </View>
        ) : null}
        <Text style={[styles.lead, { color: colors.fg }]} numberOfLines={sub ? 1 : 2}>{lead}</Text>
        {sub ? <Text style={[styles.sub, { color: colors.muted }]} numberOfLines={1}>{sub}</Text> : null}
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

/** Country names left off the end of an address — it's understood. */
const HOME_COUNTRIES = new Set(['usa', 'us', 'united states', 'united states of america']);

/**
 * An address as it's written on an envelope: the street on one line, the
 * city, state and postcode on the next — rather than one long run of commas.
 * The place's own name is dropped if the address leads with it (the title
 * already says it), and so is a home country at the end.
 */
function addressLines(address: string, name: string): string[] {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length && parts[0].toLowerCase() === name.trim().toLowerCase()) parts.shift();
  if (parts.length > 1 && HOME_COUNTRIES.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  if (parts.length <= 1) return parts;
  return [parts[0], parts.slice(1).join(', ')];
}

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

  // The place in a dark grey card of its own, over the list.
  const header = shown ? (
    <View style={styles.header}>
      <View style={styles.headCard}>
        <MapPin size={24} color={colors.fg} style={styles.headPin} />
        <View style={styles.headText}>
          <Text style={[styles.name, { color: colors.fg }]} numberOfLines={2}>{shown.name}</Text>
          {shown.address ? (
            <View style={styles.addressBlock}>
              {addressLines(shown.address, shown.name).map((line, i) => (
                <Text key={i} style={[styles.address, { color: colors.grey }]} numberOfLines={1}>{line}</Text>
              ))}
            </View>
          ) : null}
        </View>
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
      {shown ? <MapsFooter place={shown} /> : null}
      <View style={styles.body}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={colors.grey} />
        ) : posts.length === 0 ? (
          <PanelEmpty>No posts here yet</PanelEmpty>
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

/**
 * "Open in Maps", pinned to the panel's bottom-right corner over the list —
 * the way out for directions, in reach however far down you've scrolled.
 */
function MapsFooter({ place }: { place: PostPlace }) {
  const panel = useSummaryPanel();
  const colors = useColors();
  useLayoutEffect(() => {
    panel?.setFooter(
      <View style={styles.footer} pointerEvents="box-none">
        <TouchableOpacity
          style={[styles.mapsBtn, { backgroundColor: SURFACE_MID }]}
          onPress={() => openInMaps(place)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Open ${place.name} in Maps`}
        >
          <Navigation size={14} color={colors.fg} />
          <Text style={[styles.mapsText, { color: colors.fg }]}>Open in Maps</Text>
        </TouchableOpacity>
      </View>,
    );
  });
  useLayoutEffect(() => () => panel?.setFooter(null), [panel]);
  return null;
}

const styles = StyleSheet.create({
  header:   { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 6 },
  headCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: 14, borderRadius: COMMON_RADIUS, backgroundColor: SURFACE_MID,
  },
  // Level with the name's first line.
  headPin:  { marginTop: 0 },
  headText: { flex: 1, minWidth: 0 },
  name:     { fontSize: 19, fontFamily: FONT_INTER.bold },
  // Narrower than the card, so it reads as a block of address lines.
  addressBlock: { marginTop: 4, maxWidth: '80%', gap: 1 },
  address:  { fontSize: 13, lineHeight: 18 },
  // Bottom-right of the panel, the list passing under it.
  footer:   { alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  mapsBtn:  {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: PILL_RADIUS,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  mapsText: { fontSize: 13, fontFamily: FONT_INTER.semibold },

  body:     { paddingHorizontal: 16, paddingBottom: 16 },
  loader:   { marginVertical: 30 },
  more:     {
    alignSelf: 'center', marginTop: 14, minWidth: 160, alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: PILL_RADIUS,
  },
  moreText: { fontSize: 13.5, fontFamily: FONT_INTER.semibold },

  row:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  thumb:    { width: THUMB, height: THUMB, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  play: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText:  { flex: 1, minWidth: 0, gap: 4 },
  // Photo, name, then when — one line.
  byline:   { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  authorName: { fontSize: 12, fontFamily: FONT_INTER.semibold, flexShrink: 1 },
  when:     { fontSize: 12, flexShrink: 0 },
  lead:     { fontSize: 14, fontFamily: FONT_INTER.semibold },
  sub:      { fontSize: 13 },
});
