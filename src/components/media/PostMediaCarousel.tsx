import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, Pressable,
  type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { NavigationContext } from '@react-navigation/native';
import Svg, { Polygon } from 'react-native-svg';
import {
  clampMediaRatio, muxStreamUrl, DEFAULT_MEDIA_RATIO, type PostMedia,
} from '../../utils/postMedia';

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
 * ## One player for the whole strip
 *
 * A carousel of five videos is still one player, retargeted as you go. Video
 * players are expensive and the platform limits how many can decode at once, so
 * mounting one per slide costs memory for streams nobody is watching and risks
 * the later ones silently refusing to play. Only the slide being watched holds
 * the player; the rest show their poster frame.
 *
 * Swiping away pauses. Audio continuing from a video that's no longer on screen
 * is disorienting, and it's the reason you'd have to scroll back to find what's
 * making noise.
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
   * A tap on a photo, or on a video that's already playing. Videos handle their
   * own first tap — that one starts playback rather than leaving the post.
   */
  onPressItem?: (index: number) => void;
  /** Badges and counters drawn over the media, in the strip's own box. */
  overlay?: React.ReactNode;
  showPageIndicator?: boolean;
  /**
   * Whether the post this belongs to is on screen.
   *
   * A video keeps playing after you scroll past it otherwise — audible from
   * nowhere, and holding a decoder open for a post nobody is looking at.
   * Undefined means the surface isn't tracking visibility (a detail screen,
   * say), and playback is left alone.
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
   * A tap on a video opens the post instead of starting it.
   *
   * For a tile too small to watch in — the shelf of posts on a profile, where
   * a video that started playing in a 168pt card would be showing you the
   * thing you were trying to open. The poster frame and its play badge still
   * say there's a video; the post is where you watch it.
   */
  videoOpensItem?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [measuredRatio, setRatio] = useState(DEFAULT_MEDIA_RATIO);
  const ratio = fixedRatio ?? measuredRatio;
  const [active, setActive] = useState(0);
  /** The item currently holding the player. Null when nothing is playing. */
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const ratioLocked = useRef(false);

  const player = useVideoPlayer(null, (p) => {
    p.loop = false;
  });

  /**
   * Whether the player is actually playing, as opposed to merely being the
   * slide in front of you. Paging is locked while it is — a video's scrubber
   * wants the same horizontal drag the carousel does, and a nudge sideways
   * while seeking would page away from what you were watching. Pausing hands
   * the drag back, so the lock can't strand anyone on a slide.
   */
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });

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

  const stop = useCallback(() => {
    player.pause();
    setPlayingKey(null);
  }, [player]);

  // Scrolled out of the feed: stop, and drop back to the poster. Deliberately
  // a pause rather than a mute — coming back to a video that silently ran on
  // without you is worse than coming back to where you left it.
  useEffect(() => {
    if (visible === false && playingKey) stop();
  }, [visible, playingKey, stop]);

  /**
   * Left the screen entirely: same stop.
   *
   * Visibility only knows about scrolling. Pushing a screen on top keeps this
   * one mounted underneath, so a video started here would carry on playing
   * behind whatever you opened — the post's detail, someone's profile — with
   * nothing on screen to pause it from.
   *
   * Read from the context rather than `useNavigation`, which throws outside a
   * navigator; a carousel with no screen around it just has nothing to hear.
   */
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    if (!navigation) return undefined;
    return navigation.addListener('blur', () => {
      player.pause();
      setPlayingKey(null);
    });
  }, [navigation, player]);

  const playVideo = useCallback((item: Extract<PostMedia, { kind: 'video' }>) => {
    if (!item.videoId) return;
    player.replace(muxStreamUrl(item.videoId));
    player.play();
    setPlayingKey(item.key);
  }, [player]);

  const onMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!width) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next === active) return;
    setActive(next);
    if (playingKey) stop();
  }, [width, active, playingKey, stop]);

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

    const isPlaying = playingKey === item.key;

    if (isPlaying) {
      return (
        <View style={slide}>
          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            // Contain, not cover: the strip's shape came from a photo, and
            // cropping someone's video to match it would cut the subject out.
            contentFit="contain"
            nativeControls
          />
        </View>
      );
    }

    return (
      <Pressable
        style={slide}
        onPress={() => {
          if (videoOpensItem) return onPressItem?.(index);
          if (item.status === 'ready') playVideo(item);
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
  }, [width, onPressItem, lockRatio, playingKey, player, playVideo, videoOpensItem]);

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
            scrollEnabled={!isPlaying}
          />
        )
      )}

      {overlay}

      {/* Not while a video holds the slide: the player's own controls sit
          along the bottom edge, and the dots would land on its scrubber. */}
      {showPageIndicator && media.length > 1 && !playingKey && (
        <View style={styles.dots} pointerEvents="none">
          {dots.map((key, i) => (
            <View key={key} style={[styles.dot, i === active && styles.dotActive]} />
          ))}
        </View>
      )}
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
