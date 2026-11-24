import React, { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Text } from '../../theme/Text';
import { Image } from '../ui/AppImage';
import { useGetCurrentHomeMessageQuery, useDismissHomeMessageMutation } from '../../api/apiService';
import { useAppSelector } from '../../store/store';
import { headerOffset } from '../../hooks/useHeaderScroll';
import { imageUrl } from '../../utils/image';
import { COLOR_BLACK, COLOR_WHITE, COMMON_RADIUS, GUTTER } from '../../constants/config';
import { FONT_INTER } from '../../constants/fonts';
import HomeMessageViewer, { messageFrom, bannerFrom } from './HomeMessageViewer';
import type { HomeMessage } from '../../types/api';

/** The banner's own height. */
export const HOME_MESSAGE_BANNER_H = 78;
/** Room under it, before the tabs. */
const BANNER_GAP = 8;
/** What the banner adds to the header when it shows — its height and the room under it. */
export const HOME_MESSAGE_INSET = HOME_MESSAGE_BANNER_H + BANNER_GAP;

/**
 * The current home message, if there's one to show — shared by everything
 * that has to make room for the banner (the header, the home panes' padding),
 * since RTK Query answers every caller from the one cached request.
 */
export function useCurrentHomeMessage(enabled = true): HomeMessage | null {
  const { isLoggedIn } = useAppSelector((s) => s.auth);
  const { data } = useGetCurrentHomeMessageQuery(undefined, {
    skip: !enabled || !isLoggedIn,
    // A new message reaches someone with the app open when they come back to it.
    refetchOnFocus: true,
    refetchOnReconnect: true,
  });
  const message = data?.message ?? null;
  return message?.playback_id ? message : null;
}

/**
 * How far the banner has collapsed, 0 (open) to HOME_MESSAGE_INSET (gone).
 * The home screen drives it — the feed's scroll, and fully collapsed on any
 * other tab — and the header's tab row and ground close up by the same
 * amount. Used on the native driver alongside `headerOffset`.
 */
export const homeMessageCollapse = new Animated.Value(HOME_MESSAGE_INSET);

/** The collapse, negated and held to [−inset, 0] — what the rows under the banner move up by. */
export function collapseLift(inset: number): Animated.AnimatedInterpolation<number> {
  return homeMessageCollapse.interpolate({
    inputRange: [0, Math.max(1, inset)],
    outputRange: [0, -inset],
    extrapolate: 'clamp',
  });
}

/** How much the banner adds to the header when it shows: its inset, or 0. */
export function useHomeMessageInset(enabled = true): number {
  return useCurrentHomeMessage(enabled) ? HOME_MESSAGE_INSET : 0;
}

/**
 * A video message from ORS, between the home header's buttons and its tabs,
 * until the member dismisses it, in a thin grey frame like the Pro video
 * cards. Its image behind, darkened; "Message from Matt", the title and
 * description over it, in white and regular weight; a play button — a rounded
 * white triangle on black — beside them. A tap anywhere but Dismiss opens the
 * video full screen. Watching doesn't close it — only Dismiss does, and
 * that's for this message: the next one shows again.
 *
 * The home feed only, and only at its top: it collapses as the feed scrolls
 * (homeMessageCollapse, driven by the home screen), sliding up and fading out
 * while the tabs close up under the header's buttons, and doesn't come back
 * mid-feed when the header does — only at the top again.
 */
