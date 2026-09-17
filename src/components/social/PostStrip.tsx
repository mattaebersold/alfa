import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  type LayoutChangeEvent, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, MessageSquare } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import RowEndSpacer from '../ui/RowEndSpacer';
import { useColors } from '../../hooks/useColors';
import { postMediaList } from '../../utils/postMedia';
import PostMediaCarousel from '../media/PostMediaCarousel';
import { stripHtml } from '../../utils/text';
import type { Post } from '../../types/api';
import { COMMON_RADIUS } from '../../constants/radius';

/** As many as fit before "View all" is the better answer. */
export const STRIP_PREVIEW_COUNT = 6;
const CARD_WIDTH = 168;
const CARD_GAP = 10;
const ROW_PAD_LEFT = 16;
const MEDIA_RATIO = 4 / 3;
/** Same bar FeedList sets for "being watched" — most of the card, not a sliver. */
const VISIBLE_FRACTION = 0.6;

/**
 * A shelf of posts — a handful of them, sideways, with the rest behind a
 * button.
 *
 * Wherever a page is *about* something that posts attach to (a car, a member),
 * the posts themselves are the evidence, and a count on a tile is a poor
 * substitute for seeing them. This is the taste; the pane behind "View all" is
 * the archive.
 *
 * Purely presentational — the host owns the fetching, the paging and what a tap
 * does, because a profile and a car page answer those differently.
 */
export default function PostStrip({
  title,
  posts,
  total,
  showByline = true,
  onPostPress,
  onViewAll,
}: {
  title: string;
  posts: Post[];
  /** How many exist in total — "View all" only appears when there are more. */
  total?: number;
  /** Off where every post has the same author, e.g. a profile. */
  showByline?: boolean;
  onPostPress: (post: Post) => void;
  onViewAll: () => void;
}) {
  const colors = useColors();

  /**
   * Which cards are in view, by index, so a video stops when it's swiped out
   * of the row.
   *
   * A ScrollView has no viewability callbacks, but it doesn't need them: every
   * card is the same width at a known step, so which ones are showing falls
   * straight out of the scroll offset. Held as a joined string so a scroll
   * event that changes nothing about the answer doesn't re-render the row.
   *
   * This only covers sideways. The shelf sits inside a page that scrolls
   * vertically and has no way to hear about that; leaving the screen is
   * handled by the carousel itself, which stops on navigation blur.
   */
  const offsetX = useRef(0);
  const viewportWidth = useRef(0);
  const [visibleKey, setVisibleKey] = useState('');
  const measure = useCallback(() => {
    const shown: number[] = [];
    for (let i = 0; i < posts.length; i++) {
      const left = ROW_PAD_LEFT + i * (CARD_WIDTH + CARD_GAP) - offsetX.current;
      const onScreen = Math.min(left + CARD_WIDTH, viewportWidth.current) - Math.max(left, 0);
      if (onScreen >= CARD_WIDTH * VISIBLE_FRACTION) shown.push(i);
    }
    const key = shown.join(',');
    setVisibleKey((prev) => (prev === key ? prev : key));
  }, [posts.length]);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportWidth.current = e.nativeEvent.layout.width;
    measure();
  }, [measure]);
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offsetX.current = e.nativeEvent.contentOffset.x;
    measure();
  }, [measure]);
  const visible = useMemo(() => new Set(visibleKey.split(',').filter(Boolean).map(Number)), [visibleKey]);

  // Nothing to show is nothing to say — an empty shelf reads as something
  // failing to load.
  if (posts.length === 0) return null;
  const hasMore = (total ?? posts.length) > posts.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.fg }]}>{title}</Text>
        {hasMore && (
          <TouchableOpacity
            style={styles.viewAll}
            onPress={onViewAll}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`View all ${total} posts`}
          >
            <Text style={[styles.viewAllText, { color: colors.primaryAlt }]}>View all</Text>
            <ChevronRight size={14} color={colors.primaryAlt} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        onLayout={onLayout}
        onScroll={onScroll}
        scrollEventThrottle={100}
      >
        {posts.map((post, index) => {
          /**
           * The post's lead item only — its first photo, or its video.
           *
           * The whole gallery would be a swipeable strip inside a row that
           * already swipes the same way, and the two would fight over every
           * drag. The card is a preview; the rest is one tap away.
           */
          const lead = postMediaList(post)[0];
          const caption = post.title || (post.body ? stripHtml(post.body) : '');
          const timeAgo = post.created_at
            ? formatDistanceToNow(new Date(post.created_at), { addSuffix: true })
            : '';

          return (
            /* A View rather than one big touchable, because the media and the
               words are separate targets — but both open the post, video tiles
               included: a card this size is a preview, and the post is where a
               video is worth watching. */
            <View
              key={post.internal_id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderDark }]}
            >
              {lead ? (
                <PostMediaCarousel
                  media={[lead]}
                  // Fixed rather than taken from the photo, so every card in
                  // the row stays the same height.
                  ratio={MEDIA_RATIO}
                  showPageIndicator={false}
                  visible={visible.has(index)}
                  onPressItem={() => onPostPress(post)}
                  videoOpensItem
                />
              ) : (
                // Text posts keep the same footprint, so the row stays even.
                <TouchableOpacity
                  style={[styles.image, styles.imageBlank, { backgroundColor: colors.segment }]}
                  onPress={() => onPostPress(post)}
                  activeOpacity={0.85}
                >
                  <MessageSquare size={20} color={colors.grey} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.body} onPress={() => onPostPress(post)} activeOpacity={0.85}>
                {caption ? (
                  <Text style={[styles.caption, { color: colors.fg }]} numberOfLines={2}>{caption}</Text>
                ) : null}
                {showByline ? (
                  <View style={styles.byline}>
                    <Avatar
                      user={post.user}
                      size={18}
                    />
                    <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>
                      {post.user?.username ? `@${post.user.username}` : ''}{timeAgo ? ` · ${timeAgo}` : ''}
                    </Text>
                  </View>
                ) : timeAgo ? (
                  <Text style={[styles.bylineText, { color: colors.grey }]} numberOfLines={1}>{timeAgo}</Text>
                ) : null}
              </TouchableOpacity>
            </View>
          );
        })}
        <RowEndSpacer />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 20 },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  title:    { fontSize: 17, fontWeight: '800' },
  viewAll:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  viewAllText: { fontSize: 13, fontWeight: '700' },

  row:  { paddingLeft: ROW_PAD_LEFT, gap: CARD_GAP },
  card: { width: CARD_WIDTH, borderRadius: COMMON_RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: MEDIA_RATIO },
  imageBlank: { alignItems: 'center', justifyContent: 'center' },
  // Grows to the card's height, so the whole area under the photo is the
  // target even on a card whose neighbour has a longer caption.
  body:    { padding: 10, gap: 6, flexGrow: 1 },
  caption: { fontSize: 13, fontWeight: '600', lineHeight: 17 },
  byline:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bylineText: { fontSize: 11, flexShrink: 1 },
});
