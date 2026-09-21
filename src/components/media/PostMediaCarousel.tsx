import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Pressable,
  type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { NavigationContext } from '@react-navigation/native';
import Svg, { Polygon } from 'react-native-svg';
import VideoLightbox from '../ui/VideoLightbox';
import { clampMediaRatio, DEFAULT_MEDIA_RATIO, type PostMedia } from '../../utils/postMedia';

/**
 * A post's photos and videos in one swipeable strip.
 *
 * ## One shape for the whole strip
 *
 * Every slide is drawn at the same aspect ratio, taken from the first item and
 * clamped to something usable. Sizing each slide to its own photo is what made
 * the gallery lurch: a tall portrait followed by a landscape changed the height
 * of the media by hundreds of points mid-swipe, dragging the caption, the like
 * button and everything below it up the screen while the thumb was still
 * moving. Fixing the box means the only thing that moves during a swipe is the
 * photo, which is the thing being swiped.
 *
 * Slides are covered rather than fitted, so a photo that isn't the strip's
 * shape fills it and crops instead of sitting in letterbox bars. That's the
 * right trade in a feed — the alternative shows more of the photo but makes
 * every post a different, mostly-empty height.
 *
 * ## Videos play full screen, not in the strip
 *
 * A video slide is only ever its poster frame. Tapping it opens VideoLightbox,
 * which owns the player — the strip's shape came from a photo, and a video
 * fitted into it played as a sliver between black bars. It also means the
 * strip holds no player of its own: nothing decodes for a post nobody has
 * chosen to watch, however many videos are in the feed.
 */
