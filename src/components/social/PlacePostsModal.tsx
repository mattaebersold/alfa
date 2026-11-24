import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, StyleSheet, ActivityIndicator, TouchableOpacity, Linking, Platform,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { Play, Image as ImageIcon } from 'lucide-react-native';
import { AppleMaps, GoogleMaps } from 'expo-maps';
import SummaryModal, { SummaryTouchable, type SummaryOrigin } from '../ui/SummaryModal';
import PostStrip from './PostStrip';
import Avatar from '../ui/Avatar';
import { PostSheet } from './PostSummaryModal';
import { CurrentPlaceContext } from './PostPlaceLine';
import { useGetPostsQuery } from '../../api/apiService';
import { useColors } from '../../hooks/useColors';
import { postThumb } from '../../utils/postMedia';
import { shortTimeAgo } from '../../utils/shortTimeAgo';
import { stripHtml } from '../../utils/text';
import type { Post, PostPlace } from '../../types/api';
import { COLOR_WHITE, COMMON_RADIUS, PILL_RADIUS } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import PanelEmpty from '../ui/PanelEmpty';

/** How many of the place's latest posts the slider holds. */
const RECENT = 12;
/**
 * The map's height at the panel's head — tall enough that the map and one
 * row of cards fill the summary panel's 400pt floor (SummaryModal's
 * MIN_PANEL_H), so there's no empty room left under the cards.
 */
const MAP_H = 264;
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
 * A place, and the posts made there.
 *
 * Opened from the pin line on a post's card (PostPlaceLine). A map leads it,
 * centred and pinned on the place, with the place's name and address on a
 * see-through banner across its foot and "Open in Maps" there too — tap the
 * map or the button for directions. Under it, the latest posts made there,
 * sideways (PostStrip).
 *
 * A post opens as a sheet over this panel (useStackedPostSheet), and that
 * post's own pin line goes quiet: it's this place, already open.
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

  // `currentData`, not `data`: the latter holds the last place's posts while
  // the next place's load, and the slider would open on the wrong ones.
  const { currentData } = useGetPostsQuery(
    { place_id: shown?.place_id, page: 0, limit: RECENT },
    { skip: !shown?.place_id },
  );
  const posts = currentData?.entries ?? [];
  const isLoading = !currentData;

  const { openPost, stacked } = useStackedPostSheet(visible);

  const header = shown ? <PlaceMap place={shown} /> : null;

  return (
    <SummaryModal
      visible={visible}
      origin={origin}
      onClose={onClose}
      header={header}
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
          <PanelEmpty>No posts here yet</PanelEmpty>
        ) : (
          // Every post it has here, so no "View all".
          // No heading: the map says what these are.
          <PostStrip
            posts={posts}
            total={posts.length}
            // No name or time under each card; the author's photo sits on it.
            showByline={false}
            showTime={false}
            avatarOnImage
            onPostPress={openPost}
            onViewAll={() => {}}
          />
        )}
      </View>
    </SummaryModal>
  );
}

/**
 * The place on a map, centred and pinned on it — a still picture: touches go
 * to the press over it (the maps app), not to panning inside a scrolling
 * panel. Its name and address sit on a see-through banner across the foot,
 * with "Open in Maps" at its end.
 */
function PlaceMap({ place }: { place: PostPlace }) {
  const camera = { coordinates: { latitude: place.lat, longitude: place.lng }, zoom: 15 };
  const lines = place.address ? addressLines(place.address, place.name) : [];
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.map}
        onPress={() => openInMaps(place)}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`Open ${place.name} in Maps`}
      >
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Platform.OS === 'ios' ? (
            <AppleMaps.View
              style={StyleSheet.absoluteFill}
              cameraPosition={camera}
              markers={[{ id: 'place', coordinates: camera.coordinates }] as any}
              uiSettings={{ compassEnabled: false, scaleBarEnabled: false, myLocationButtonEnabled: false, togglePitchEnabled: false }}
            />
          ) : (
            <GoogleMaps.View
              style={StyleSheet.absoluteFill}
              cameraPosition={camera}
              markers={[{ id: 'place', coordinates: camera.coordinates }] as any}
              uiSettings={{ zoomControlsEnabled: false, mapToolbarEnabled: false, scrollGesturesEnabled: false, zoomGesturesEnabled: false, rotationGesturesEnabled: false, tiltGesturesEnabled: false, compassEnabled: false, myLocationButtonEnabled: false }}
            />
          )}
        </View>
        {/* Name and address, over the map's foot. */}
        <View style={styles.banner}>
          <View style={styles.bannerText}>
            <Text style={styles.name} numberOfLines={1}>{place.name}</Text>
            {lines.map((line, i) => (
              <Text key={i} style={styles.address} numberOfLines={1}>{line}</Text>
            ))}
          </View>
          <TouchableOpacity
            style={styles.mapsBtn}
            onPress={() => openInMaps(place)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Open ${place.name} in Maps`}
          >
            <Text style={styles.mapsText}>Open in Maps</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // The map runs edge to edge across the panel's top.
  header:   {},
  // Rounded at its foot only; the panel's own corners shape the top.
  map:      { height: MAP_H, borderBottomLeftRadius: COMMON_RADIUS, borderBottomRightRadius: COMMON_RADIUS, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' },
  // See-through, across the map's foot.
  banner:   {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  bannerText: { flex: 1, minWidth: 0 },
  name:     { fontSize: 15, fontFamily: FONT_INTER.bold, color: COLOR_WHITE },
  address:  { fontSize: 12, lineHeight: 16, color: 'rgba(255,255,255,0.75)' },
  mapsBtn:  {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: PILL_RADIUS,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  mapsText: { fontSize: 12.5, fontFamily: FONT_INTER.semibold, color: COLOR_WHITE },

  // The slider runs edge to edge; it brings its own inset.
  // A short gap under the map before the cards.
  body:     { paddingTop: 12, paddingBottom: 14 },
  loader:   { marginVertical: 30 },

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
