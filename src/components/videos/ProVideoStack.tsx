import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Animated, { useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import ProVideoCard, { CARD_PEEK } from './ProVideoCard';
import type { ProVideo } from '../../types/proVideos';
import type { ProVideoUpload } from '../../utils/proVideoUpload';
import { GUTTER } from '../../constants/config';

/** Every card's shape, width over height — 3:4, a portrait frame. */
const CARD_ASPECT = 3 / 4;
/** How the deck eases when a card opens. */
const EASE = { duration: 280, easing: Easing.bezier(0.2, 0.8, 0.2, 1) };
/** How far from the end the next page is asked for. */
const END_REACHED_PX = 600;

/**
 * Where card `i` sits in the deck, with card `open` showing whole: each
 * card under the one before, its strip a peek lower; from `open` on, the
 * cards drop by a card less a strip, so `open` clears the one above it.
 */
const topOf = (i: number, open: number, h: number) => i * CARD_PEEK + (open > 0 && i >= open ? h - CARD_PEEK : 0);
/** The deck's height with card `open` showing whole. */
const deckHeight = (n: number, open: number, h: number) =>
  n ? h + (n - 1) * CARD_PEEK + (open > 0 ? h - CARD_PEEK : 0) : 0;

/**
 * Pro videos as a deck. Every card is 3:4, its poster covering it. The first
 * shows whole; each after it is tucked under the one before, only its title
 * strip showing — darkened over the picture so the title reads.
 *
 * Tap a strip and that card opens: it and the cards after it slide down so it
 * shows whole, with a play button. Tap a card that's showing whole (the top
 * one, or the one just opened) and it plays.
 *
 * A plain scroll under the filters — the deck is laid out in the page, not
 * driven by the scroll, so nothing slides over the filters.
 */
export default function ProVideoStack({
  videos, header, footer, empty, paddingTop, paddingBottom, onScroll, onEndReached,
  refreshControl, onOpen, uploads, canRetry, onRetry, onCancel, onDelete,
}: {
  videos: ProVideo[];
  header: React.ReactElement;
  footer?: React.ReactElement | null;
  empty?: React.ReactElement | null;
  /** Kept for callers; the deck no longer needs it. */
  headerHeight?: number;
  paddingTop: number;
  paddingBottom: number;
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onEndReached?: () => void;
  refreshControl?: React.ReactElement<any>;
  onOpen: (v: ProVideo) => void;
  uploads?: Map<string, ProVideoUpload>;
  canRetry?: (v: ProVideo) => boolean;
  onRetry?: (v: ProVideo) => void;
  onCancel?: (v: ProVideo) => void;
  onDelete?: (v: ProVideo) => void;
}) {
  const { width } = useWindowDimensions();
  const cardW = width - (GUTTER + 4) * 2;
  const cardH = Math.round(cardW / CARD_ASPECT);
  /** The card showing whole besides the top one; 0 means just the top one. */
  const [open, setOpen] = useState(0);
  const n = videos.length;
  // A new list (a search, a sort) starts closed.
  useEffect(() => { setOpen(0); }, [videos.length, videos[0]?.internal_id]);

  const onPressCard = useCallback((i: number, v: ProVideo) => {
    if (i === 0 || i === open) onOpen(v);
    else setOpen(i);
  }, [open, onOpen]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    onScroll?.(e);
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    if (onEndReached && contentOffset.y + layoutMeasurement.height >= contentSize.height - END_REACHED_PX) onEndReached();
  }, [onScroll, onEndReached]);

  const deckStyle = useAnimatedStyle(() => ({ height: withTiming(deckHeight(n, open, cardH), EASE) }), [n, open, cardH]);

  return (
    <Animated.ScrollView
      onScroll={handleScroll}
      scrollEventThrottle={16}
      refreshControl={refreshControl}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop, paddingBottom }}
    >
      {header}
      {n === 0 ? empty : (
        <Animated.View style={[styles.deck, deckStyle]}>
          {videos.map((v, i) => (
            <DeckCard key={v.internal_id} index={i} open={open} height={cardH} count={n}>
              <ProVideoCard
                video={v}
                height={cardH}
                onPress={() => onPressCard(i, v)}
                // Under the top card and not opened: just its strip, darkened.
                tucked={i > 0 && i !== open}
                // Showing whole: say it plays.
                playable={i === 0 || i === open}
                upload={uploads?.get(v.internal_id) ?? null}
                canRetry={canRetry?.(v)}
                onRetry={onRetry}
                onCancel={onCancel}
                onDelete={onDelete}
              />
            </DeckCard>
          ))}
        </Animated.View>
      )}
      {footer}
    </Animated.ScrollView>
  );
}

/** One card's place in the deck, eased when a card opens. Earlier cards lie over later ones. */
function DeckCard({ index, open, height, count, children }: {
  index: number; open: number; height: number; count: number; children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => ({ top: withTiming(topOf(index, open, height), EASE) }), [index, open, height]);
  return (
    <Animated.View style={[styles.slot, { height, zIndex: count - index, elevation: count - index }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  deck: { marginHorizontal: GUTTER + 4 },
  slot: { position: 'absolute', left: 0, right: 0 },
});