export default function HomeMessageBanner({ top, fadeOver }: {
  /** Where it sits: under the header's buttons. */
  top: number;
  /** How far the header travels before the banner is fully faded — its buttons' height and its own. */
  fadeOver: number;
}) {
  const message = useCurrentHomeMessage();
  const [dismiss] = useDismissHomeMessageMutation();
  const [watching, setWatching] = useState<HomeMessage | null>(null);
  const open = useBannerOpen();

  if (!message) {
    // The viewer stays up if the banner goes (dismissed elsewhere) mid-watch.
    return watching ? <HomeMessageViewer message={watching} onClose={() => setWatching(null)} /> : null;
  }

  // Out with the buttons over the same stretch they take, so the banner and
  // the row above it leave as one.
  const headerFade = headerOffset.interpolate({ inputRange: [-fadeOver, 0], outputRange: [0, 1], extrapolate: 'clamp' });
  const collapseFade = homeMessageCollapse.interpolate({
    inputRange: [0, HOME_MESSAGE_INSET * 0.7],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const fade = Animated.multiply(headerFade, collapseFade);
  const lift = Animated.add(headerOffset, collapseLift(HOME_MESSAGE_INSET));

  const bg = imageUrl(message.image, 'medium');

  return (
    <>
      <Animated.View
        style={[styles.wrap, { top, opacity: fade, transform: [{ translateY: lift }] }]}
        // Collapsed, it's invisible — and mustn't catch taps meant for the tabs.
        pointerEvents={open ? 'auto' : 'none'}
      >
        <Pressable
          style={styles.banner}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWatching(message); }}
          accessibilityRole="button"
          accessibilityLabel={`${messageFrom(message)}: ${message.title}. Play video`}
        >
          {bg ? <Image source={{ uri: bg }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          {/* Dark from the left, where the words are, easing off toward the play button. */}
          <LinearGradient
            colors={['rgba(0,0,0,0.86)', 'rgba(0,0,0,0.62)', 'rgba(0,0,0,0.35)']}
            locations={[0, 0.6, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.play}>
            {/* A triangle with its corners rounded off — stroked in its own
                colour with round joins. */}
            <Svg width={18} height={18} viewBox="0 0 22 22" style={styles.playGlyph}>
              <Polygon points="7,4.5 18,11 7,17.5" fill={COLOR_WHITE} stroke={COLOR_WHITE} strokeWidth={3} strokeLinejoin="round" />
            </Svg>
          </View>

          <View style={styles.words}>
            <Text style={styles.from} numberOfLines={1}>
              {bannerFrom(message)}
            </Text>
            <Text style={styles.title} numberOfLines={1}>{message.title}</Text>
            {message.description ? (
              <Text style={styles.description} numberOfLines={1}>{message.description}</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.dismiss}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); dismiss(message.internal_id); }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Dismiss message"
          >
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>
        </Pressable>
      </Animated.View>

      <HomeMessageViewer message={watching} onClose={() => setWatching(null)} />
    </>
  );
}

/** Whether the banner is out far enough to tap — mostly uncollapsed, header showing. */
function useBannerOpen(): boolean {
  // Starts collapsed (homeMessageCollapse's first value) until the feed opens it.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let collapse = HOME_MESSAGE_INSET;
    let offset = 0;
    const update = () => setOpen(collapse < HOME_MESSAGE_INSET / 2 && offset > -HOME_MESSAGE_BANNER_H / 2);
    const a = homeMessageCollapse.addListener(({ value }) => { collapse = value; update(); });
    const b = headerOffset.addListener(({ value }) => { offset = value; update(); });
    return () => { homeMessageCollapse.removeListener(a); headerOffset.removeListener(b); };
  }, []);
  return open;
}

const styles = StyleSheet.create({
  // Over the header's ground and under nothing — level with the buttons' row.
  wrap: { position: 'absolute', left: GUTTER, right: GUTTER, height: HOME_MESSAGE_BANNER_H, zIndex: 20 },
  banner: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
    // Room on the right for Dismiss, centred down that side.
    paddingLeft: 12, paddingRight: 84,
    borderRadius: COMMON_RADIUS,
    // The Pro video cards' frame.
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden', backgroundColor: COLOR_BLACK,
  },
  play: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  playGlyph: { marginLeft: 3 },
  words: { flex: 1, minWidth: 0, gap: 2 },
  from: { color: COLOR_WHITE, fontSize: 12.5, fontFamily: FONT_INTER.regular },
  title: { color: COLOR_WHITE, fontSize: 15, lineHeight: 19, fontFamily: FONT_INTER.regular },
  description: { color: 'rgba(255,255,255,0.8)', fontSize: 12.5, lineHeight: 16, fontFamily: FONT_INTER.medium },
  dismiss: {
    // Centred down the banner's right side.
    position: 'absolute', right: 10, top: (HOME_MESSAGE_BANNER_H - 2 - 22) / 2,
    height: 22, paddingHorizontal: 9, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  dismissText: { color: COLOR_WHITE, fontSize: 11.5, fontFamily: FONT_INTER.semibold },
});