export default function PostMediaCarousel({
  media,
  onPressItem,
  overlay,
  showPageIndicator = true,
  visible,
  ratio: fixedRatio,
  videoOpensItem = false,
}: {
  media: PostMedia[];
  /**
   * A tap on a photo. Videos handle their own tap — it opens the full-screen
   * viewer rather than leaving the post — unless `videoOpensItem` says otherwise.
   */
  onPressItem?: (index: number) => void;
  /** Badges and counters drawn over the media, in the strip's own box. */
  overlay?: React.ReactNode;
  showPageIndicator?: boolean;
  /**
   * Whether the post this belongs to is on screen.
   *
   * Going false closes the video viewer if this post had it open — the list
   * underneath can move without a scroll (a refresh, a deep link), and the
   * viewer shouldn't outlive the card it was opened from. Undefined means the
   * surface isn't tracking visibility (a detail screen, say), and the viewer
   * is left alone.
   */
  visible?: boolean;
  /**
   * Draw the strip at this shape instead of the lead item's.
   *
   * For tiles in a row — a shelf of posts where every card has to be the same
   * height, so letting each one take its photo's shape would make the row
   * ragged. Left unset, the strip measures its first item as described above.
   */
  ratio?: number;
  /**
   * A tap on a video opens the post instead of the viewer.
   *
   * For a tile in a shelf — the row of posts on a profile, where the card is a
   * way into the post and a tap that played the video instead would be
   * skipping the thing you were trying to open. The poster frame and its play
   * badge still say there's a video; the post is where you watch it.
   */
  videoOpensItem?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [measuredRatio, setRatio] = useState(DEFAULT_MEDIA_RATIO);
  const ratio = fixedRatio ?? measuredRatio;
  const [active, setActive] = useState(0);
  /** The video open in the full-screen viewer. Null when it's closed. */
  const [watchingId, setWatchingId] = useState<string | null>(null);
  const ratioLocked = useRef(false);

  /**
   * The strip's shape, decided once by whichever item leads it.
   *
   * Locked after the first measurement so a later slide loading can't resize
   * the strip out from under a swipe — which would be the same lurch, only
   * arriving unpredictably.
   */
  const lockRatio = useCallback((w: number, h: number) => {
    if (ratioLocked.current || !w || !h) return;
    ratioLocked.current = true;
    setRatio(clampMediaRatio(w / h));
  }, []);

  const closeViewer = useCallback(() => setWatchingId(null), []);

  // The card left the list's viewport while the viewer was up. See `visible`.
  useEffect(() => {
    if (visible === false) closeViewer();
  }, [visible, closeViewer]);

  /**
   * Left the screen entirely: same close.
   *
   * The viewer is a Modal, which draws over the whole app rather than over this
   * screen. Nothing inside it navigates, but a notification tap or a deep link
   * can — and the viewer would then be sitting on top of wherever that went.
   *
   * Read from the context rather than `useNavigation`, which throws outside a
   * navigator; a carousel with no screen around it just has nothing to hear.
   */
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!navigation) return undefined;
    return navigation.addListener('blur', closeViewer);
  }, [navigation, closeViewer]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    setActive(Math.round(e.nativeEvent.contentOffset.x / width));
  }, [width]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const renderItem = useCallback(({ item, index }: { item: PostMedia; index: number }) => {
    const slide = { width, height: '100%' as const };

    if (item.kind === 'image') {
      return (
        <TouchableOpacity
          style={slide}
          onPress={onPressItem ? () => onPressItem(index) : undefined}
          activeOpacity={onPressItem ? 0.95 : 1}
          disabled={!onPressItem}
        >
          <Image
            source={{ uri: item.url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onLoad={index === 0 ? (e) => lockRatio(e.source.width, e.source.height) : undefined}
          />
        </TouchableOpacity>
      );
    }

    return (
      <Pressable
        style={slide}
        onPress={() => {
          if (videoOpensItem) return onPressItem?.(index);
          if (item.status === 'ready' && item.videoId) setWatchingId(item.videoId);
        }}
        accessibilityRole="button"
        accessibilityLabel={
          videoOpensItem ? 'Open post'
          : item.status === 'ready' ? 'Play video'
          : 'Video still processing'
        }
      >
        {item.poster ? (
          <Image
            source={{ uri: item.poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            onLoad={index === 0 ? (e) => lockRatio(e.source.width, e.source.height) : undefined}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.processingBg]} />
        )}

        <View style={styles.playOverlay}>
          {item.status === 'ready' ? (
            <View style={styles.playCircle}>
              {/* Nudged right by an eighth of its width. A triangle's mass sits
                  toward its base, so centring it geometrically leaves it
                  looking like it has drifted left inside the circle. */}
              <Svg width={22} height={22} viewBox="0 0 22 22" style={styles.playGlyph}>
                <Polygon points="6,3 19,11 6,19" fill="#FFFFFF" />
              </Svg>
            </View>
          ) : (
            <View style={styles.processingPill}>
              <Text style={styles.processingText}>Processing…</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  }, [width, onPressItem, lockRatio, videoOpensItem]);

  const keyExtractor = useCallback((item: PostMedia) => item.key, []);
  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({ length: width, offset: width * index, index }),
    [width],
  );

  const dots = useMemo(() => media.map((m) => m.key), [media]);

  if (media.length === 0) return null;

  return (
    <View style={[styles.wrap, { aspectRatio: ratio }]} onLayout={onLayout}>
      {/* Nothing can be laid out until the strip has been measured — a
          paging list needs its page width, and that's the width of this box. */}
      {width > 0 && (
        media.length === 1 ? (
          <View style={StyleSheet.absoluteFill}>{renderItem({ item: media[0], index: 0 })}</View>
        ) : (
          <FlatList
            data={media}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={StyleSheet.absoluteFill}
            getItemLayout={getItemLayout}
            onMomentumScrollEnd={onMomentumEnd}
          />
        )
      )}

      {overlay}

      {showPageIndicator && media.length > 1 && (
        <View style={styles.dots} pointerEvents="none">
          {dots.map((key, i) => (
            <View key={key} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}

      <VideoLightbox videoId={watchingId} onClose={closeViewer} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:        { width: '100%', overflow: 'hidden', position: 'relative', backgroundColor: '#000' },
  playOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  playCircle:  {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
  playGlyph:   { marginLeft: 3 },
  processingBg:   { backgroundColor: '#1A1A1A' },
  processingPill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  processingText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  dots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
  },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: '#FFFFFF' },
});
